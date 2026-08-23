# AXM Native Web Engine — detached Phase 0/1 proof

Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

This package is the first bounded implementation slice of the AXM Native Web
Engine handoff. It proves one shared, offline core:

```text
UTF-8 HTML bytes
  -> digest-bound Source Record
  -> tokenizer subset
  -> typed Document Tree
  -> separate semantic Page Model
  -> deterministic headless JSON envelope
```

It is not a conventional browser shell, a Chromium/WebView wrapper, a complete
HTML parser, a CSS engine, a renderer, a network client, or a JavaScript
runtime. No page code is executed. No provider key, Workshop state, browser
storage, network authority, or local-machine capability is touched.

## Why Node in this detached proof

The working-chat runtime had Node.js 24 and no Rust toolchain. Phase 1 therefore
uses dependency-free CommonJS so the architecture and deterministic contracts
can be exercised now. The recommended production substrate remains an explicit
Rust review decision in `ROADMAP.md`; this proof does not silently settle it.

## Run

From this directory:

```bash
npm test
npm run verify
node cli.js inspect fixtures/simple.html --pretty
node cli.js parse fixtures/simple.html --pretty
node cli.js tokenize fixtures/simple.html --pretty
node cli.js profile --pretty
```

`http://` and `https://` inputs are refused with `NETWORK_HELD`. Only local
files and standard input (`-`) are accepted in this phase.

## Shared-core rule

The CLI imports `src/engine.js`; it contains no parser or Page Model copy. A
future visual body must consume the same typed core output. Headless is an
output body, not a second engine.

## Evidence and limits

- `RECONNAISSANCE_MAP.md` binds the Phase 0 map to the inspected repository
  checkpoint.
- `manifests/capability-profile.json` distinguishes `SUPPORTED`, `PARTIAL`,
  `UNSUPPORTED`, and `HELD` features.
- `manifests/source-manifest.json` binds executable and contract files to
  SHA-256 digests.
- `ACTION_REPORT.md` states what the checks prove and do not prove.
- `KNOWN_LIMITS.md` is part of the build, not an afterthought.
- `LOCAL_INTAKE_HANDOFF.txt` leaves local intake as a later explicit action.

Passing these tests does not promote this package to `WORKING` or `CANON`.
