# AXM Native Web Engine — semantic core + Structure Browser proof

Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`  
Version: `0.2.0-experimental.1`

This detached package now proves two output bodies over one offline core:

```text
local UTF-8 HTML bytes
  -> digest-bound Source Record
  -> tokenizer subset
  -> typed Document Tree
  -> separate semantic Page Model
       |-> deterministic headless JSON
       `-> AXM Structure Layout
             -> renderer-neutral Display List
                  |-> inert SVG snapshot
                  `-> inert local HTML snapshot
```

Every Structure View carries the same source, document, Page Model, layout, and
display-list lineage plus a reversible-view Modification Ledger. The ledger
records `sourceMutation.performed: false`; discarding the derived view restores
the exact source-bound starting point.

This is not a conventional browser shell, Chromium/WebView wrapper, complete
HTML parser, CSS/site layout engine, network client, navigation stack, or
JavaScript runtime. The visual output is explicitly an **AXM Structure View**,
not a claim that a website has been rendered. Page code, links, forms, remote
media, and resource URLs remain inert data.

## Why Node in this detached proof

The working-chat runtime had Node.js 24 and no Rust toolchain. This proof uses
dependency-free CommonJS so deterministic contracts can run now. The production
substrate remains a gated review decision in `ROADMAP.md`; this package does not
silently settle it.

## Run headless

```bash
node cli.js inspect fixtures/simple.html --pretty
node cli.js parse fixtures/simple.html --pretty
node cli.js layout fixtures/simple.html --viewport 1120x760 --pretty
node cli.js display fixtures/simple.html --viewport 1120x760 --pretty
node cli.js profile --pretty
```

`layout` emits the typed Structure Layout and its ledger. `display` emits the
renderer-neutral Display List and its ledger. Both report matching layout,
display-list, and ledger digests for the same options.

## Create inert visual artifacts

```bash
node cli.js render-svg fixtures/simple.html --out ./simple.structure.svg
node cli.js browser-snapshot fixtures/simple.html --out ./simple.browser.html
```

Writes require an explicit `--out` file. Existing outputs are refused unless
the caller adds `--force`; input-path overwrite and symbolic-link outputs are
refused. Each successful write prints `axm.web.artifact-receipt/v1` with byte,
SHA-256, source, Page Model, layout, Display List, and ledger bindings.

Committed deterministic examples are in `examples/`. The HTML snapshot has a
deny-by-default Content Security Policy, no script, no active links or forms,
and no external resources. The SVG renderer accepts only rectangle, line, and
escaped text commands from the shared Display List.

## Verify

```bash
node --test tests/*.test.js
node scripts/verify-schemas.js
node scripts/build-examples.js --verify
node scripts/build-source-manifest.js --verify
```

`STRUCTURE_VIEW_CONTRACT.md` defines the lineage and non-claims.
`ACTION_REPORT.md` records the current evidence ceiling. `KNOWN_LIMITS.md` and
`SECURITY_BOUNDARIES.md` are part of the build, not afterthoughts.

Passing checks does not install, promote, merge, or mark this package `CANON`.
