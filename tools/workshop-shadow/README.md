# Workshop Shadow

Status: `TEST`

This tool declares the provider-neutral Workshop shadow host boundary without
changing the byte-bound identity of the existing Sandbox tool. The bounded
implementation and operational instructions live in
`tools/sandbox/README-workshop-shadow-sandbox-v1.md`.

It supports one deterministic `tools-index.json` refresh recipe and one legacy
manifest declaration repair recipe. The repair adds the fixed modern schema and
preserves every schema-allowed `kind` as an equal detached alternative. It does
not rank or select an alternative, claim semantic fitness, run the declared
tests, recover missing repository files, execute candidates, write back to a
Workshop source, install, integrate, publish, promote, or alter `CANON`.

Run:

```powershell
node tools/workshop-shadow/selftest.js
```

For an explicit current-source contract repair review:

```powershell
node tools/sandbox/workshop-contract-repair-preview-v1.js --source-root <absolute-workshop-path> --session-id <portable-id> --tool-id <portable-tool-id>
```
