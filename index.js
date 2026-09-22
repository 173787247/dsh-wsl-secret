import { secretStatus, passShow, ageDecrypt } from "./lib/secret.js";

export const name = "dsh-wsl-secret";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  if (config.enabled === false) {
    console.log("[dsh-wsl-secret] disabled");
    return;
  }
  const timeoutMs = positive(config.timeoutMs, 15_000);
  const allowPrefixes = Array.isArray(config.allowPrefixes) ? config.allowPrefixes.map(String) : [];
  const reveal = config.reveal === true;
  console.log(
    `[dsh-wsl-secret] allowPrefixes=${allowPrefixes.length} reveal=${reveal} (empty allowlist blocks all reads)`,
  );

  ctx.systemPrompt.section({
    name: "tool:secret",
    order: 133,
    text: [
      "dsh-wsl-secret can read pass/age secrets only under configured allowPrefixes.",
      "Default reveal=false returns a short preview, not the full secret.",
      "Never paste secrets into chat. If allowPrefixes is empty, reads are refused.",
    ].join(" "),
  });

  ctx.tools.register({
    name: "secret_status",
    description: "Whether pass/age are on PATH; does not list secret names.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: JSON.stringify(v, null, 2) }] },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute() {
      const st = await secretStatus();
      return { ...st, allowPrefixes, reveal };
    },
    presentCall: () => ({ card: "generic", title: "Secret status" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Secret status", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_pass_get",
    description: "Read a pass entry under allowPrefixes. Preview only unless reveal=true in plugin config.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string", description: "pass entry e.g. Work/api-token" } },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : `entry=${v.entry} preview=${v.preview}` }] },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await passShow(args.name, { allowPrefixes, timeoutMs, reveal });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "pass get" }),
    presentResult: (_a, r) => ({ card: "generic", title: "pass get", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_age_decrypt",
    description: "Decrypt an age file under allowPrefixes. Preview only unless reveal=true.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string" },
        identityFile: { type: "string", description: "Optional age identity (-i)" },
      },
    },
    output: { schema: { type: "object", additionalProperties: true }, render: (_a, v) => [{ type: "text", text: v.ok === false ? v.error : `path=${v.path} preview=${v.preview}` }] },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await ageDecrypt(args.path, {
          allowPrefixes,
          timeoutMs,
          reveal,
          identityFile: args.identityFile,
        });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "age decrypt" }),
    presentResult: (_a, r) => ({ card: "generic", title: "age decrypt", content: r.content }),
  });
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}
