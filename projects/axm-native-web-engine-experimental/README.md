# AXM Native Web Engine — shared core + local Browser Shell proof

Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`  
Version: `0.4.0-experimental.1`

This detached package now proves human and headless bodies over one source-bound
offline core, including the first bounded local navigation lifecycle:

```text
explicitly allowed local UTF-8 HTML bytes
  -> digest-bound Source Record
  -> tokenizer subset
  -> typed Document Tree
  -> separate semantic Page Model
       `-> shared semantic Structure Index
             |-> compact headless outline JSON
             |-> semantic HTML document map
             `-> AXM Structure Layout
             -> renderer-neutral Display List
                  |-> inert SVG snapshot
                  `-> inert local HTML snapshot
       `-> local Browser Bundle
             `-> one deterministic Browser Session
                   |-> headless session JSON + transition trace
                   |-> read-only verification receipt
                   |-> machine-readable trusted shell policy
                   `-> trusted loopback human Browser Shell
```

Every Structure View carries the same source, document, Page Model, layout, and
display-list lineage plus a reversible-view Modification Ledger. The ledger
records `sourceMutation.performed: false`; discarding the derived view restores
the exact source-bound starting point.

This is not a Chromium/WebView wrapper, complete HTML parser, CSS/site layout
engine, Internet client, page JavaScript runtime, hostile-content sandbox, or
production browser. The local Browser Shell navigates only among files named
explicitly by the caller. Page code, forms, remote media, external resources,
and unlisted targets remain inert or held.

## Why Node in this detached proof

The working-chat runtime had Node.js 24 and no Rust toolchain. This proof uses
dependency-free CommonJS so deterministic contracts can run now. The production
substrate remains a gated review decision in `ROADMAP.md`; this package does not
silently settle it.

## Run headless

```bash
node cli.js inspect fixtures/simple.html --pretty
node cli.js parse fixtures/simple.html --pretty
node cli.js outline fixtures/simple.html --pretty
node cli.js layout fixtures/simple.html --viewport 1120x760 --pretty
node cli.js display fixtures/simple.html --viewport 1120x760 --pretty
node cli.js session fixtures/session-home.html \
  --allow-local fixtures/session-about.html \
  --allow-local fixtures/session-details.html \
  --action activate:entry-0003 --action back --action forward --pretty
node cli.js profile --pretty
```

`outline` emits the compact shared Structure Index used by both bodies.
`layout` emits the typed Structure Layout and its ledger. `display` emits the
renderer-neutral Display List and its ledger. All three report the same
Structure Index digest for the same source and bounds.

`session` emits the complete deterministic local bundle, history state, focus
and scroll entry references, transition trace, reparse receipts, and session
digest. Each page in the bundle carries the same shared-engine lineage used by
`outline` and the Structure Browser.

## Verify a serialized Browser Session

```bash
node scripts/verify-session.js golden/local-session.navigation.json --pretty
# or
npm run session:verify -- golden/local-session.navigation.json --pretty
```

The read-only verifier recomputes the bundle and session digests and checks
page/link/history/current-state/transition invariants. It emits
`axm.web.local-browser-session-verification/v1` and exits nonzero when the
record fails verification. Invalid UTF-8, invalid JSON, and oversized verifier
inputs fail as typed findings rather than becoming trusted session state.

A PASS is deliberately narrow: it proves internal digest and structural
consistency under the implemented checks. It does **not** prove the original
page content was truthful, safe, standards-conformant, or produced by a trusted
machine. The receipt grants no mutation, installation, promotion, or canon
authority. GitHub CI also uses a separately implemented verifier outside this
package as an independent countercheck.

## Inspect the trusted shell policy

```bash
node scripts/shell-policy.js --pretty
# or
npm run shell:policy -- --pretty
```

This does not start a listener. It emits
`axm.web.local-browser-shell-policy/v1`, a deterministic digest-bound policy
that reports the loopback bind address, capability-token size, exact-Origin
mutation requirement, controller CSP hash, complete CSP, response isolation
headers, denied device capabilities, no-external-network/page-script facts, and
closed authority flags. It lets a future host or Workshop inspect what the
trusted shell promises before launching it instead of inferring policy from
prose. The policy receipt does not itself grant network, mutation, install,
promotion, or canon authority.

## Run the local human Browser Shell

```bash
node cli.js serve-local fixtures/session-home.html \
  --allow-local fixtures/session-about.html \
  --allow-local fixtures/session-details.html
```

Open the ephemeral `shellUrl` printed in the host receipt. The trusted AXM shell
supports bundled link activation, an allowlist-only address surface,
back/forward, source-reparsing reload, document-map focus, scroll restoration,
visible history, and lineage receipts. Stop it with `Ctrl+C`; process-owned
session state is discarded.

The host binds only to `127.0.0.1`, uses a random capability path and a
CSP-hash-bound controller. Every mutation requires a present `Origin` exactly
equal to the shell origin; missing-origin, cross-origin, non-JSON, and oversized
actions are refused before session mutation. Loopback responses also apply
same-origin opener/resource policies, deny unused device permissions, and use a
CSP with `frame-ancestors 'none'`. These harden the trusted shell; they do not
turn it into the held external Network Broker or an untrusted Web Content
sandbox. See `LOCAL_BROWSER_SESSION_CONTRACT.md` for the exact authority and
evidence ceiling.

## Create inert visual artifacts

```bash
node cli.js render-svg fixtures/simple.html --out ./simple.structure.svg
node cli.js browser-snapshot fixtures/simple.html --out ./simple.browser.html
```

Writes require an explicit `--out` file. Existing outputs are refused unless
the caller adds `--force`; input-path overwrite and final-component symbolic
links, including dangling links, are refused. Each successful write prints
`axm.web.artifact-receipt/v1` with byte,
SHA-256, source, Page Model, layout, Display List, and ledger bindings.

Committed deterministic examples are in `examples/`. The HTML snapshot has a
deny-by-default Content Security Policy, no script or form, and no external
resources. Its trusted document-map anchors navigate only within the generated
snapshot; original page links remain inert text. The SVG renderer accepts only
rectangle, line, and escaped text commands from the shared Display List.

## Verify

```bash
node --test tests/*.test.js
node scripts/verify-schemas.js
node scripts/build-examples.js --verify
node scripts/build-source-manifest.js --verify
node scripts/verify-session.js golden/local-session.navigation.json --pretty
node scripts/shell-policy.js --pretty
```

`STRUCTURE_VIEW_CONTRACT.md` and `LOCAL_BROWSER_SESSION_CONTRACT.md` define the
lineage and non-claims.
`ACTION_REPORT.md` records the current evidence ceiling. `KNOWN_LIMITS.md` and
`SECURITY_BOUNDARIES.md` are part of the build, not afterthoughts.

Passing checks does not install, promote, merge, or mark this package `CANON`.
