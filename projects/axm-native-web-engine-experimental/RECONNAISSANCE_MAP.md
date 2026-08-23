# Phase 0 repository map

Inspected repository: `mike-axiom-mir/axm-collaboration-platform`  
Inspected branch: `main`  
Checkpoint: `fd6ec98a6a98a6666a980c359730ccec57a8cbe9`  
Inspection date supplied by the working handoff: `2026-08-23`

This map records current source observations. It does not promote any surface,
and it does not claim runtime behavior beyond the named evidence.

## EXISTING

| Surface | Checkpoint evidence | Relevance |
|---|---|---|
| `launcher/axm-foundation.js` | blob `ff3c15fa9d950f12ef458140cd2133ace7aad5e0`; names `AXMStore`, `AXMWisdom`, `AXMIdentity`, `AXMConnect`, `AXMGate`, `AXMFriction`, `AXMTool` | Existing browser-facing spine; deliberately not imported into the detached parser. |
| `SECURITY.md` | blob `e53df5798426c70962afa0e3d4d25a747636cd0a` | Provider keys stay out of browser tools; network authority is separate and declared. |
| `docs/PORTS.md` | blob `15ff859f8f5653062346989e5ff311822994fbba` | Existing loopback/LAN ownership map; Phase 1 opens no listener. |
| `tools/browser-global-surface-observatory/` | README `30b7ab82750feba6f7568cb7f145b14eb89ef510`; contract `37bb189a7a6080246e9a948a396dca0680f6181e` | Static, non-executing browser-global analysis pattern. |
| `tools/browser-lan-hardware-qa-lab/` | README `7fd6ec88e962804e7490b4abad1667241a237a33`; contract `c3a08d9f69b2bc6b7acf12a74422f900ca71443d` | Bounded browser/device evidence and refusal pattern. |
| `shared/asset-hands/browser-3d-runtime/` | README `fc9f631e2163b98c680a7997da20728d52c07c02`; manifest `f9f340193245a581a5679e24ef8325951854c030` | Exact-digest, pinned local runtime assets; not a web engine. |
| `shared/native-host-adapters/` | README `490b7fc918ca3b74b42632da18f950584e44c270`; evidence `69c8ea647473bcb987d1b28ab47993b30a630907` | Capability selection, exact package trust, recovery, inspection, and rollback patterns. |
| `tools/shell-guardian/` | README `0dc906e7c971bbd1b7c9f6919a213e55da3b33c7`; contract `556e084387f42bc1d1877aee966ff70943ee1626` | Evidence/action boundary pattern; not coupled to this core. |
| `tools/discovery-engine/` | README `f45c7939d51c0d326359adcbd4fa7e4ffe3cbf16`; contract `d3ba747c5a7b7e5287d5bd0159031975397d606c` | Later explicit research/search handoff, not a search dependency. |
| `tools/evidence-desk/` | README `72cbb76bea2062b350f7ad031b19455cb906854f`; contract `bf8cbb956ca64d02b3377dcbb50288211faae507` | Typed claims, sealed receipts, and truthful delivery states. |
| `shared/sensorium/` | README `ac051dab7536f65903e6867bd8ed046fe9bfe01d`; receipt envelope `8f75baccf463fabc70383be594af3939e3eb5ff3` | Bounded machine-facing observations; raw-retention and authority patterns. |
| `shared/identity-shell-fabric/` | README `71f8a503adb4b98e2331fa12dd108c16a7526421`; contract `94377bf64b85d29a0fa20aa580ec43ff0e925ad9` | Confirms `identity shell != neural model != capability != body`; browser is a body/environment. |
| `mobile/` | README `365ff65e086fc936a232e9d8eed1153d847262a6` | Alternate body runs real modular Workshop rather than a flattened duplicate. |

## EXTEND

- Extend the established typed contract, exact digest, explicit refusal, and
  honest evidence language inside this new package.
- Extend the body-separation rule with the detached Structure Browser snapshot
  and headless body sharing the same engine lineage.
- Extend browser QA later with fixtures produced by this engine; this detached
  pass does not change the existing Lab.

## ADAPT

- Adapt native-host adapter manifest/recovery thinking for future network,
  decoder, and renderer boundaries.
- Adapt Evidence Desk and Sensorium receipt discipline for Source Records and
  headless results without claiming integrity proves truth.
- Adapt Shell Guardian's action classification later at navigation/download/
  local-authority seams without importing its process-kill behavior.
- Adapt the mobile precedent when an Android body exists; do not create a
  second parser for mobile.

## NEW

- `axm.web.source-record/v1`
- `axm.web.token-stream/v1`
- `axm.web.document-tree/v1`
- `axm.web.page-model/v1`
- `axm.web.headless-result/v1`
- `axm.web.structure-layout/v1`
- `axm.web.display-list/v1`
- `axm.web.modification-ledger/v1`
- `axm.web.artifact-receipt/v1`
- Offline tokenizer subset, stack-based tree builder, semantic Page Model,
  shared-core headless CLI, inert SVG renderer, and HTML Structure Browser
  snapshot.
- Bounded fixtures, malformed-input tests, goldens, schemas, manifests, action
  report, limits, roadmap, and local-intake handoff.

## HOLD

- Foundation, Hub, registry, server, launcher, public discovery, and existing
  module edits.
- Installation, local intake, promotion, merge, and canon.
- HTTP/HTTPS, redirects, cookies, cache, search providers, downloads, and tabs.
- CSS, cascade, site Layout Tree, site rendering, live window/UI, clicks,
  navigation, compositor, and host-independent pixel claims. The bounded AXM
  Structure Layout and static snapshots are the only visual proof in scope.
- JavaScript, WebAssembly, service workers, WebRTC, WebGPU, DRM, extensions,
  broad media, and local/LAN authority.
- WPT execution, established-engine differential tests, process sandboxing,
  OS isolation, and the final Rust substrate decision.
