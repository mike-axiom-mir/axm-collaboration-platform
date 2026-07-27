# Modern Asset Forge evidence

## Claims proven

- **PS2 preservation — PASS.** `phase0/ps2-preservation-baseline.json` binds the complete original tree. `selftest.js` recomputes the digest and reruns the PS2 Forge selftest.
- **Modern schema and safety layer — PASS.** The shared module contract validates, path traversal and absolute vault paths are rejected, canonical builds require `.blend`, and automatic install/network claims remain false.
- **Real GLB inspection — PASS.** `work/phase1-existing-glb-20260722/receipts/axm-glb-inspection.json` is bound to source SHA-256 `afcb7802418930dee6f8b7a410f1c78ce401d4c6f8b728336e99f62458237222`.
- **Real bounded KTX2 engine — PASS.** `work/phase1-compressed-browser-proof-20260722/receipts/ktx2-bundled-validation.json` records 512×512, 10 mip levels, 12,983 bytes, BasisLZ, and decoder acceptance.
- **Uncompressed WebGL2 diagnostic smoke — PASS.** The browser receipt and live-visual receipt under `work/phase1-existing-glb-20260722/receipts/` bind the same GLB digest, explicit WebGL2 context, GLTFLoader completion, three rendered frames, visible mesh count, and orbit response.
- **KTX2-in-GLB binding — PASS.** `work/phase1-compressed-browser-proof-20260722/receipts/ktx2-glb-binding.json` binds texture 0 to the exact KTX2 digest, removes its legacy source, and requires `KHR_texture_basisu`.
- **Post-binding Khronos checks — PASS.** The bound GLB has 0 validator errors and each KTX2 passes pinned `ktx validate --gltf-basisu`.
- **Compressed WebGL2 runtime — PASS.** The browser smoke receipt binds GLB SHA-256 `18058c71fd5b4984252dd5f409d28c6dc28a988dcfec3ad4a89e706d2f6ef317`; KTX2 and meshopt decoders report ready, required extensions are observed, and three rendered frames contain 28 meshes and 3,496 estimated triangles.

## Claims disproven or blocked

- **Canonical Blender source/export — BLOCKED:** pinned Blender 5.2.0 is live, but this proof intentionally starts from an existing GLB and therefore cannot prove `.blend` authoring truth.
- **Meshopt optimizer assurance — DEGRADED:** glTF Transform executes and its output passes inspection, Khronos validation, and live decode, but its CLI remains outside the reviewed substrate lock.
- **Hardware telemetry governor — OPTIONAL GAP:** workload modes exist, but system performance measurement is not connected.
- **Visual quality approval — OPEN:** live load and orbit behavior passed, but code and browser receipts do not decide artistic quality.

## Verification commands

```powershell
node tools/ps2-asset-forge/selftest.js
node tools/modern-asset-forge/selftest.js
node verify.js
```

The files under `phase0/` are a sealed historical baseline and intentionally still describe the machine before substrate installation. Current truth comes from `node tools/modern-asset-forge/cli.js capabilities` plus the latest build and browser receipts.
