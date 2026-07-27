# Evidence ledger

Status: v0.1 acceptance gate passed on 2026-07-19 through the local Hub server.

| Claim | Evidence route | Result |
| --- | --- | --- |
| Six real material families | Deterministic array tests for brick, asphalt, painted metal, glass, skin and vehicle paint | PASS |
| Maps contain real signal | Independent channel statistics | PASS — all families clear non-flat albedo, height and derived normal gates |
| Tangent-space convention | Contract + decoded normal test | PASS — OpenGL +Y declared; decoded mean lengths remain within 0.025 of 1 |
| Packed channels decode independently | R/G/B identity and semantic checks | PASS — R=AO, G=roughness, B=metalness |
| Flat maps fail closed | Deliberately flattened height and normal negative test | PASS — verifier returns `fail` and names both signals |
| Deterministic and bounded | Two bakes per family + 256² timed gate | PASS — 131 total checks; 256² stays under three seconds |
| Human-facing material evidence | Live brick and vehicle-paint inspection | PASS — lit ball plus five square, undistorted map views; human gate remains visibly open |
| Seed changes identity | Live recipe edit and rebake | PASS — vehicle receipt changed from `56311B…18CC6` to `ACAD93…668D6` |
| Responsive layout | 780 × 900 live observation | PASS — controls/reference render stay paired; square map set moves below without distortion |
| Runtime error state | Browser console inspection | PASS — zero error/warning entries after switching and rebaking |

## Selected live receipts

- Weathered brick `district-brick-01`: `766134B113586BDDC0F2CDBCD2C0F9AFC4FD5960A3650B2428FE7F9614B0A1F2`
- Metallic vehicle paint `vehicle-paint-01`: `56311B018E8AC7CA8F37F4A2673C3C9CC2D3FE78941E2C610AE486BFFA918CC6`

## Boundary

This proves PS3-era material infrastructure, not PS3 visual quality. One candidate stays in memory; export is explicit, and no bake promotes itself into the library.
