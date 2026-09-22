import {
  secretStatus,
  passShow,
  passExists,
  passList,
  passToEnv,
  ageDecrypt,
  ageToEnv,
} from "./lib/secret.js";

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
    `[dsh-wsl-secret] allowPrefixes=${allowPrefixes.length} reveal=${reveal}` +
      (allowPrefixes.length ? "" : " (empty allowlist → all reads refused)"),
  );

  ctx.systemPrompt.section({
    name: "tool:secret",
    order: 133,
    text: [
      "dsh-wsl-secret reads pass/age secrets only under config.allowPrefixes.",
      "Preferred flow: secret_pass_exists → secret_to_env (puts value in process.env, returns preview only) → call other tools.",
      "Avoid secret_pass_get with reveal; never paste secrets into chat.",
      "If allowPrefixes is empty, every read fails — tell the user to configure the plugin.",
      "dsh-wsl-cred is for Git credential hints only; use this plugin for app API keys.",
    ].join(" "),
  });

  const commonOut = {
    schema: { type: "object", additionalProperties: true },
  };

  ctx.tools.register({
    name: "secret_status",
    description:
      "Show whether pass/age exist, password-store path, and current allowPrefixes. Does not list or dump secrets.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
    output: {
      ...commonOut,
      render: (_a, v) => [{ type: "text", text: formatStatus(v) }],
    },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute() {
      const st = await secretStatus();
      return {
        ...st,
        allowPrefixes,
        reveal,
        ready: allowPrefixes.length > 0,
        howToConfigure:
          allowPrefixes.length > 0
            ? null
            : "Edit profile cordis.patch.yml → dsh-wsl-secret config.allowPrefixes (e.g. [\"dsh\"]). See plugin README.",
      };
    },
    presentCall: () => ({ card: "generic", title: "Secret status" }),
    presentResult: (_a, r) => ({ card: "generic", title: "Secret status", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_pass_list",
    description: "List pass entry names under allowPrefixes (names only, no values). Optional prefix filter.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        prefix: { type: "string", description: "Optional narrower prefix under allowlist" },
        max: { type: "number" },
      },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        {
          type: "text",
          text:
            v.ok === false
              ? v.error
              : [`secret_pass_list count=${v.count}`, ...(v.entries || []).map((e) => `- ${e}`)].join("\n"),
        },
      ],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await passList({ allowPrefixes, prefix: args?.prefix, max: args?.max || 100 });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "pass list" }),
    presentResult: (_a, r) => ({ card: "generic", title: "pass list", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_pass_exists",
    description: "Check whether a pass entry exists under allowPrefixes (boolean only).",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string" } },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        { type: "text", text: v.ok === false ? v.error : `${v.entry}: ${v.exists ? "exists" : "missing"}` },
      ],
    },
    timeoutMs: 5_000,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await passExists(args.name, { allowPrefixes });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "pass exists" }),
    presentResult: (_a, r) => ({ card: "generic", title: "pass exists", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_to_env",
    description:
      "PREFERRED: load a pass entry into process.env[envKey] for later tools. Returns preview only — not the full secret. Example: name=dsh/openrouter envKey=OPENROUTER_API_KEY.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["name", "envKey"],
      properties: {
        name: { type: "string", description: "pass entry under allowPrefixes" },
        envKey: { type: "string", description: "Environment variable name, e.g. OPENROUTER_API_KEY" },
      },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        {
          type: "text",
          text:
            v.ok === false
              ? v.error
              : `ok envKey=${v.envKey} entry=${v.entry} preview=${v.preview}\n${v.note || ""}`,
        },
      ],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await passToEnv(args.name, args.envKey, { allowPrefixes, timeoutMs });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "secret → env" }),
    presentResult: (_a, r) => ({ card: "generic", title: "secret → env", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_pass_get",
    description:
      "Read a pass entry. With reveal=false (default config) only preview is returned. Prefer secret_to_env instead.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string", description: "pass entry e.g. dsh/openrouter" } },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        {
          type: "text",
          text: v.ok === false ? v.error : `entry=${v.entry} preview=${v.preview}${v.value ? "\n(value present — reveal on)" : ""}`,
        },
      ],
    },
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
    name: "secret_age_to_env",
    description: "Decrypt an age file under filesystem allowPrefixes into process.env[envKey]. Preview only in result.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path", "envKey"],
      properties: {
        path: { type: "string" },
        envKey: { type: "string" },
        identityFile: { type: "string" },
      },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        {
          type: "text",
          text: v.ok === false ? v.error : `ok envKey=${v.envKey} path=${v.path} preview=${v.preview}`,
        },
      ],
    },
    timeoutMs,
    isConcurrencySafe: () => true,
    async execute(args) {
      try {
        return await ageToEnv(args.path, args.envKey, {
          allowPrefixes,
          timeoutMs,
          identityFile: args.identityFile,
        });
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
    presentCall: () => ({ card: "generic", title: "age → env" }),
    presentResult: (_a, r) => ({ card: "generic", title: "age → env", content: r.content }),
  });

  ctx.tools.register({
    name: "secret_age_decrypt",
    description: "Decrypt an age file under allowPrefixes. Prefer secret_age_to_env. Preview unless reveal=true.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string" },
        identityFile: { type: "string", description: "Optional age identity (-i)" },
      },
    },
    output: {
      ...commonOut,
      render: (_a, v) => [
        { type: "text", text: v.ok === false ? v.error : `path=${v.path} preview=${v.preview}` },
      ],
    },
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

function formatStatus(v) {
  const lines = [
    `secret_status ready=${v.ready}`,
    `pass=${v.pass || "missing"} age=${v.age || "missing"}`,
    `passwordStore=${v.passwordStore}`,
    `allowPrefixes=${JSON.stringify(v.allowPrefixes || [])}`,
    `reveal=${v.reveal}`,
  ];
  if (v.howToConfigure) lines.push(`NEXT: ${v.howToConfigure}`);
  return lines.join("\n");
}

function positive(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}
