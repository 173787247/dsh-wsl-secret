import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, normalize } from "node:path";

export function which(cmd) {
  const safe = String(cmd || "").replace(/[^a-zA-Z0-9._+-]/g, "");
  if (!safe) return Promise.resolve("");
  return new Promise((resolvePromise) => {
    const child = spawn("bash", ["-lc", `command -v ${safe}`], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (c) => resolvePromise(c === 0 ? out.trim() : ""));
  });
}

export function run(bin, args, timeoutMs = 15_000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("timeout"));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d;
      if (stdout.length > 200_000) child.kill("SIGKILL");
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(t);
      resolvePromise({ code, stdout, stderr });
    });
    child.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

/** pass entry name like Foo/bar — must match allowPrefixes (prefix/) or exact. */
export function assertPassName(name, allowPrefixes = []) {
  const n = String(name || "").trim().replace(/^\/+/, "");
  if (!n || n.includes("..") || n.includes("\0")) throw new Error("invalid pass name");
  if (!/^[A-Za-z0-9._/@+-]+$/.test(n)) throw new Error("pass name has illegal chars");
  if (!allowPrefixes.length) throw new Error("allowPrefixes empty — configure cordis patch before reading secrets");
  const ok = allowPrefixes.some((p) => {
    const pref = String(p).replace(/^\/+|\/+$/g, "");
    return n === pref || n.startsWith(pref + "/");
  });
  if (!ok) throw new Error(`pass entry not under allowPrefixes: ${n}`);
  return n;
}

export function assertAgePath(filePath, allowPrefixes = []) {
  const abs = resolve(String(filePath || "").trim());
  if (abs.includes("\0") || abs.includes("..")) throw new Error("invalid age path");
  if (!allowPrefixes.length) throw new Error("allowPrefixes empty");
  const home = homedir();
  const candidates = allowPrefixes.map((p) => resolve(p.startsWith("~") ? p.replace(/^~/, home) : p));
  const ok = candidates.some((root) => {
    const r = root.replace(/[/\\]+$/, "");
    return abs === r || abs.startsWith(r + "/") || abs.startsWith(r + "\\");
  });
  if (!ok) throw new Error(`age file outside allowPrefixes: ${abs}`);
  if (!existsSync(abs)) throw new Error("age file missing");
  return abs;
}

export function redactSecret(text, reveal) {
  const s = String(text || "");
  if (reveal) return s;
  if (!s) return "";
  if (s.length <= 8) return "***";
  return `${s.slice(0, 2)}…${s.slice(-2)} (len=${s.length})`;
}

export async function secretStatus() {
  return {
    ok: true,
    pass: (await which("pass")) || null,
    age: (await which("age")) || null,
    passwordStore: process.env.PASSWORD_STORE_DIR || resolve(homedir(), ".password-store"),
  };
}

export async function passShow(name, { allowPrefixes, timeoutMs, reveal }) {
  const entry = assertPassName(name, allowPrefixes);
  const bin = (await which("pass")) || "pass";
  const { code, stdout, stderr } = await run(bin, ["show", entry], timeoutMs);
  if (code !== 0) throw new Error(`pass failed: ${stderr || code}`);
  const raw = stdout.replace(/\r?\n$/, "");
  return {
    ok: true,
    entry,
    preview: redactSecret(raw, reveal),
    // full value only when reveal:true — still returned to tool result (agent may see it)
    value: reveal ? raw : undefined,
  };
}

export async function ageDecrypt(filePath, { allowPrefixes, timeoutMs, reveal, identityFile }) {
  const file = assertAgePath(filePath, allowPrefixes);
  const bin = (await which("age")) || "age";
  const args = ["-d"];
  if (identityFile) {
    const id = resolve(String(identityFile));
    if (!existsSync(id)) throw new Error("identity file missing");
    args.push("-i", id);
  }
  args.push(file);
  const { code, stdout, stderr } = await run(bin, args, timeoutMs);
  if (code !== 0) throw new Error(`age failed: ${stderr || code}`);
  const raw = stdout;
  return { ok: true, path: file, preview: redactSecret(raw, reveal), value: reveal ? raw : undefined };
}
