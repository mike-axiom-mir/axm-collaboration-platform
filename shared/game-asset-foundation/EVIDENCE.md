# Game Asset Foundation rejected-candidate evidence route

Evidence captured on 2026-07-19 for a technical candidate that Mike rejected as visually below the required floor. Its generated export directories and ZIP files were removed after rejection; this bounded record remains so the same mistake is not promoted or repeated. The replacement route is `tools/ps2-asset-forge`.

## Atomic claims

| Claim | Evidence surface | Verdict | Boundary |
|---|---|---:|---|
| The pack contains the five required visual families. | Manifest structure plus focused self-test | PASS | 4 buildings, 4 roads, 6 props, 4 vehicles, 2 characters |
| Every visible asset has a strict descending three-step LOD chain inside its budget. | Geometry generation and assertions over all 60 OBJ outputs | PASS | Structural/technical quality only |
| Representative static families reach real runtime containers. | Asset Hand receipts plus GLB, PNG and KTX2 structural decoders | PASS | One representative bake per static family in default mode |
| Character and navigation routes are real. | Rigged GLB inspection, animation inspection, collision/navigation result checks | PASS | Three-joint rigs and planar navigation; no IK/root motion/Recast certification |
| A human can identify the generated families visually. | Original-resolution 1000×800 contact-sheet observation | PASS | Silhouette/readability, not professional art approval |
| One geometry library supports visibly distinct day, dusk, night and rain looks. | Four decoded atlases plus four original-resolution rendered contact sheets | PASS | 80 geometry/style combinations; not 80 unique meshes |
| The standalone preview changes assets and responds to camera input. | Live local browser at 1280×720, semantic snapshots and repeated screenshots | PASS | Local Canvas renderer only |
| The pack imports and behaves correctly in a native game engine. | No native runtime was executed | UNKNOWN | Optional missing capability: `asset.game.native-engine.validate` |
| The assets equal the finished visual quality of a named commercial game. | No valid evidence route exists for that claim | REFUSED | Target is comparable technical scope, not copied art or commercial equivalence |
| The rendered candidate meets Mike's PS2/GTA3-era visual floor. | Direct human review of the contact sheets and composed scene | **FAIL** | Rejected as Paint-level; promotion forbidden |

## Live visual receipt

```text
claim: standalone preview exposes all assets, changes selection and responds to camera drag
surface / route: http://127.0.0.1:8899/preview/index.html (isolated local proof server)
viewport / device / seat: 1280x720 desktop browser
baseline evidence: apartment-midrise selected, 212 TRI, Canvas render visible
action: select VEHICLE · taxi; pause; drag horizontally across Canvas
expected visible change: selector and statistic become taxi/188 TRI, then vehicle viewing angle changes while selection remains stable
observed sequence: apartment frame -> taxi front/side frame -> paused state -> rotated taxi three-quarter frame
typed observation: selector contained 20 named assets; selected taxi was visible; SPIN state proved pause; post-drag vehicle silhouette and face orientation differed; no browser warnings/errors; the final pack preview is byte-identical to the observed preview (SHA-256 CDF075939A5AC5D36F526A7ADA450F474D0A524DB5B97FC91C5B10E8F5E5628B)
verdict: TECHNICAL PASS / HUMAN VISUAL FAIL
named seam: the renderer and authored forms did not meet the requested presentation floor
buffer digest: baseline 4715c470dd922c0ab2ab41d4fabf1a994b650d1835a28b1f374305ec24a6eecd; paused 2f3d6af51c5b08053418ed7f6975f02496f594febcc038f595b7ab07401dd145; rotated 2110495ad8d45119a25ffc27339ad876b280047763193185682ab01d684846f0
temporary paths deleted: no raw capture paths were created; frames stayed ephemeral
cleanup complete: yes; rejected generated packs removed from exports/game-assets
next cheapest test: use the real WebGL/GLB PS2 Asset Forge route and obtain a new human visual verdict
```

## Reproduce

```powershell
node shared/game-asset-foundation/selftest.js
node shared/game-asset-foundation/cli.js --out <new-or-empty-directory> --zip --seed urban-proof-20260719
```
