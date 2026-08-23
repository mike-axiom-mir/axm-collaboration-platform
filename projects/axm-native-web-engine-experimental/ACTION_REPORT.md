# Action Report — shared local browser lifecycle slice

Date: 2026-08-23  
Version: `0.4.0-experimental.1`  
Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

## Goal

Advance the shared semantic/headless proof into the first state-owning local
Browser Shell without creating a second parser or navigation state machine and
without crossing the hostile-network/isolation boundary:

`explicit local file set -> shared engine per page -> Local Browser Bundle -> one Browser Session -> headless trace / loopback human shell`

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
- Added an explicitly authorized local multi-page bundle. Every page carries
  Source Record, Document Tree, Page Model, and Structure Index lineage; links
  resolve only within the caller's closed file set.
- Added the deterministic headless `session` command with typed activate,
  address, back, forward, reload, focus, and scroll actions; bounded history;
  visible held/no-op transitions; and a committed navigation golden.
- Added source-reparsing reload that preserves locator-derived history and emits
  before/after source digests plus a changed verdict for every allowed page.
- Added `serve-local`: an ephemeral `127.0.0.1` human Browser Shell over the
  same process-owned session object, with a capability path, Host/Origin and
  content-type refusals, bounded requests/timeouts, and one CSP-hash-bound AXM
  controller. Page-derived values are assigned only as DOM text.
- Added three typed session/host schemas, three navigation fixtures, focused
  lifecycle/host tests, and `LOCAL_BROWSER_SESSION_CONTRACT.md`.
- Added explicit output overwrite, source-overlap, and symbolic-link refusals.
- Added a project-scoped LF checkout contract so byte-bound fixtures, goldens,
  examples, and the source manifest verify identically on Windows and POSIX.
- Hardened raw-text closing against Unicode offset drift and false tag-prefix
  matches, corrected the open-element nesting bound, and covered dangling
  final-component symbolic links.
- Added no Foundation, Hub, registry, Workshop server, launcher, existing
  module, public discovery, external network intake, local intake, installation,
  promotion, or canon change.

## Checks observed in the working-chat runtime

| Check | Verdict | Evidence ceiling |
|---|---|---|
| `node --test tests/*.test.js` | PASS — 42/42 | Focused deterministic fixture and loopback-host behavior only. |
| `node scripts/verify-schemas.js` | PASS — 13 schema documents parsed; local references and representative identities checked | Not full JSON Schema conformance. |
| `node scripts/build-examples.js --verify` | PASS — 2/2 deterministic examples | Exact generator output only. |
| `node scripts/build-source-manifest.js --verify` | PASS after final regeneration | Package file-byte integrity only; manifest excludes itself and ZIP outputs. |
| JavaScript syntax check over every `*.js` file | PASS — 32 files | Syntax only, not runtime coverage. |
| `npm run verify` convenience wrapper | PASS | Runs the focused tests, schema identities, deterministic examples, and source manifest; no network route is used. |
| Static Structure View desktop | PASS — generated HTML at 1280×900; 12 indexed entries, semantic cards, sticky outline, no horizontal overflow, zero scripts, zero forms, and only trusted same-document anchors | Local generated snapshot only; not arbitrary-page rendering. |
| Static document-map click | PASS — selecting `Table summary Phase state` changed the hash to `#entry-0009`, scrolled the target into view, and applied its visible target treatment | Same-document navigation only; no page lifecycle or browsing-history claim. |
| Static Structure View mobile | PASS — generated HTML at 390×844; single-column document map and cards remained readable without horizontal overflow | One bounded mobile viewport; not general responsive conformance. |
| Desktop local Browser Shell | PASS — 1280×900; three-column shell, visible boundary/address/history/lineage, 12 Home entries, two enabled bundled targets, two disabled held targets, and no horizontal overflow | Explicit three-page local fixture bundle only. |
| Live local lifecycle journey | PASS — Home → About fragment → Back → Forward → Reload → same-document Features; address, history cursor, focus entry, scroll restoration, and reload count agreed after each action | Process-owned local session only; not host-browser history, persistence, or arbitrary-site navigation. |
| Human address boundary | PASS — entering `https://example.invalid/` produced visible `HELD_NETWORK`, retained the current page/history, and made no external request | One explicit external target; broader hostile URL corpus remains held. |
| Mobile local Browser Shell | PASS — 390×844; single-column shell, 365.2px content/history panels, usable controls, and no horizontal overflow | One bounded mobile viewport; not general responsive or accessibility conformance. |
| Live executable-DOM countercheck | PASS — one package-owned inline controller; zero anchors, forms, frames, images, or external-resource attributes; held link controls disabled; no browser console errors | DOM/runtime observation plus CSP/unit checks; not OS isolation evidence. |
| Loopback host cleanup | PASS — listener unreachable after the bounded live run | One normal shutdown path; crash recovery/fault injection not run. |
| Network URL refusal | PASS | Typed `NETWORK_HELD` for single-source CLI and `HELD_NETWORK` in local session; no external request ran. |
| Web Platform Tests | NOT_RUN | No standards-conformance claim. |
| Repository-wide tests | PASS — all ten commands required by the root `AGENTS.md` exited 0; `verify.js` reported 0 FAIL and 43 tracked warnings | This proves compatibility with the checked-out repository at this commit, not resolution of the repository's pre-existing warning inventory. |
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
- Human and headless local navigation use the same server-owned session state
  machine and the same per-page Structure Index lineage.
- Explicitly bundled local links, same-document fragments, bounded history,
  back/forward, allowlist-only address input, stable focus/scroll entry state,
  and reload reparsing behave deterministically for the committed fixtures.
- The loopback shell transport is constrained independently from page content;
  its active controller does not grant execution authority to page scripts.

## What is not proven

Everything in `KNOWN_LIMITS.md`, including WHATWG/CSS conformance, site
rendering, arbitrary or external-page navigation, persistent/crash-recoverable
lifecycle, tabs, editable page controls, accessibility parity, security
isolation, hostile-web safety, WPT conformance, host-independent pixel identity,
production Rust suitability, and Workshop integration.
