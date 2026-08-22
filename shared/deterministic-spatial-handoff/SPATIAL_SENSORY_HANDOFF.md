# Deterministic Spatial Machine-to-Human Handoff

Machine dependency: existing `parametric-mesh@1.1.0` plus
`shared/asset-hands/gltf-codec.js`. Machine gate:
`deterministic-spatial-handoff@1.0.0`. Status: `TEST`, candidate-only. Human
lane owner: `tools/asset-spatial-sensory-workbench/**`.

## Public route and authority

Create and edit use the exact synchronous public route:

```js
Hands.create("parametric-mesh", brief, { seed, createdAt, host })
```

Edit uses `operation_mode:"edit"` and exactly one `spatial-project` source whose
`content_schema` and `metadata.schema` are `axm.spatial.project/v1`. Only that
project is the edit master. OBJ is editable-but-lossy delivery text and must not
be mapped back into this v1 edit route.

The provider, codec, hand registry, Spatial Studio, shared tool index, and
sealed animation/audio/material lanes are outside this leaf's ownership.
Nothing installs, binds, promotes or canonizes an artifact.

## Exact gate profile

`gateResult(wholeResult)` accepts only the complete
`axm.asset-hand-result/v1` from `parametric-mesh@1.1.0` with `READY`,
`technical.pass=true`, `validation_receipt.status=PASS`, consistent create/edit
provenance, and candidate-only authority.

Required artifacts are exactly:

| id | role | MIME / format | payload | edit master |
| --- | --- | --- | --- | --- |
| `mesh-obj` | `triangulated-runtime-geometry` | `model/obj` / OBJ | `text` | no; lossy |
| `mesh-glb` | `runtime-scene-delivery` | `model/gltf-binary` / GLB | `dataUrl` | no |
| `spatial-project` | `editable-spatial-project` | `application/json` / JSON | `text` | yes |
| `mesh-preview` | `wireframe-preview` | `image/svg+xml` / SVG | `text` | no |

The current artifact has `metadata.geometryDerived=true` and `sampled=true`; it
does not contain a `static_proof_only` field. The gate emits
`preview.static_proof_only=true` and `dynamic_spatial_evidence=false` from that
exact contract. The dynamic human viewer must render `mesh-glb`, never use the
SVG as live spatial evidence.

The v1 project profile requires one visible, unlocked, root-level object and one
referenced material. Lights, keyframes, rigs, emitters, voxels, captures,
simulation/render receipts, exports and prior imports must be empty. The gate
reconstructs OBJ bytes and expected GLB POSITION/NORMAL/index streams from the
project; verifies GLB2 chunks, accessors, sequential TRIANGLES topology,
POSITION bounds, unit face normals or exact degenerate-face zero normals,
project id, triangle lineage, and projected
baseColor+opacity/metallic/roughness/doubleSided material fields.

The coordinate contract is right-handed, Y-up, metres; project rotations are
degrees. Object transforms, inflate and twist are baked into GLB vertex/normal
data. Request JSON is bounded to 1 MiB by the human host and serialized result
JSON to 8 MiB by the gate/host.

The handoff reports full SHA-256 for OBJ, GLB, project and SVG, separately from
short transport digests; canonical project digest; GLB summary and bounds;
coordinate system; encoded/omitted field ledger; budgets; and false sensory,
parity, physical-scale, controller, accessibility, conformance and taste claims.

## Safe edit semantics

The human surface may control target width/height/depth+unit and polygon budget
through the brief; object position/rotation/inflate/twist and projected material
baseColor/metallic/roughness/opacity/doubleSided through the project. Every
successful edit replaces all four artifacts transactionally. A failed/HOLD edit
must preserve the prior current candidate and current review.

Primitive selection is **not** a direct project-field contract. The provider
infers and overwrites primitive type from brief kind/title/purpose/style tags.
The host may expose a six-value primitive control only by building an
unambiguous brief for that value. The gate verifies the resulting project/GLB;
it does not claim direct source type preservation.

Do not expose emissive, cast/receive shadows, authoring camera, lights,
hierarchy, rigs, animation, UVs or textures as delivery-affecting v1 controls.

## Typed gaps and evidence seats

- `HAND-SPATIAL-3D-SENSORY-001`: human lane; close only AT TEST after live bounded render/interaction evidence.
- `CONTRACT-SPATIAL-HOST-BRIDGE-001`: human lane.
- `CONTRACT-PARAMETRIC-EDIT-CONTROL-001`: **LIMITED**; primitive/dimensions/detail are brief-driven.
- `CONTRACT-SPATIAL-GLB-MATERIAL-PARITY-001`: **LIMITED/open**; authoring fields listed above are omitted.
- `EVIDENCE-SPATIAL-TARGET-RENDERER-PARITY-001`: open.
- `EVIDENCE-SPATIAL-DEVICE-PERFORMANCE-001`: open.
- `EVIDENCE-SPATIAL-PHYSICAL-SCALE-001`: open.
- `EVIDENCE-SPATIAL-CONTROLLER-001`: mouse/keyboard cannot prove gamepad or XR.
- `EVIDENCE-SPATIAL-ACCESSIBILITY-001`: assistive-technology journey remains human/unknown.
- `EVIDENCE-SPATIAL-AESTHETIC-001`: Mike/human judgment required.
- `EVIDENCE-SPATIAL-CONFORMANCE-001`: no external glTF/render conformance claim.

Human acceptance requires a real dynamic view plus user-driven orbit, zoom and
multi-angle observation. Automation may prove the controls work; it cannot
grant `ACCEPT_FOR_TEST`, taste approval, promotion or canon.
