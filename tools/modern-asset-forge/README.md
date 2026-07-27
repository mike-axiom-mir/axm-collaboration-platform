# AXM Modern 3D Asset Forge v0.1

Phase 0 and Phase 1 are implemented as a new parallel module. The existing PS2 Asset Forge is untouched and still passes its own selftest. The machine now has pinned Blender, Khronos glTF Validator, Khronos KTX tools, a bounded Basis encoder, a deterministic `KHR_texture_basisu` binding hand, and matching local browser KTX2/meshopt decoders. The glTF Transform optimizer executes but remains explicitly degraded until its executable is bound into the reviewed substrate lock. Canonical delivery also still requires a real `.blend` source run and human visual approval.

This is executable foundation code, not a wrapper around a claim. It contains its own build contracts, portable path policy, GLB parser and metrics, process-isolated native stages, Blender export script, bounded BasisLZ encoder, immutable receipts, local server, and WebGL2 smoke viewer. Existing modular hands are reused only where they supply a real engine with explicit limits.

## Phase 0 result

- PS2 Forge baseline: 652 files, 19,369,590 bytes, 293 GLBs, 330 preview images, 291 catalog source parts across five packs.
- PS2 preservation: deterministic tree digest and six key-file digests; focused PS2 selftest passes.
- Asset Hands: 34 registered executable descriptors at service version 2.5.0; relevant GLB, KTX2, rig, material, geometry, UV, and DCC capabilities audited separately from native substrate availability.
- Contracts: build request, build receipt, asset manifest, capability inventory, source receipt, per-stage evidence, portable relative paths, and canonical-promotion denial.
- Capability verdict: `BLOCKED`, with typed `HAND`, `SUBSTRATE`, `EVIDENCE`, and `CONTRACT` gaps. No tools were installed.

See [phase0/capability-gap-report.json](./phase0/capability-gap-report.json), [phase0/evidence-matrix.json](./phase0/evidence-matrix.json), and [phase0/ps2-preservation-baseline.json](./phase0/ps2-preservation-baseline.json).

## Phase 1 stages

Every request keeps the full delivery target: `.blend` authoring truth → GLB export → Khronos validation → meshopt optimization → KTX2/Basis delivery → WebGL2 runtime smoke. Missing stages become `BLOCKED`; they are never relabelled as optional or silently substituted.

1. `source-integrity` hashes the source and records license/source metadata without retaining private absolute roots.
2. `blender-export` runs Blender headlessly with `scripts/blender-export.py`. A supplied GLB may enter diagnostic mode but cannot count as Blender or authoring-truth evidence.
3. `axm-glb-inspection` parses GLB v2 chunks and derives nodes, meshes, primitives, triangles, vertices, materials, textures, skins, animations, extensions, embedded bytes, and a draw-call upper bound. It explicitly does not claim Khronos certification.
4. `khronos-gltf-validation` runs the native validator with JSON stdout when that pinned substrate is available.
5. `meshopt-optimization` runs glTF Transform meshopt or gltfpack with process capture bounds. Unpinned overrides remain degraded even if they execute.
6. `ktx2-encode` performs real, bounded ETC1S/BasisLZ encoding and decoder validation for declared PNG textures.
7. `ktx2-gltf-integration` appends verified KTX2 bytes to the physical GLB buffer, binds each declared target texture through required `KHR_texture_basisu`, and removes fallback sources so a browser cannot silently pass on the old image.
8. `khronos-post-integration-validation` reruns the native Khronos glTF validator against the exact bound GLB.
9. `khronos-ktx-validation` runs `ktx validate --gltf-basisu` through the pinned Khronos KTX tools.
10. `browser-webgl2-smoke` produces a digest-bound plan. The live page starts the hash-verified Three.js r160 KTX2 and meshoptimizer decoders, loads the compressed GLB, renders frames, and writes a narrow receipt. It cannot approve visual quality.

`canonical_runtime_artifact_id` remains `null` and `canonical_delivery_emitted` remains `false` until all required stages and human visual review pass.

## Run locally

From the Workshop root:

```powershell
node tools/modern-asset-forge/cli.js capabilities
node tools/modern-asset-forge/selftest.js
node tools/modern-asset-forge/cli.js run --request tools/modern-asset-forge/examples/phase1-existing-glb-with-texture.request.json
node tools/modern-asset-forge/server.js
```

Open `http://127.0.0.1:8903/`. Prepared diagnostic jobs appear under Browser Proof. Job outputs default to `tools/modern-asset-forge/work/<relative-output-root>/`. A caller may supply a different local `--vault-root`; portable manifests retain only the request's relative output path.

The example processes one explicit GLB and, in the KTX2 rung, one explicit 512×512 PNG. It does not crawl, batch-download, or ingest an asset library.

## Current proven outputs

- Diagnostic GLB inspection: PASS on the PS2 storefront proof — 28 meshes, 28 primitives, 3,496 estimated triangles, 5,892 vertices, 16 materials, and 10 textures.
- Bounded texture delivery: PASS — the 512×512 source PNG became a 12,983-byte, 10-level ETC1S/BasisLZ KTX2 and passed the bundled decoder/transcode validation.
- Compressed GLB integration: PASS — the final 263,704-byte GLB requires `EXT_meshopt_compression`, `KHR_mesh_quantization`, and `KHR_texture_basisu`; post-integration Khronos validation reports 0 errors.
- Independent KTX validation: PASS through pinned Khronos KTX Tools 4.4.2.
- Compressed WebGL2 smoke: PASS — the local KTX2 and meshopt decoders loaded the required-extension GLB and rendered three frames, 28 meshes, and 3,496 estimated triangles.
- Canonical Phase 1 delivery: BLOCKED. No modern canonical GLB was emitted.

## Scope held for later phases

Not implemented: Poly Haven/ambientCG/Artaley connectors, scraping, whole-library download, LOD/HLOD generation, scene chunking, instancing policy, broad retargeting/morph/root-motion work, live cloth/hair, USD authoring/archive, WebGPU-only delivery, and automatic asset promotion.

The four workload modes are contract-visible: `cool_idle`, `authoring_interactive`, `batch_optimize`, and `heavy_compute`. This build records the selected policy but does not claim thermal, battery, RAM/VRAM peak, or sustained-throughput governance because no approved telemetry observer is connected.
