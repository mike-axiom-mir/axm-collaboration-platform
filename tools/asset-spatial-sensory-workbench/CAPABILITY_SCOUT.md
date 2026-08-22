# Spatial Sensory Capability Scout

Scout date: 2026-08-22. Status vocabulary is AXM status language.

| Capability | Before | After | Evidence / boundary |
| --- | --- | --- | --- |
| `asset.spatial.parametric.create-edit` | available | reused | Public `parametric-mesh@1.1.0` create/edit route |
| `asset.spatial.glb.project-binding` | missing consumer gate | available at TEST | `deterministic-spatial-handoff@1.0.0` reconstructs OBJ/GLB from the project |
| `asset.spatial-3d.sensory-review` | missing | available at TEST | Dynamic bounded WebGL2 delivery view with multi-angle journey |
| `asset.spatial.edit.human-control` | missing | available at TEST | Allowlisted host edit; project sole master; primitive indirect via brief |
| `asset.spatial.viewer-state.digest` | missing | available at TEST | Source-neutral viewer digest stales old review history |
| `asset.spatial.review.human.receipt` | missing | available at TEST | Explicit non-promoting decision after dynamic journey gate |
| `asset.spatial.normal-degeneracy.inspect` | unknown | available at TEST | Gate/renderer report exact zero-normal count; repair is labelled diagnostic |
| `asset.spatial.target-renderer.parity` | missing | missing | WebGL2 reference review is not a game/engine renderer |
| `asset.spatial.physical-scale.proof` | missing | missing | Metre grid is a reference, not real-world measurement proof |
| `asset.spatial.gamepad-xr.review` | missing | missing | Pointer/keyboard interaction does not prove controller/XR behavior |
| `asset.spatial.accessibility.conformance` | missing | missing | Keyboard controls and semantics do not prove assistive technology |
| `asset.spatial.aesthetic.approval` | human-required | human-required | Automation never records taste approval |
| `visual.capture.ephemeral-rolling-buffer/v1` | missing | missing | Repeated screenshots only; cadence/performance claims remain UNKNOWN |

## Reuse/build decision

Decision: **REUSE/COMPOSE**. No new synthesizer or Asset Hand was warranted.
The useful missing pieces were a narrow verification handoff and a separate
human sensory surface. Machine and human paths remain disjoint.

## Typed contract limits

- `CONTRACT-PARAMETRIC-EDIT-CONTROL-001`: **LIMITED** because primitive,
  dimensions and detail are brief/target-canvas driven.
- `CONTRACT-SPATIAL-GLB-MATERIAL-PARITY-001`: **LIMITED** because authoring
  fields outside the codec projection do not survive delivery.
- A low polygon ceiling can honestly produce `HOLD`; the prior candidate and
  review remain bound instead of being replaced.
