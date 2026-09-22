# dsh-wsl-secret

> **中文文档 → [README.zh.md](./README.zh.md)** · English below

Read **pass** / **age** secrets into a DSH (Cordis) session — safely.

| | |
|---|---|
| npm | `dsh-wsl-secret` |
| Requires | WSL/Linux with `pass` and/or `age` on PATH |
| Default | **reads blocked** until you set `allowPrefixes` |

## Why this plugin exists

- **`dsh-wsl-cred`** → Git push/pull credential *hints* only  
- **`dsh-wsl-secret`** → App secrets (OpenRouter, Discord bot token, …) from your password store

If `secret_status` shows `ready=false`, the plugin is installed but **not configured**. That is intentional.

## 5-minute setup

### 1. Install tools (once)

```bash
# Debian/Ubuntu example
sudo apt install pass age
# initialise pass if needed: pass init <gpg-id>
```

### 2. Put secrets under one prefix

```bash
pass insert dsh/openrouter    # paste API key, first line = secret
pass insert dsh/discord-bot
```

### 3. Allow that prefix in Cordis

Edit your profile `cordis.patch.yml` (example: `~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
plugins:
  dsh-wsl-secret:
    enabled: true
    path: /mnt/c/Users/YOU/Desktop/AIFullStackDevelopment/dsh-wsl-secret
    config:
      # pass: folder names under ~/.password-store
      # age: absolute or ~/ filesystem roots
      allowPrefixes:
        - dsh
        # - ~/secrets
      reveal: false          # keep false; use secret_to_env instead
      timeoutMs: 15000
```

Restart DSH / reload the profile.

### 4. Agent flow (what to ask / what tools do)

| Step | Tool | Result |
|------|------|--------|
| Check | `secret_status` | `ready=true`, lists allowPrefixes |
| Find | `secret_pass_list` | names only, e.g. `dsh/openrouter` |
| Confirm | `secret_pass_exists` | `{ exists: true }` |
| **Use** | `secret_to_env` | sets `process.env.OPENROUTER_API_KEY`, returns **preview only** |
| Optional | `secret_pass_get` | preview (or full value only if `reveal: true` — avoid) |

Example tool call:

```json
{ "name": "secret_to_env", "arguments": {
  "name": "dsh/openrouter",
  "envKey": "OPENROUTER_API_KEY"
}}
```

After that, other tools in the **same dsh process** can read `process.env.OPENROUTER_API_KEY`. The chat UI only sees a redacted preview.

## Tools

| Tool | Purpose |
|------|---------|
| `secret_status` | pass/age on PATH + allowlist + `ready` |
| `secret_pass_list` | list entry **names** under allowlist |
| `secret_pass_exists` | boolean exists check |
| `secret_to_env` | **preferred** — pass → `process.env` |
| `secret_pass_get` | read with preview / optional reveal |
| `secret_age_to_env` | age file → `process.env` |
| `secret_age_decrypt` | decrypt age file (preview / reveal) |

## Security model

1. Empty `allowPrefixes` → every read fails (safe default).  
2. Pass names must match an allowlist prefix (`dsh` → `dsh/...`).  
3. Age paths must sit under filesystem roots in the same list (`~/secrets/...`).  
4. `reveal: false` (default): tool results never include the full secret.  
5. Prefer `secret_to_env` / `secret_age_to_env` so the model never needs the raw string in context.  
6. Never paste secrets into the chat.

## Develop

```bash
npm test
```

## License

MIT — [LICENSE](./LICENSE)
