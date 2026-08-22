# Asset Sensory Workbench capability scout

Status: **TEST**

Overall route: **DEGRADED**. The bounded visual-motion route is executable; the
open-ended multi-sensory asset-factory objective is not universally supported.

## Requested outcome

AXM should create deterministic future assets, expose exact machine editing,
expose human sensory editing and review, keep both representations linked, and
return precise missing-capability reports instead of weak substitutes.

## Capability inventory

| Capability id | Status | Evidence / constraint |
| --- | --- | --- |
| `asset.result.ingest.deterministic-motion` | available | Exact Asset Hand id/version, READY/PASS and candidate-only gates in `core.js` |
| `asset.artifact-schema.bridge.checked` | available | `metadata.schema` must equal parsed JSON `schema`; mismatch fails closed |
| `asset.edit.machine.allowlisted` | available | Machine API uses the same bounded field definitions and digest lineage as the UI |
| `asset.edit.human.control` | available | Browser controls emit `axm.asset-sensory-edit/v1` operations |
| `asset.edit.derived-set.regenerate` | available | Edited composition re-enters the public Asset Hand and all seven derived artifacts are replaced |
| `asset.preview.visual-motion.live` | available | Bounded `requestAnimationFrame` player with play, pause, step and arbitrary-tick scrub |
| `asset.viewer.reduced-motion.adapt` | available | Explicit `disable-transform-motion` policy; source digest remains unchanged |
| `asset.viewer.high-contrast.adapt` | available | Viewer-only colour replacement; source digest remains unchanged |
| `asset.review.human.sensory.receipt` | available | Digest-bound, viewer-bound, non-promoting human receipt |
| `visual.capture.ephemeral-rolling-buffer/v1` | missing | Current browser surface exposes screenshots but no rolling buffer |
| `asset.audio.waveform.sensory-review` | missing | No waveform synthesis, playback or audible validation hand in this workbench |
| `asset.spatial-3d.sensory-review` | missing | No camera, depth, spatial, controller or renderer-parity review hand |
| `asset.aesthetic.approval.human` | human-required | A person, not a metric or technical receipt, must judge taste and intended-use fit |

## Companion handoff gap reconciliation

| Handoff gap | Current state |
| --- | --- |
| `HAND-LIVE-PLAYER-001` | Closed for the bounded local visual-motion player; wall-clock cadence remains unproved |
| `CONTRACT-ARTIFACT-SCHEMA-BRIDGE-001` | Closed by exact metadata/parsed-schema comparison and round-trip `content_schema` mapping |
| `CONTRACT-TEMPORAL-OBSERVATION-001` | Partially closed: receipt binds result, composition, bake, viewer and runtime; measured pacing is still absent |
| `EVIDENCE-FRAME-PACING-001` | Open |
| `CONTRACT-REDUCED-MOTION-001` | Closed for viewer strategy `disable-transform-motion`; no alternate source artifact is claimed |
| `EVIDENCE-ACCESSIBILITY-001` | Partially observed; assistive-technology coverage remains open |
| `CONTRACT-HUMAN-REVIEW-001` | Closed for `ACCEPT_FOR_TEST`, `REVISE` and `REJECT`; explicit viewer-state digest and stale history cannot promote or canonize |
| `EVIDENCE-AESTHETIC-001` | Open pending a real human decision |

## Missing hand contracts

```text
capability_id: visual.capture.ephemeral-rolling-buffer/v1
purpose: retain only a short moving window of live frames for cadence, loop and transition evidence
inputs and schemas: target surface, viewport, bounded duration, maximum byte budget
outputs and schemas: frame timestamps, selected proof frames, compact digest-bound observation receipt
side effects: temporary local capture only
permissions and consent: target-window visibility; no unrelated desktop capture
resource budget: bounded seconds and bytes, rolling eviction
failure and recovery behavior: return MISSING_CAPTURE or PARTIAL_CADENCE; never infer timing from stills
compatibility/version contract: browser and Windows visual backends declared separately
verification contract: known-motion fixture with timestamp and cleanup assertions
promotion gate: independent review plus explicit AXM merge decision
```

```text
capability_id: asset.audio.waveform.sensory-review
purpose: generate, play, pause, scrub and review bounded audible asset candidates
inputs and schemas: typed audio recipe, sample rate, channel layout, loudness and duration budgets
outputs and schemas: genuine audio container, editable recipe, playback receipt, human sensory receipt
side effects: local audio playback only after explicit user action
permissions and consent: audio-output permission and visible mute/stop control
resource budget: bounded duration, amplitude, file bytes and memory
failure and recovery behavior: mute/stop immediately and return MISSING_AUDIO_DEVICE or VALIDATION_FAIL
compatibility/version contract: codec, sample format and device path declared
verification contract: independent container parser plus observable playback and safety checks
promotion gate: human listening review and explicit AXM merge decision
```

```text
capability_id: asset.spatial-3d.sensory-review
purpose: review camera, depth, motion, scale, material and controller perception for 3D assets
inputs and schemas: GLB/OpenUSD scene, target camera, renderer, lighting and control contract
outputs and schemas: bounded interaction receipt, renderer identity, human sensory observations
side effects: local rendering and reversible camera/controller state
permissions and consent: graphics runtime and input-device access
resource budget: triangle, texture, shader, memory and frame-time ceilings
failure and recovery behavior: stop rendering and return typed renderer/substrate/evidence gaps
compatibility/version contract: renderer, GPU path and engine adapter versions declared
verification contract: repeated live frames, interaction journey and independent structure validation
promotion gate: representative-device review and explicit AXM merge decision
```

Cheapest next tests: add bounded frame timestamps to a real capture hand; run a
screen-reader journey; ask Mike to review one named candidate; admit audio or 3D
only when a real blocked asset request supplies its target canvas.
