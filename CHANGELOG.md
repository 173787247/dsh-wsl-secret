# Changelog

## 0.2.0

- `secret_pass_list` — list allowlisted pass entry names (no values)
- `secret_pass_exists` — boolean existence check
- `secret_to_env` / `secret_age_to_env` — load into `process.env`, return preview only (preferred path)
- `secret_status` now reports `ready` + configure hint when allowlist empty
- Clearer README (EN/ZH): setup, tool table, cred vs secret
- `pass show` uses first line only as the secret

## 0.1.0

- Initial: `secret_status`, `secret_pass_get`, `secret_age_decrypt`
- `allowPrefixes` + `reveal: false` by default
