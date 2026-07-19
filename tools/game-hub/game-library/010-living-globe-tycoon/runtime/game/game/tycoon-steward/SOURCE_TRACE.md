# Source Trace

## v0.7 presentation extension

The v0.7 host retains the verified v0.6 rules and adds locally authored HTML,
CSS and UI-only JavaScript for the palace presentation. It adds no third-party
art, runtime asset or simulation timer. The Tycoon state/API identity remains
experimental v0.1.

## v0.6 integrated-copy extension retained

The Living Globe v0.6 artifact began from the verified v0.5 package and retains
this module's experimental v0.1 state/API identity. Newly authored local work in
this copy adds `core/emergence-patterns.js`, goal-aware scoring in
`core/emergence-engine.js`, explicit state decisions/migration, captured-memory
UI and eight tests. The v0.5 supply layer remains intact. No third-party code,
data or art was introduced, and no earlier artifact or Foundation repository
was edited.

## Foundation reference

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Default branch inspected: `main`
- Exact commit inspected: `5c367397590b24ad2b50645c4546bd0accd41893`
- Temporary reference checkout before read: clean (`git status --porcelain`
  returned no paths)
- Temporary reference checkout after the complete read/build pass: clean
  (`git status --porcelain` again returned no paths)
- Repository role: read-only design reference

## Repository files actually read

Foundation and verifier:

- `README.md`
- `AGENTS.md`
- `package.json`
- `verify.js`
- `verify.config.json`
- `hub/module-contract-verifier.js`

Current tool examples:

- `tools/discovery-engine/manifest.json`
- `tools/discovery-engine/module.contract.json`
- `tools/discovery-engine/README.md`
- `tools/discovery-engine/discovery-core.js`
- `tools/discovery-engine/selftest.js`
- `tools/geographic-market-map/manifest.json`
- `tools/geographic-market-map/module.contract.json`
- `tools/geographic-market-map/market-core.js`
- `tools/geographic-market-map/selftest.js`

Living-world boundaries:

- `worlds/living-globe/README.md`
- `worlds/living-globe/world.manifest.json`
- `worlds/living-globe/selftest.js`
- `worlds/living-globe/mirror-adapter.descriptor.json`
- `worlds/world-registry.json`

Shared output and Mirror references:

- `shared/output/README.md`
- `shared/mirror-core/docs/ADAPTER_GUIDE.md`
- `shared/mirror-core/docs/FUTURE_WORLD_INTEGRATION.md`
- `shared/mirror-core/docs/CONSENT_AND_PERMISSIONS.md`
- `shared/mirror-core/docs/MIRROR_PACKET_LIFECYCLE.md`
- `shared/mirror-core/core/utils.js`
- `shared/mirror-core/core/constants.js`
- `shared/mirror-core/journal/hash-chain.js`
- `shared/mirror-core/journal/event-journal.js`
- `shared/mirror-core/gate/proposal-lifecycle.js`

## Verified repository facts used

- Honest module labels are `EXPERIMENTAL`, `TEST`, `WORKING`, `CANON`, `SHELL`
  and `BROKEN`; canon requires Mike Tobi's explicit merge decision.
- Declared contracts use `axm.module-contract/v1` and require ID, version,
  provides, consumes, permissions, handoffs and refusing boundaries.
- Hub-module manifests declare `hubApiVersion`, permissions and explicit
  `uses`.
- A browser render/click test is separate from compilation and Node tests.
- The living globe is the owner of its state; games may not own or reset it.
- Its current Mirror seam is `DESCRIPTOR_ONLY`, disconnected, and has no live
  apply operation.
- Mirror adapters are narrow, versioned, allowlisted, revision-aware,
  consent-aware and proposal-first.
- Read, propose, approve and apply are separate authorities.
- Generated output begins as inbox/review material; creation is not publication
  or approval.
- Existing examples use stable key ordering, hash chains, explicit limitations,
  deep validation, recovery slots and append-only evidence patterns.

## Patterns reused, not code copied

- `axm.module-contract/v1` field structure.
- Manifest status, entry, type, risk, `uses` and truth-boundary conventions.
- Stable-key canonical serialization as an architectural pattern.
- Previous-hash/current-hash receipt chaining as an architectural pattern.
- Proposal/approval/application separation.
- Disconnected and proposal-only adapter modes.
- Explicit browser-local storage and user-download boundaries.
- No-fake-done language separating Node evidence from browser evidence.

## Code provenance

All JavaScript, HTML, CSS, JSON examples and documentation in this package were
newly authored for the Tycoon Steward Layer experiment. No source fragment was
copied from the repository. No living-globe implementation, renderer, state,
asset, manifest or descriptor was copied or imported.

The synchronous SHA-256 implementation follows the public SHA-256 algorithm and
was independently written for this dependency-free dual-environment package;
its output is checked against the standard `abc` vector.

## Protected paths

All v0.6 and v0.7 Tycoon edits were made inside this isolated package copy at
`game/tycoon-steward/`. No Foundation repository, earlier artifact, installation,
registry or production runtime was edited, moved, promoted, committed or pushed.
