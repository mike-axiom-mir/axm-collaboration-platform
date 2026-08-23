# Action Report — final detached steward pass

Date: 2026-08-23  
Version: `0.2.0-experimental.1`  
Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

## Goal

Strengthen the existing offline semantic/headless proof and add the first honest
human-visible AXM body without creating a second parser or claiming conventional
browser behavior:

`bound local source -> shared semantic core -> Structure Layout -> Display List -> headless / SVG / inert HTML`

## Changed in this steward pass

- Preserved the original Source Record, Token Stream, Document Tree, Page Model,
  parser tests, and upstream reconnaissance checkpoint.
- Added a bounded source-ordered Structure Layout, renderer-neutral Display
  List, deterministic Modification Ledger, SVG renderer, and inert HTML
  Structure Browser snapshot.
- Added headless `layout` and `display` commands plus explicit-write
  `render-svg` and `browser-snapshot` commands.
- Added four typed schemas, an adversarial output-escaping fixture, three new
  goldens, two committed deterministic examples, structure/visual tests, and a
  dedicated Structure View contract.
- Added explicit output overwrite, source-overlap, and symbolic-link refusals.
- Added no Foundation, Hub, registry, server, launcher, existing module, public
  discovery, network, local intake, installation, promotion, or canon change.

## Checks observed in the working-chat runtime

| Check | Verdict | Evidence ceiling |
|---|---|---|
| `node --test tests/*.test.js` | PASS — 27/27 | Focused deterministic fixture behavior only. |
| `node scripts/verify-schemas.js` | PASS — 9 schema documents parsed; local references and representative identities checked | Not full JSON Schema conformance. |
| `node scripts/build-examples.js --verify` | PASS — 2/2 deterministic examples | Exact generator output only. |
| `node scripts/build-source-manifest.js --verify` | PASS after final regeneration | Package file-byte integrity only; manifest excludes itself and ZIP outputs. |
| JavaScript syntax check over every `*.js` file | PASS | Syntax only, not runtime coverage. |
| `npm run verify` convenience wrapper | BLOCKED before execution by the working-chat host's network classifier | Its four exact offline Node commands passed separately; no network result was substituted. |
| Wide static visual inspection | PASS — committed simple SVG rasterized at 1120×1138; hierarchy, seven cards, and boundary labels visible without clipping | One still image; no motion or click claim. |
| Narrow adversarial static inspection | PASS — adversarial SVG rasterized at 640×906; script-like text, unsafe-looking URL, remote media, and form stayed visibly inert without clipping | One still image; no arbitrary-page or host-pixel claim. |
| Network URL refusal | PASS | Typed `NETWORK_HELD`; no request ran. |
| Live browser/navigation/click | NOT_RUN / HELD | Static Structure Browser snapshot only. |
| Web Platform Tests | NOT_RUN | No standards-conformance claim. |
| Repository-wide tests | NOT_RUN | Full repository was not checked out in this runtime. |
| Rust compile/test | NOT_RUN | Rust toolchain unavailable; production substrate remains held. |

The committed example and all goldens were regenerated from reviewed source,
then verified byte-for-byte. Temporary raster files used for visual inspection
are not part of the package or continuity handoff.

## What is proven

- Headless and visual outputs call the same engine and bind to the same source,
  document, Page Model, layout, and Display List lineage.
- Repeated deterministic inputs/options produce identical typed outputs and
  digests.
- The Modification Ledger records a derived view only, identical source
  before/after digests, no page-code execution, no network, and discard-based
  reversal.
- Script-like text and unsafe-looking URLs are escaped into inert visible text;
  remote media and forms are placeholders, not active controls.
- Visual file writes are explicit and emit byte/digest receipts.

## What is not proven

Everything in `KNOWN_LIMITS.md`, including WHATWG/CSS conformance, site
rendering, live browsing, interaction, navigation, accessibility parity,
security isolation, hostile-web safety, WPT conformance, host-independent pixel
identity, production Rust suitability, and Workshop integration.
