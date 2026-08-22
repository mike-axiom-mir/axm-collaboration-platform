# Deterministic PBR Material Machine-to-Human Handoff

Machine route: `pbr-material-bake` v1.1.0 plus the non-generating
`deterministic-material-fabric` v1.0.0 gate. Both remain `TEST` and
candidate-only. Human lane owner: `tools/asset-material-sensory-workbench/**`.

## Public Node route

Create and edit both use the existing asynchronous Asset Hands route:

```js
await Hands.createAsync("pbr-material-bake", brief, { seed })
```

Edit sets `brief.operation_mode` to `edit` and supplies exactly one JSON source
whose `content_schema` and `metadata.schema` are
`axm.pbr-material-recipe/v1`. The recipe and both target-canvas dimensions must
carry the same size. The allowlisted recipe fields are `id`, `family`, `seed`,
`size`, and `normal_strength`; schema/version are fixed and authority must stay
`candidate-only`. Size is an integer from 32 through 512 and normal strength is
0.25 through 8. Every successful edit replaces all eight artifacts.

## Fail-closed gate and exact artifacts

The human surface must call `deterministic-material-fabric.gateResult` over the
whole `axm.asset-hand-result/v1`. It may bind only a `PASS` handoff whose source
result is `READY`, `technical.pass=true`, and
`validation_receipt.status=PASS`. A machine `HOLD` is diagnostic evidence, not
a sensory-review candidate.

Required artifacts are exactly:

| id / role | payload | schema | editable |
| --- | --- | --- | --- |
| `pbr-albedo-map` | PNG `dataUrl` | `PNG.1.0` | no |
| `pbr-normal-map` | PNG `dataUrl` | `PNG.1.0` | no |
| `pbr-orm-map` | PNG `dataUrl` | `PNG.1.0` | no |
| `pbr-emissive-map` | PNG `dataUrl` | `PNG.1.0` | no |
| `pbr-height-map` | PNG `dataUrl` | `PNG.1.0` | no |
| `pbr-material-preview` | PNG `dataUrl` | `PNG.1.0` | no |
| `editable-pbr-material-recipe` | JSON `text` | `axm.pbr-material-recipe/v1` | yes |
| `pbr-material-bake-receipt` | JSON `text` | `axm.pbr-material-bake-receipt/v1` | no |

Every PNG binds `metadata.sampling` with exact interpretation, transfer
function, channel semantics, and wrap mode. Albedo, emissive, and preview are
colour/sRGB; normal, ORM, and height are data/linear. The five material maps
repeat; the static preview clamps. Normal retains the exact OpenGL +Y convention
and ORM retains R=ambient occlusion, G=roughness, B=metalness. Legacy
`metadata.colourSpace` is compatibility text and must never override sampling.

The gate reports full PNG byte SHA-256 independently from short Asset Hand
transport digests. It also binds the recipe, sampling contract, operation,
result digest, artifact transport digests, and byte budgets. The loopback host
budget is at most 256 KiB request JSON and 12 MiB serialized response JSON.
`RESPONSE_BUDGET_EXCEEDED` is a typed failure.

## Safe human surface and transaction boundary

The separate human lane may render sphere/plane local lookdev, inspect raw maps
and packed ORM channels, change viewer light/exposure/background/UV tiling/map
toggles, compare A/B, and edit only the recipe allowlist. Height is raw/coherence
inspection only; it does not prove displacement or parallax. The static preview
is a reference comparison, never live-render evidence.

HOLD/FAIL regeneration must preserve the prior current result, A/B state, and
still-current review. A successful READY/PASS bind replaces all eight artifacts
transactionally and moves the prior receipt into append-only stale history.
When WebGL2 is unavailable, raw maps remain inspectable in `DEGRADED` mode but
`ACCEPT_FOR_TEST` must be disabled.

## Typed gaps and claim boundaries

- `HAND-PBR-EDIT-001`: **CLOSED AT TEST** by the v1.1 public create/edit route.
- `CONTRACT-PBR-SAMPLING-001`: **CLOSED AT TEST** by exact fail-closed sampling metadata and gate checks.
- `CONTRACT-PBR-HOST-BRIDGE-001`: owned by the separate human lane.
- `EVIDENCE-PBR-SENSORY-001`: machine checks do not prove visual usefulness, realism, beauty, intent, or approval.
- `EVIDENCE-PBR-RENDERER-PARITY-001`: local lookdev does not prove target-engine/material parity, IBL parity, or GLB binding.
- `EVIDENCE-PBR-DEVICE-001`: representative GPU and device performance remain unverified.
- `EVIDENCE-PBR-ACCESSIBILITY-001`: screen-reader and other assistive-technology journeys remain human/unknown.
- `EVIDENCE-PBR-CONFORMANCE-001`: no supplied external reference or independent image/material conformance proof exists.
- `EVIDENCE-PBR-PHYSICAL-SURFACE-001`: a display cannot prove manufactured, printed, or physical material behavior.

The hand, gate, and human receipt cannot install, bind, promote, canonize, or
grant aesthetic approval. Mike Tobi remains the merge and taste gate.
