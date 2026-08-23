# Workshop Shadow

Status: `TEST`

This tool declares the provider-neutral Workshop shadow host boundary without
changing the byte-bound identity of the existing Sandbox tool. The bounded
implementation and operational instructions live in
`tools/sandbox/README-workshop-shadow-sandbox-v1.md`.

It supports one deterministic `tools-index.json` refresh recipe. It does not
recover missing repository files, execute candidates, write back to a Workshop
source, install, integrate, publish, promote, or alter `CANON`.

Run:

```powershell
node tools/workshop-shadow/selftest.js
```
