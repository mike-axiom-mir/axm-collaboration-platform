# Evidence ledger

Status: accepted after P0 integration polish on 2026-07-19.

## Automated evidence

- `node selftest.js` passes 76 checks over building, vehicle, foliage, and animated-character fixtures.
- Each route is rebound to the actual GLB SHA-256 and byte length before inspection.
- An independent external-texture verifier re-digests same-origin image bytes named by the GLB. Tampering one byte blocks the texture-set receipt.
- The report verifier independently re-parses raw GLB bytes and recounts geometry, UV presence, structure, and bounds. It does not import the report writer.
- Negative routes prove that a fake digest, missing category, metric-approved visual gate, fabricated missing-evidence pass, and tampered external texture are blocked.

## Live browser evidence

- Building: repair, 0 blockers and 4 repair categories; independently verified local texture set; report `23D9FAABFB7D20A59B368BB2F75630C0DEE9D34816CCAA48F187195AA5FAC13B`.
- Vehicle: repair, 0 blockers and 3 repair categories; independently verified local texture set; report `4DF16B31E43F27C14837D804621C2286FC4CDAF6AF1AC20F20461E36BB892AEC`.
- Foliage: repair, 0 blockers and 2 repair categories; independently verified local texture set; report `82CA8762F9CC4D920D5D303D27C1CB7BCDA18109A8C2F1C8801A3E72A53D2198`.
- Character: repair, 0 blockers and 5 repair categories; 3,910 triangles, 108 nodes, 13 materials, 22 clips; report `7C6E95E1DDD70EBF8D4AC6154C1E4222886D2DD63123F2F41F499C0E8757D1DD`.
- Every route retains PASS 11/11 independent report checks and `promotion: not-approved`.
- At 780 x 900 the workspace has no horizontal overflow, and the console log is empty.

## Honest boundary

Digest-verified local textures repair the former self-contained-GLB blocker without hiding that these are multi-file source assets. LOD, collision, UV, pivot, and human visual repairs remain visible. Technical facts never approve silhouette, readability, deformation, material taste, or LOD transition pop.
