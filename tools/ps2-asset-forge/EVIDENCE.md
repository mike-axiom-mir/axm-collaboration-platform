# Evidence — PS2 Asset Forge v0.2

Status: **technical PASS; human visual decision PENDING**.

| Claim | Evidence | Result |
| --- | --- | --- |
| Source catalog is local, CC0, unique, and digest-bound | `generated/source-catalog.json`, `generated/source-manifest.json`, `selftest.js` | PASS |
| The catalog is a source pool, not retained generated output | UI says `source parts`; recipe retention policy is memory-only and forbids automatic promotion | PASS |
| Storefront generation embeds authored surface/sign textures into GLB | `proof/exports/storefront-technical-proof.glb`: 28 meshes, 16 materials, 10 embedded textures/images | PASS |
| Pedestrian export retains usable rig and animation | `proof/exports/animated-pedestrian.glb`: 13 skins and 22 animation clips | PASS |
| Runtime needs no network | local imports and models only; catalog policy and selftest enforce it | PASS |
| Optional renderer polish is local, switchable, and defaults off | `post-process.mjs`, renderer-profile control, `proof/postprocess-ps2-native.jpg`, `proof/postprocess-ps3-preview.jpg`, and `selftest.js` | PASS (source, test, and matched live frames) |
| Saved PS3 organ source remains immutable provenance | staged intake digests and original ZIP SHA-256 `0c374578867f47eee6724267c598d2e8308e024d7ff1aadf31cdd233c3770e84` | PASS |
| Rejected previews cannot be exported | GLB button starts disabled and only the human approval action unlocks it | PASS |
| Street/storefront appearance meets Mike's desired floor | `proof/street-benchmark-final.jpg`, `proof/storefront-benchmark-final.jpg`, `proof/storefront-night-final.jpg` | PENDING — human decision only |

The two GLBs in `proof/exports` are retained as bounded technical evidence, not promoted Library assets. `storefront-technical-proof.glb` proves generated texture embedding; `animated-pedestrian.glb` proves skin and animation preservation.

## Live visual receipt — local post stack

- claim: switchable post processing changes only viewport presentation while preserving the asset-quality boundary and export gate
- surface / route: `http://localhost:8788/tools/ps2-asset-forge/index.html`
- viewport: 917 × 680 WebGL canvas inside a 1280 × 720 app frame
- baseline evidence: `proof/postprocess-ps2-native.jpg`, storefront, night, seed `tilburg-0405`, recipe `forge-97a206ea`
- action: select **PS3 Preview** without moving the camera or rebuilding
- expected visible change: restrained highlight bloom, vignette, and grain; no blank frame, major exposure shift, asset mutation, or unlocked export
- observed sequence: an initial r160 port failed dark, a color-space-only repair over-brightened, and the final linear half-float → ACES → display-color route matched the native exposure while adding bounded polish
- settled evidence: `proof/postprocess-ps3-preview.jpg`; same target, lighting, camera, seed, recipe, triangles, materials, and draw calls
- typed observation: profile changed `native → preview`; scene stayed legible; target badge remained `PS2 candidate`; Export GLB remained disabled
- verdict: PASS
- named seam: the failed intermediate frames were replaced and are not retained
- buffer digest: two selected JPEG proof frames; motion samples remained memory-only
- temporary paths deleted: none created
- cleanup complete: yes

Animation follow-up: with **PS2 Native** selected, two in-memory pedestrian frames 550 ms apart produced different SHA-256 digests while the UI reported 22 animations and Export GLB remained disabled. This proves visible frame change at that cadence, not frame-rate performance.

Verification commands:

```powershell
node --check tools/ps2-asset-forge/app.js
node --check tools/ps2-asset-forge/post-process.mjs
node tools/ps2-asset-forge/scripts/build-catalog.js
node tools/ps2-asset-forge/selftest.js
```
