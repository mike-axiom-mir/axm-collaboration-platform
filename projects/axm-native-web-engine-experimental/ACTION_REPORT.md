# Action Report — PR #44 native web stewardship pass

Date: 2026-08-23  
Version: `0.4.0-experimental.1`  
Status: `EXPERIMENTAL`  
Installed: `false`  
Promoted: `false`  
Canon: `false`

## Goal

Steward the rapidly stacked PR #44 browser work into a more trustworthy shared
human/headless substrate while keeping the current boundary explicit:

`held input -> deterministic plan or local bundle -> independently checked executor/session -> bounded evidence`

This pass does not merge the PR, promote a package, grant generated material
authority, or claim an arbitrary-site browser.

## Changed in this steward pass

- Reconciled the dedicated PR worktree to the then-current PR head and reviewed
  the newly stacked Browser Session, Live HTML Builder, Reference Lab, visual
  state, AI, search, and image-search surfaces as one moving-workspace lane.
- Reproduced two native Windows failures that the Ubuntu package job did not
  cover. Absolute drive locators such as `D:/...` were being classified as URI
  schemes before their query/path rules ran.
- Added a shared held-scheme predicate that excludes Windows drive locators,
  restoring absolute-local open behavior and the intended
  `HELD_QUERY_UNSUPPORTED` classification.
- Added a native `windows-latest` package job. It runs the complete package
  verifier, independent session/security/schema verifiers, JavaScript syntax
  checks, and Python helper compilation with the JSON Schema validator pinned.
- Made AI, web-search, and image-search executors revalidate request order,
  method, fixed headers, transport marker, endpoint policy, and credential
  reference before reading environment secrets or invoking transport. AI plans
  also revalidate each body digest.
- Kept built-in credential names as explicit adapter/provider defaults. A
  caller-selected alternative must match an exact executor-side
  `allowedSecretRefs` entry; SearXNG and Ollama cannot be changed into secret
  readers by re-digesting a plan.
- Changed AI and image-search response limits from post-buffer checks to
  streaming byte ceilings. Oversized streams are cancelled as soon as the bound
  is crossed.
- Strengthened the AI and image-search plan/query schemas and committed
  deterministic AI, search, and image-search plan goldens. The independent CI
  schema verifier now requires and validates all three plan artifact roots.
- Added negative tests for re-digested credential substitution, AI body drift,
  and oversized chunked responses that must stop pulling after cancellation.
- Updated the provider, Reference Lab, security, roadmap, limit, and package
  documentation so plan digests are not described as executor authorization.
- Re-ran the Live HTML Builder at desktop and mobile widths, then exercised the
  shared local Browser Shell navigation. The probe source stayed in memory, its
  script did not execute, external link/form/media targets stayed inert, and
  the fixture byte digest was unchanged after shutdown.
- Added no Foundation, Hub, registry, Workshop server, launcher, installation,
  promotion, merge, or canon change.

## Checks observed in the working-chat runtime

| Check | Verdict | Evidence ceiling |
|---|---|---|
| `node --test tests/*.test.js` | PASS — 124/124 | Deterministic fixture and injected-transport behavior; no live provider compatibility claim. |
| Focused native Windows regression tests | PASS — 7/7 across Browser Session and session guard | Native Windows paths in the committed focused corpus only. |
| `node scripts/verify-schemas.js` | PASS — 38 schema documents parsed; local references and representative identities checked | Identity/reference checks, not independent full JSON Schema conformance. |
| Plan golden comparison | PASS — AI, search, and image-search plans match their deterministic generators | Exact committed examples only. |
| `node scripts/build-examples.js --verify` | PASS — 2/2 deterministic examples | Exact generator output only. |
| `node scripts/build-source-manifest.js --verify` | PASS after final regeneration | Package file-byte integrity only; manifest excludes itself and ZIP outputs. |
| JavaScript syntax check over every package `*.js` file | PASS — 69 files | Syntax only, not runtime coverage. |
| `npm run verify` convenience wrapper | PASS | Package tests, schema identities, examples, and source manifest; no external network route. |
| Independent security sentinel | PASS — 38/38 | Static security invariants and its self-test corpus, not process isolation. |
| Independent session verifier | PASS — 134/134 | Committed session artifact and verifier self-tests only. |
| Independent Python JSON Schema validation | NOT_RUN locally — pinned `jsonschema` is not installed in this worktree runtime | The PR's Ubuntu and new native Windows CI jobs are the independent execution surface. |
| Live HTML Builder desktop | PASS — 1280×900, two-pane editor/preview, no horizontal overflow, no console warnings/errors | One local deterministic fixture and one in-memory probe. |
| Live HTML Builder mobile | PASS — 390×844, panels stacked to 367.2px with no horizontal overflow | One bounded mobile viewport; not general responsive conformance. |
| Live compiler inertness probe | PASS — seven semantic entries; page script did not execute; external link, form, and image became held text/placeholders | Runtime DOM observation of the trusted generated preview, not hostile-web isolation. |
| Shared Browser Shell journey | PASS — Home -> About fragment -> Back; address, title, history cursor, and enabled/disabled controls agreed; no console warnings/errors | Explicit local bundle only; not arbitrary-site or host-browser history. |
| Live host cleanup and source countercheck | PASS — both loopback listeners closed; `session-home.html` remained SHA-256 `162d0b283ab69f850597dbb84d134e43e5f8b73d611f4d4f1b148987b0a9a7f5` | Normal shutdown path and one fixture byte countercheck. |
| Repository-wide required checks | PASS — all ten root `AGENTS.md` commands exited 0; `verify.js` reported 0 FAIL and 43 tracked warnings | Compatibility with this checked-out tree, not resolution of the pre-existing warning inventory. |
| Live AI/search/image provider calls | NOT_RUN | No cloud credentials were read and no provider compatibility claim is made. |
| Web Platform Tests | NOT_RUN | No standards-conformance claim. |
| Rust compile/test | NOT_RUN | Production Rust substrate remains held. |

The deterministic examples and goldens were regenerated from reviewed source
and verified byte-for-byte. Temporary live browser tabs and loopback listeners
were closed; screenshots used for observation are not package evidence.

## What is proven

- Human and headless local navigation still derive from the same per-page
  parser, Page Model, Structure Index, stable entry references, and session
  state machine.
- Absolute Windows drive locators are no longer confused with URI schemes in
  the tested open and held-query paths.
- A valid plan digest alone cannot select a different credential, request
  shape, or AI body at executor time without failing the new executor-side
  checks.
- Oversized streamed AI and image-search responses stop at the configured byte
  ceiling in the injected chunked-response tests.
- The Live HTML Builder recompiles an in-memory draft into the trusted semantic
  renderer without executing source scripts or activating original page forms,
  media, or external links.
- The package remains detached, experimental, uninstalled, unpromoted, and
  unable to canonize itself.

## What is not proven

Everything in `KNOWN_LIMITS.md`, including WHATWG/CSS conformance, arbitrary
site-body rendering, persistent/crash-recoverable lifecycle, tabs, editable
page controls, accessibility parity, hostile-web/content-process isolation,
live provider compatibility, WPT conformance, host-independent pixel identity,
production Rust suitability, and Workshop integration.

The current browser is therefore `WORKING` for its bounded local semantic and
headless proof, `DEGRADED` for broad page rendering, and `BLOCKED` from hostile
web use until a real network broker, CSS layout/page-control surface, and
content-process isolation boundary exist.
