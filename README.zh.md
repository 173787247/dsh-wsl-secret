# dsh-wsl-secret

在 DSH（Cordis）里**安全读取** pass / age 密钥。

| | |
|---|---|
| npm | `dsh-wsl-secret` |
| 环境 | WSL/Linux，PATH 上有 `pass` 和/或 `age` |
| 默认 | **不配 `allowPrefixes` 就读不了**（故意的） |
| 对比 | `dsh-wsl-cred` = Git 凭据提示；本插件 = 应用 API Key |

[English → README.md](./README.md)

## 为什么要单独插件

- **`dsh-wsl-cred`** → 只给 Git 推送/拉取的凭据*提示*
- **`dsh-wsl-secret`** → OpenRouter、Discord Bot Token 等应用密钥

`secret_status` 显示 `ready=false` = 已安装但**未配置**，属正常安全默认。

## 5 分钟上手

### 1. 装工具（一次）

```bash
sudo apt install pass age
# 需要时: pass init <gpg-id>
```

### 2. 密钥放在同一前缀下

```bash
pass insert dsh/openrouter
pass insert dsh/discord-bot
```

### 3. Cordis 放行该前缀

编辑 profile 的 `cordis.patch.yml`（例如 `~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
plugins:
  dsh-wsl-secret:
    enabled: true
    path: /mnt/c/Users/你/Desktop/AIFullStackDevelopment/dsh-wsl-secret
    config:
      allowPrefixes:
        - dsh
        # - ~/secrets          # age 用文件系统根
      reveal: false
      timeoutMs: 15000
```

重启 / 重载 profile。

### 4. 推荐工具链

| 步骤 | 工具 | 结果 |
|------|------|------|
| 检查 | `secret_status` | `ready=true` |
| 列举 | `secret_pass_list` | 只有名字 |
| 确认 | `secret_pass_exists` | `{ exists: true }` |
| **使用** | `secret_to_env` | 写入 `process.env`，聊天里只有 preview |
| 可选 | `secret_pass_get` | 预览（少用；勿开 reveal） |

```json
{ "name": "secret_to_env", "arguments": {
  "name": "dsh/openrouter",
  "envKey": "OPENROUTER_API_KEY"
}}
```

之后**同一 dsh 进程**内其它工具可读 `process.env.OPENROUTER_API_KEY`。

## 工具一览

| 工具 | 作用 |
|------|------|
| `secret_status` | pass/age、allowlist、`ready` |
| `secret_pass_list` | 只列名字 |
| `secret_pass_exists` | 是否存在 |
| `secret_to_env` | **首选** pass → 环境变量 |
| `secret_pass_get` | 预览读取 |
| `secret_age_to_env` | age → 环境变量 |
| `secret_age_decrypt` | age 解密（预览） |

## 安全模型（摘要）

1. 空 `allowPrefixes` → 全部拒绝  
2. pass 名必须匹配前缀（`dsh` → `dsh/...`）  
3. age 路径必须在列表里的目录根下  
4. 默认 `reveal: false`，结果不含完整密钥  
5. 优先 `secret_to_env`，避免把明文塞进模型上下文  
6. 永远不要把密钥贴进聊天  

更细的英文说明见 [README.md](./README.md)。

## License

MIT
