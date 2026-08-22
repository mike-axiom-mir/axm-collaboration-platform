# Deterministic Animation Fabric Evidence Route

Status: `TEST`

This receipt is scoped to the additive deterministic-animation increment. It is
not a claim that every animation or asset-production requirement is now solved,
and it does not canonize or promote the implementation.

```text
fixed_tick_sampling_is_repeatable:
claim: one normalized recipe sampled at an arbitrary integer tick returns the same fixed-point values across repeated and separate Node processes
kind: deterministic behavior
risk: high
pass_condition: the fixture recipe and bake retain their locked digests and a child Node process reports the same recipe digest
primary_surface: shared/deterministic-animation-fabric/selftest.js
counterevidence: digest drift, fractional tick acceptance, floating-point output in the bake, or cross-process disagreement
observed_evidence: PASS; recipe fnv1a32:553e327b and bake fnv1a32:f744814a
verdict: PASS
named_seam: FNV-1a is an integrity/change detector, not a cryptographic authenticity proof

modular_graph_and_blocks_work:
claim: bounded data-only nodes and reusable blocks compose constants, keyframes, waves, held seeded noise, arithmetic, clamp, remap, and absolute-value operations without dynamic code execution
kind: runtime behavior and boundary
risk: high
pass_condition: focused assertions cover the node DAG, custom and built-in blocks, deterministic variants, cycle/refusal paths, and bake bounds
primary_surface: shared/deterministic-animation-fabric/selftest.js
counterevidence: graph-cycle acceptance, unbounded bake, unseeded variation, dynamic script evaluation, or a node result outside its declared fixed-point contract
observed_evidence: PASS
verdict: PASS for the implemented node vocabulary
named_seam: no spline, skeletal rig, inverse-kinematics, particle simulation, physics, audio, or GPU shader evaluator is claimed

procedural_motion_adapter_is_explicit:
claim: an axm.procedural-motion/v1 source can be converted into the fixed-tick recipe contract while recording its normalization loss
kind: semantic conversion
risk: medium
pass_condition: adapter assertions preserve supported tracks and record named-easing normalization rather than claiming exact parity
primary_surface: shared/deterministic-animation-fabric/selftest.js
counterevidence: silent dropping of a supported track or a claim of exact named-easing parity
observed_evidence: PASS; named easing is declared normalized to smoothstep
verdict: PASS WITH DECLARED LOSS
named_seam: visual parity with every historical procedural-motion consumer remains UNKNOWN

asset_fabric_route_produces_bounded_candidates:
claim: a procedural-animation need routes to the Deterministic Animation Fabric Hand and yields an editable composition, primary recipe, fixed-point bake, CSS, SVG atlas, sprite-atlas manifest, SVG filmstrip, and technical verification artifact while preserving the separate APNG route
kind: integration behavior
risk: high
pass_condition: exact-route integration tests verify eight artifacts, deterministic repetition, recipe and composition edit continuity, atlas coverage, generation bounds, browser load order, and the unchanged animated-raster route
primary_surface: shared/asset-hands/deterministic-animation-fabric-selftest.js and tools/asset-fabric/selftest.js
counterevidence: wrong hand selection, missing artifact, nondeterministic repeat, procedural-animation taking the APNG route, APNG regression, or provider load failure
observed_evidence: PASS; integration selftest PASS and Asset Fabric 34 PASS / 0 FAIL
verdict: PASS
named_seam: outputs remain candidate artifacts with installed:false, promoted:false, and canonical:false

clip_layers_remap_and_blend_deterministically:
claim: embedded recipe clips can be trimmed, offset, played at a positive rational rate, clamped, looped or ping-ponged, property-filtered, retargeted and combined through explicitly ordered replace/add/multiply fixed-point blends
kind: deterministic behavior
risk: high
pass_condition: held-input assertions prove exact half-speed source-tick selection, ping-pong mapping, additive fixed-point arithmetic, arbitrary-tick repeatability, bounds/refusals and a fresh-process composition digest
primary_surface: shared/deterministic-animation-fabric/selftest.js
counterevidence: call-order dependence, floating-point sample drift, layer-order ambiguity, bad source acceptance, out-of-range weight acceptance, or cross-process digest disagreement
observed_evidence: PASS; locked composition digest fnv1a32:d11e6e38 and bake digest fnv1a32:a29cd768 reproduced in-process and in a fresh Node process
verdict: PASS
named_seam: embedded source events are not implicitly time-remapped; composition events are explicit and the verification receipt declares this loss

sprite_atlas_covers_every_baked_frame_within_bounds:
claim: a composition of at most 256 frames and 16777216 logical pixels can emit a deterministic SVG atlas plus axm.sprite-atlas/v1 manifest with one cell record per baked frame
kind: deterministic artifact generation and static structure
risk: high
pass_condition: repeated atlas bytes match, the manifest frame count and records equal the bake, the last frame is represented, source bake digest is bound in SVG metadata, and frame 257 is refused
primary_surface: shared/deterministic-animation-fabric/selftest.js plus shared/asset-hands/schema-contract-selftest.js
counterevidence: omitted or duplicated cell, changed repeated bytes, unresolved atlas schema, missing bake binding, or over-boundary acceptance
observed_evidence: PASS; 60/60 cells emitted, frame-0059 present, core frame 257 refused, an explicitly requested non-pixel atlas returned HOLD with sprite-atlas-boundary FAIL instead of silently omitting it, and 129 shared schemas resolved
verdict: PASS
named_seam: the atlas contains generic deterministic presentation geometry; it is not rasterization parity or authored sprite-art quality proof

schemas_and_browser_scripts_are_wired:
claim: the three new contracts resolve in the shared schema registry and the browser entrypoint loads the core and hand in a compilable order
kind: static structure
risk: medium
pass_condition: schema-contract and HTML-script suites exit zero after the final preview change
primary_surface: shared/asset-hands/schema-contract-selftest.js and tests/html-script-syntax-test.js
counterevidence: unresolved local schema, syntax failure, wrong script order, or missing provider registration
observed_evidence: PASS; 128 schemas resolved; HTML suite 55 PASS / 0 FAIL; Asset Fabric compiled 90 local scripts
verdict: PASS
named_seam: compilation is not a browser interaction or render proof

filmstrip_preview_is_visible_in_the_live_asset_fabric:
claim: the in-app Asset Fabric can select a procedural-animation need with recipe, composition and sprite-atlas requirements, name the compatible hand, generate a v1.1.0 candidate, and display its deterministic SVG filmstrip even though JSON remains the primary downloadable artifact
kind: live interaction and visual appearance
risk: medium
pass_condition: a bounded browser journey shows the selected 96x96 need, compatible-hand chip, TECH PASS candidate, and a loaded 576x396 SVG preview without a no-preview fallback
primary_surface: in-app browser at http://127.0.0.1:8788/tools/asset-fabric/ with semantic locators and screenshots
counterevidence: blank preview, no compatible hand, generation failure, no-preview fallback, or console error during the journey
observed_evidence: PASS at a 1265x720 desktop viewport on 2026-08-22; Layered Motion Atlas Proof v0 displayed a loaded 576x396 filmstrip, TECH PASS, the compatible-hand label, v1.1.0 provider label, JSON download and hand-result metadata download
verdict: PASS for the stated static journey
named_seam: live temporal playback, frame pacing, CSS animation timing, responsiveness, screen-reader use, and human aesthetic approval were not observed and remain UNKNOWN

human_sensory_handoff_matches_the_live_asset_package:
claim: a separate human editing/review surface has an exact, non-promoting handoff for the eight current Asset Hand artifacts, static preview semantics, digest families, safe composition edits, output-to-input schema mapping, deterministic scrubbing inputs, viewer-state-bound human receipts, and unresolved sensory gaps
kind: contract mapping and integration behavior
risk: high
pass_condition: a generated v1.1.0 Asset Hand result matches every documented artifact id/role/editability/schema route, the filmstrip is marked static proof, a composition returned through source_artifacts with metadata.schema mapped to content_schema reproduces the same composition and bake digests, every HAND/CONTRACT/EVIDENCE gap remains named, and the proposed human review seam binds exact viewer state without mutating source digests
primary_surface: shared/deterministic-animation-fabric/human-sensory-handoff-selftest.js and shared/deterministic-animation-fabric/HUMAN_SENSORY_HANDOFF.md
counterevidence: artifact drift, treating CSS or SVG as canonical source, losing content_schema on edit, preserving a stale receipt after an edit, calling the filmstrip live playback, or converting technical PASS into aesthetic approval
observed_evidence: PASS; 8 exact artifacts, static-preview truth, schema bridge, same-digest composition round trip, 8 typed gaps, and explicit viewer-state binding
verdict: PASS for the current machine-to-human contract handoff
named_seam: live playback, frame pacing, reduced-motion behavior, assistive interaction, and human aesthetic approval are still unimplemented or unobserved and are not upgraded by this documentation test

workshop_regression_checks_hold:
claim: the additive seam does not break the Workshop checks required by AGENTS.md
kind: regression
risk: high
pass_condition: all ten required commands exit zero after the final code change
primary_surface: the commands listed in the repository AGENTS.md
counterevidence: any nonzero exit or new failure
observed_evidence: PASS on 2026-08-22; verify, five Hub checks, HTML syntax, Tool Forge package, Agent Tool Forge, and Evidence Desk all exited zero; verify-plus remained VERIFIED_WITH_LIMITS because of its pre-existing profile warnings
verdict: PASS for command exits; VERIFIED_WITH_LIMITS remains the Workshop-wide verification-spine label
named_seam: the wider dirty worktree belongs to concurrent/user work and is not attributed to this lane
```

## Promotion boundary

The implementation is `TEST`. It stays `installed: false`, `promoted: false`,
and `canonical: false`. Human visual review and an explicit Mike Tobi / AXM
merge decision remain required before any stronger status.
