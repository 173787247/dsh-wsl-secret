import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

export function normalizePrefix(p) {
  return String(p || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

/** pass entry name like Foo/bar — must match allowPrefixes (prefix/) or exact. */
export function assertPassName(name, allowPrefixes = []) {
  const n = String(name || "").trim().replace(/^\/+/, "");
  if (!n || n.includes("..") || n.includes("\0")) throw new Error("invalid pass name");
  if (!/^[A-Za-z0-9._/@+-]+$/.test(n)) throw new Error("pass name has illegal chars");
  if (!allowPrefixes.length) {
    throw new Error("allowPrefixes empty — set config.allowPrefixes in cordis.patch.yml first");
  }
  const ok = allowPrefixes.some((p) => {
    const pref = normalizePrefix(p);
    if (!pref) return false;
    // directory roots for age look like paths — skip those for pass names
    if (pref.startsWith("~") || pref.startsWith("/") || /^[A-Za-z]:/.test(pref)) return false;
    return n === pref || n.startsWith(pref + "/");
  });
  if (!ok) throw new Error(`pass entry not under allowPrefixes: ${n}`);
  return n;
}

export function assertAgePath(filePath, allowPrefixes = []) {
  const abs = resolve(String(filePath || "").trim());
  if (abs.includes("\0")) throw new Error("invalid age path");
  if (!allowPrefixes.length) throw new Error("allowPrefixes empty");
  const home = homedir();
  const candidates = allowPrefixes
    .map((p) => String(p).trim())
    .filter((p) => p.startsWith("~") || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.includes("/") || p.includes("\\"))
    .map((p) => resolve(p.startsWith("~") ? p.replace(/^~/, home) : p));
  if (!candidates.length) {
    throw new Error("no filesystem allowPrefixes for age (use absolute or ~/ paths)");
  }
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

export function assertEnvKey(key) {
  const k = String(key || "").trim();
  if (!ENV_KEY_RE.test(k)) throw new Error(`invalid env key: ${key}`);
  if (k === "PATH" || k === "HOME" || k === "USER") throw new Error(`refusing to overwrite ${k}`);
  return k;
}

export function passwordStoreDir(env = process.env) {
  return env.PASSWORD_STORE_DIR || resolve(homedir(), ".password-store");
}

/** List .gpg entries under store that fall under allowPrefixes. */
export function listPassEntries(allowPrefixes = [], { max = 200 } = {}) {
  if (!allowPrefixes.length) throw new Error("allowPrefixes empty");
  const store = passwordStoreDir();
  if (!existsSync(store)) return [];
  const passPrefs = allowPrefixes
    .map(normalizePrefix)
    .filter((p) => p && !p.startsWith("~") && !p.startsWith("/") && !/^[A-Za-z]:/.test(p));
  if (!passPrefs.length) return [];

  const out = [];
  function walk(dir) {
    if (out.length >= max) return;
    let ents;
    try {
      ents = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of ents) {
      if (name === ".git" || name.startsWith(".")) continue;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && name.endsWith(".gpg")) {
        const rel = relative(store, full).replace(/\\/g, "/").replace(/\.gpg$/, "");
        const ok = passPrefs.some((pref) => rel === pref || rel.startsWith(pref + "/"));
        if (ok) out.push(rel);
        if (out.length >= max) return;
      }
    }
  }
  walk(store);
  out.sort();
  return out;
}

export async function secretStatus() {
  return {
    ok: true,
    pass: (await which("pass")) || null,
    age: (await which("age")) || null,
    passwordStore: passwordStoreDir(),
  };
}

export async function passShow(name, { allowPrefixes, timeoutMs, reveal }) {
  const entry = assertPassName(name, allowPrefixes);
  const bin = (await which("pass")) || "pass";
  const { code, stdout, stderr } = await run(bin, ["show", entry], timeoutMs);
  if (code !== 0) throw new Error(`pass failed: ${stderr || code}`);
  // first line is the secret; rest often metadata
  const lines = stdout.replace(/\r\n/g, "\n").split("\n");
  const raw = lines[0] || "";
  return {
    ok: true,
    entry,
    preview: redactSecret(raw, reveal),
    value: reveal ? raw : undefined,
  };
}

export async function passExists(name, { allowPrefixes }) {
  const entry = assertPassName(name, allowPrefixes);
  const store = passwordStoreDir();
  const file = join(store, `${entry}.gpg`);
  return { ok: true, entry, exists: existsSync(file) };
}

export async function passList({ allowPrefixes, prefix, max = 100 }) {
  let entries = listPassEntries(allowPrefixes, { max: Math.min(500, Math.max(1, max)) });
  const pref = String(prefix || "").trim().replace(/^\/+|\/+$/g, "");
  if (pref) {
    // prefix may be a folder (dsh) or an entry stem under allowlist
    assertPassName(pref, allowPrefixes);
    entries = entries.filter((e) => e === pref || e.startsWith(pref + "/"));
  }
  return { ok: true, count: entries.length, entries: entries.slice(0, max) };
}

/**
 * Load pass entry into process.env[envKey] for later tools in this dsh process.
 * Never returns the secret value (only preview + envKeys).
 */
export async function passToEnv(name, envKey, { allowPrefixes, timeoutMs }) {
  const key = assertEnvKey(envKey);
  const shown = await passShow(name, { allowPrefixes, timeoutMs, reveal: true });
  process.env[key] = shown.value;
  return {
    ok: true,
    entry: shown.entry,
    envKey: key,
    preview: redactSecret(shown.value, false),
    note: "Secret is in process.env for this dsh process only; not shown in full. Prefer this over reveal.",
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

export async function ageToEnv(filePath, envKey, { allowPrefixes, timeoutMs, identityFile }) {
  const key = assertEnvKey(envKey);
  const dec = await ageDecrypt(filePath, {
    allowPrefixes,
    timeoutMs,
    reveal: true,
    identityFile,
  });
  const value = String(dec.value || "").split("\n")[0] || "";
  process.env[key] = value;
  return {
    ok: true,
    path: dec.path,
    envKey: key,
    preview: redactSecret(value, false),
    note: "Secret is in process.env for this dsh process only; not shown in full.",
  };
}
