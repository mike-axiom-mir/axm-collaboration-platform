# Action Report — shared human/headless structure slice

Date: 2026-08-23  
Version: `0.3.0-experimental.1`  
Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

## Goal

Strengthen the existing offline semantic/headless proof with one digest-bound
projection shared by the human and AI surfaces, without creating a second
parser or claiming conventional browser behavior:

`bound local source -> shared semantic core -> Structure Index -> headless outline / Structure Layout -> Display List -> SVG / inert semantic HTML`

## Changed in this steward pass

- Preserved the original Source Record, Token Stream, Document Tree, Page Model,
  parser tests, and upstream reconnaissance checkpoint.
- Added a bounded, source-ordered Structure Index with stable entry references,
  semantic kinds, landmarks, summary counts, source/document/Page Model lineage,
  and a viewport-independent digest.
- Made the Structure Layout, Display List, Modification Ledger, headless
  `outline`, SVG, and HTML outputs derive from that same index.
- Replaced the SVG-only HTML wrapper with responsive native semantic HTML: a
  trusted same-document outline, landmark-aware reading cards, lineage and
  boundary receipts, and a collapsed deterministic SVG map.
- Added a typed Structure Index schema and golden plus cross-output lineage,
  viewport-invariance, safe-anchor, responsive-surface, and CLI outline tests.
- Kept original-page targets inert. The only active links in the generated
  snapshot are trusted `#document-map` and `#entry-*` anchors.
- Added explicit output overwrite, source-overlap, and symbolic-link refusals.
- Added a project-scoped LF checkout contract so byte-bound fixtures, goldens,
  examples, and the source manifest verify identically on Windows and POSIX.
- Hardened raw-text closing against Unicode offset drift and false tag-prefix
  matches, corrected the open-element nesting bound, and covered dangling
  final-component symbolic links.
- Added no Foundation, Hub, registry, server, launcher, existing module, public
  discovery, network, local intake, installation, promotion, or canon change.

## Checks observed in the working-chat runtime

| Check | Verdict | Evidence ceiling |
|---|---|---|
| `node --test tests/*.test.js` | PASS — 32/32 | Focused deterministic fixture behavior only. |
| `node scripts/verify-schemas.js` | PASS — 10 schema documents parsed; local references and representative identities checked | Not full JSON Schema conformance. |
| `node scripts/build-examples.js --verify` | PASS — 2/2 deterministic examples | Exact generator output only. |
| `node scripts/build-source-manifest.js --verify` | PASS after final regeneration | Package file-byte integrity only; manifest excludes itself and ZIP outputs. |
| JavaScript syntax check over every `*.js` file | PASS | Syntax only, not runtime coverage. |
| `npm run verify` convenience wrapper | PASS | Runs the focused tests, schema identities, deterministic examples, and source manifest; no network route is used. |
| Desktop browser render | PASS — generated HTML at 1280×900; 12 indexed entries, semantic cards, sticky outline, no horizontal overflow, zero scripts, zero forms, and only trusted same-document anchors | Local generated snapshot only; not arbitrary-page rendering. |
| Document-map click | PASS — selecting `Table summary Phase state` changed the hash to `#entry-0009`, scrolled the target into view, and applied its visible target treatment | Same-document navigation only; no original-page target activation or browsing-history claim. |
| Mobile browser render | PASS — generated HTML at 390×844; single-column document map and cards remained readable without horizontal overflow | One bounded mobile viewport; not general responsive conformance. |
| Network URL refusal | PASS | Typed `NETWORK_HELD`; no request ran. |
| Live page lifecycle, original-page navigation, and browsing history | NOT_RUN / HELD | The document-map anchor test is not evidence for a live browser lifecycle. |
| Web Platform Tests | NOT_RUN | No standards-conformance claim. |
| Repository-wide tests | NOT_RUN | Full repository was not checked out in this runtime. |
| Rust compile/test | NOT_RUN | Rust toolchain unavailable; production substrate remains held. |

The committed example and all goldens were regenerated from reviewed source,
then verified byte-for-byte. Temporary raster files used for visual inspection
are not part of the package or continuity handoff.

## What is proven

- Headless and visual outputs call the same engine and bind to the same source,
  document, Page Model, Structure Index, layout, and Display List lineage.
- The compact headless outline and responsive human document map expose the same
  stable entry references from the same Structure Index digest.
- Repeated deterministic inputs/options produce identical typed outputs and
  digests.
- The Modification Ledger records a derived view only, identical source
  before/after digests, no page-code execution, no network, and discard-based
  reversal.
- Script-like text and unsafe-looking URLs are escaped into inert visible text;
  remote media and forms are placeholders, not active controls. Generated
  document-map anchors navigate only within the trusted snapshot.
- Visual file writes are explicit and emit byte/digest receipts.

## What is not proven

Everything in `KNOWN_LIMITS.md`, including WHATWG/CSS conformance, site
rendering, live page lifecycle, original-page interaction and navigation,
accessibility parity, security isolation, hostile-web safety, WPT conformance,
host-independent pixel identity, production Rust suitability, and Workshop
integration.
