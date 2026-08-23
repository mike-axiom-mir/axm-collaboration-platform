# Action Report — detached Phase 0/1 build

Date: 2026-08-23  
Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

## Goal

Create the smallest honest executable proof that AXM can own a staged web
representation without starting from a conventional browser shell:

`local UTF-8 HTML -> Source Record -> tokens -> Document Tree -> Page Model -> headless JSON`

## Changed

- Added one detached project directory only.
- Added exact repository reconnaissance mapping.
- Added dependency-free source binding, tokenizer subset, tree builder subset,
  semantic Page Model, shared engine, and headless CLI.
- Added typed capability states, module contract, build/source manifests, five
  schemas, three fixtures, four goldens, focused tests, security boundaries,
  limits, roadmap, provenance, and local-intake handoff.
- Added no Foundation, Hub, registry, server, launcher, existing module, public
  discovery, or local-intake change.

## Checks observed in the working-chat runtime

| Check | Verdict | Evidence ceiling |
|---|---|---|
| `node --test tests/*.test.js` | PASS — 17/17 | Focused deterministic fixture behavior only. |
| `node scripts/verify-schemas.js` | PASS — 5 schema documents parsed; references and representative identities checked | Not full JSON Schema conformance. |
| `node scripts/build-source-manifest.js --verify` | PASS | File-byte integrity inside this detached package only; the manifest intentionally excludes itself and ZIP outputs. |
| `npm run verify` wrapper | BLOCKED by working-chat environment | The host classified the npm invocation as a network-related request. No dependency or network result was substituted; its three underlying offline Node commands passed separately. |
| Network URL refusal smoke | PASS | CLI returned typed `NETWORK_HELD`; no network request ran. |
| Browser render/click | NOT_RUN | No visual frontend exists. |
| Web Platform Tests | NOT_RUN | No standards-conformance claim. |
| Repository-wide `npm test` | NOT_RUN | Full repository was not checked out in this runtime. |
| Rust compile/test | NOT_RUN | Rust toolchain unavailable; production substrate decision remains held. |

After this report was frozen, the source manifest was regenerated and the full
focused verification sequence was rerun so the report bytes are included in the
verified manifest.

## What is proven

- The same library produces the typed tree and Page Model consumed by the CLI.
- Source bytes round-trip under an exact SHA-256/length binding.
- Repeated deterministic inputs produce identical canonical results and digests.
- Held script text is preserved as inert data and is not executed.
- Malformed input, duplicate attributes, unsupported elements, configured
  limits, invalid UTF-8, and network requests have visible outcomes in covered
  tests.

## What is not proven

Everything listed in `KNOWN_LIMITS.md`, including modern-web compatibility,
security isolation, CSS/layout/rendering, real browsing, accessibility parity,
visual quality, WPT conformance, Rust suitability, and Workshop integration.
