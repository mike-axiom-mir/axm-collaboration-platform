# Evidence ledger

Status: v0.1 acceptance gate passed on 2026-07-19 through the local Hub server.

| Proof asset | Triangles | Reduction | Max normalized envelope | UV delta | Weight delta | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Commercial building G | 2,006 → 1,517 | 24.4% | 2.566% | 0.00667 | 0 | 10/10 PASS |
| Sports hatchback | 2,088 → 1,906 | 8.7% | 3.298% | 0.00752 | 0 | 10/10 PASS |
| Rigged pedestrian | 3,910 → 2,948 | 24.6% | 3.046% | 0 | 0.01556 | 10/10 PASS |

The car’s smaller reduction is intentional: the optimizer refuses to force the 62% target when doing so would cross the 3.5% geometric envelope.

Additional evidence:

- 89 automated checks cover determinism, source immutability, material/primitive parity, valid indices, degenerate removal, UV/normal/rig survival, normalized weights, and a negative out-of-bound candidate.
- The live browser exposed and repaired two presentation defects: a CSS parser break that collapsed comparison columns, and missing GLB node transforms that fragmented the rigged-person preview.
- Final desktop wireframes show source and optimized building, vehicle, and two-person rig family side by side. A 780 × 900 check stays legible.
- Browser console: zero error/warning entries after all three asset routes.

Selected receipt identities:

- Building: `E292F7436725381AC49E353DCC251425BB535389953481DA9742792E0D5D4AE3`
- Vehicle: `16993118FB3C1C1C5C3B94629B8BF111287C89C1B367239DB703FFA2639B17BD`
- Rigged person: `E24AC756446CF5CBDE54DDE2BD8BC2A854B995456A88A428C738C71D80449847`

Boundary: normalized vertex-envelope distance is not silhouette approval, and weight normalization is not deformation approval. Both remain human/live review gates.
