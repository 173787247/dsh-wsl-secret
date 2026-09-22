# dsh-wsl-secret

在 DSH（Cordis）里**安全读取** pass / age 密钥。

| | |
|---|---|
| 默认 | **不配 `allowPrefixes` 就读不了**（故意的） |
| 对比 | `dsh-wsl-cred` = Git 凭据提示；本插件 = 应用 API Key |

## 最短上手

```bash
pass insert dsh/openrouter
```

`cordis.patch.yml`：

```yaml
plugins:
  dsh-wsl-secret:
    enabled: true
    path: /path/to/dsh-wsl-secret
    config:
      allowPrefixes: [dsh]
      reveal: false
```

推荐工具链：`secret_status` → `secret_pass_list` / `secret_pass_exists` → **`secret_to_env`**（写入 `process.env`，结果里只有 preview）。

```json
{ "name": "secret_to_env", "arguments": {
  "name": "dsh/openrouter",
  "envKey": "OPENROUTER_API_KEY"
}}
```

## 工具一览

| 工具 | 作用 |
|------|------|
| `secret_status` | 是否 ready、allowlist |
| `secret_pass_list` | 只列名字 |
| `secret_pass_exists` | 是否存在 |
| `secret_to_env` | **首选** pass → 环境变量 |
| `secret_pass_get` | 预览读取（少用） |
| `secret_age_to_env` / `secret_age_decrypt` | age 文件 |

详情与安全模型见 [README.md](./README.md)。

## License

MIT
