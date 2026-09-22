# dsh-wsl-secret

Read-only **pass** / **age** lookup for dsh on WSL. Empty `allowPrefixes` refuses all reads. Default `reveal: false` returns a short preview only.

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-secret
```

```yaml
config:
  allowPrefixes: ["Work", "/home/you/secrets"]
  reveal: false
```

[中文 → README.zh.md](./README.zh.md)

## License

MIT
