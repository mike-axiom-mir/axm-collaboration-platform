# Deterministic UI Machine-to-Human Handoff

Status: `TEST`, candidate-only. Machine provider: `ui-component@1.2.0`.
Machine gate: `deterministic-ui-fabric@1.0.0`. Human owner:
`tools/asset-ui-sensory-workbench/**`.

## Public route and edit master

Create and edit use the synchronous CommonJS route:

```js
Hands.create("ui-component", brief, { seed, createdAt, host })
```

Edit requires `operation_mode:"edit"` and exactly one source artifact:
`ui-recipe` / `editable-ui-recipe` / `application/json` / JSON / editable,
with both `content_schema` and `metadata.schema` equal to
`axm.ui-component-recipe/v1`. Omit or recompute the old transport digest after
editing its text. `ui-recipe` is the sole Asset Hand regeneration master.
`ui-source` and `ui-metadata` remain downstream/manual artifacts and cannot be
mapped back into this v1 edit route.

Create derives a bounded focus-ring colour/width from palette and component
size. Once a recipe is bound, an explicit edit may change
`target.focus_ring.{colour,width}`. No value is encoded in brief prose.

## Exact artifacts and gate output

`gateResult(wholeResult)` accepts only READY, `technical.pass=true`, validation
PASS, candidate-only results from the exact hand/version. It requires:

| id | role | MIME / format | edit master |
| --- | --- | --- | --- |
| `ui-source` | `editable-source` | `image/svg+xml` / SVG | no |
| `ui-metadata` | `runtime-metadata` | `application/json` / JSON; `axm.ui-component-spec/v1` | no |
| `ui-recipe` | `editable-ui-recipe` | `application/json` / JSON; `axm.ui-component-recipe/v1` | yes |

The handoff schema is `axm.deterministic-ui-handoff/v1`. It reports result and
canonical recipe digests; every transport digest; full SHA-256 and byte size
for all three artifacts; target, four-state, nine-slice and requested/effective
token contracts; contrast-normalization warnings; the static-preview boundary;
256 KiB request and 2 MiB response budgets; candidate-only authority; and
explicit false sensory/parity/approval claims.

The SVG gate requires a bounded root, exact dimensions/viewBox, accessible
label and direction; unique IDs and resolved local-fragment references. It
rejects scripts, foreignObject, iframe/object/embed, event attributes, external
href/src, data/http/file resources, CSS imports, and non-local `url(...)`.
The approved consumer route is inert image decode plus canvas draw, never SVG
DOM injection.

Typed gate failures include `RESULT_NOT_REVIEWABLE`,
`ARTIFACT_ENVELOPE_MISMATCH`, `RECIPE_INVALID`,
`RECIPE_BINDING_MISMATCH`, `METADATA_INVALID`, `SVG_UNSAFE`,
`SVG_STRUCTURE_MISMATCH`, `NINE_SLICE_INVALID`,
`STATE_CONTRACT_MISMATCH`, `TOKEN_CONTRACT_MISMATCH`,
`RESPONSE_BUDGET_EXCEEDED`, and `AUTHORITY_VIOLATION`.

## Safe round-trip and human boundary

The v1 recipe allowlist covers title, kind, UI/screen/game-world medium,
1..8192 px dimensions, transparency, four requested palette roles, contrast
minimum, inset/radius/four nine-slice edges, opacity/scale for all four states,
pointer/keyboard/touch/gamepad modality declarations, direction, reduced
motion, minimum target size, alternative-text requirement, focus visibility,
and focus-ring colour/width. Authority is immutable. Reduced motion requires
every state scale to equal 1. Geometry and nine-slice values must leave positive
inner/centre dimensions.

Every successful edit returns a complete three-artifact candidate. The human
host must replace the current candidate only after the new result passes this
gate. Any exception, HOLD or gate FAIL preserves the prior candidate, A/B state
and current review and appends diagnostics only.

The human host is limited to 127.0.0.1, same-origin JSON, no filesystem writes,
request bodies at most 256 KiB and serialized responses at most 2 MiB. It calls
the exact public route and this leaf's `gateResult`. Missing provider/gate state
must be visibly read-only `DEGRADED`.

Static SVG is not state, focus, responsive, nine-slice or input evidence. The
trusted local wrapper may apply gated metadata and observe all four states,
raw plus original/stretched nine-slice, 100/200% zoom, light/dark backgrounds,
safe area, pointer, keyboard focus and reduced-motion behavior. Simulated
gamepad remains labelled simulated. Automation may prove machinery, never
record human approval.

## Typed gaps and evidence seats

- `HAND-UI-EDIT-001`: closed only AT TEST by the public recipe edit route.
- `CONTRACT-UI-RECIPE-001`: closed only AT TEST by registered schema + gate.
- `CONTRACT-UI-HOST-BRIDGE-001`: human lane.
- `HAND-UI-INTERACTIVE-PROTOTYPE-001`: human trusted-wrapper lane, not source SVG.
- `EVIDENCE-UI-STATE-JOURNEY-001`: human browser evidence required.
- `EVIDENCE-UI-INPUT-DEVICE-001`: physical touch/gamepad remains unknown.
- `EVIDENCE-UI-ACCESSIBILITY-001`: screen-reader/AT evidence remains unknown.
- `EVIDENCE-UI-TARGET-RUNTIME-PARITY-001`: browser wrapper is not native/engine parity.
- `EVIDENCE-UI-DEVICE-PERFORMANCE-001`: representative cadence/performance remains unknown.
- `EVIDENCE-UI-LOCALIZATION-001`: localization/text shaping remains unknown.
- `EVIDENCE-UI-DISPLAY-ZOOM-001`: physical display/zoom remains unknown.
- `EVIDENCE-UI-AESTHETIC-001`: Mike/human judgment required.
- `EVIDENCE-UI-CONFORMANCE-001`: external conformance remains unknown.

No output installs, promotes, canonizes, or grants `accept-candidate`.
