# Evidence ledger

Status: v0.1 acceptance gate passed on 2026-07-19 through the local Hub server.

| Claim | Evidence route | Result |
| --- | --- | --- |
| Exact source identity retained | Before/after SHA-256 + receipt field | PASS — storefront `AFCB…7222`; pedestrian `B448…5D63` |
| Source is not changed | Byte identity + source-write boundary | PASS — both hashes unchanged; UI reports `0 source bytes written` |
| Scale, axes, pivots and hierarchy survive | Independent descriptor/contract comparison | PASS — right-handed, +Y up, +Z forward, metre scale 1, no hidden transform |
| Materials, rigs and animation survive | Independent semantic matrix | PASS — both fixtures pass 14/14 checks; pedestrian retains 13 skins and 22 clips |
| Unsupported input fails closed | Mutated-fixture negative test | PASS — CUBICSPLINE sampler becomes named blocking loss and verdict `blocked` |
| Receipt is deterministic | Two compilation results compared canonically | PASS for both fixtures |
| Human can understand the diff | Desktop and 780 × 900 live inspection | PASS — source → engine → diff flow, metrics, parity matrix and loss registry stay legible |
| Runtime error state | Browser console inspection | PASS — zero error/warning entries after both asset routes |

## Live receipt identities

- Storefront bridge receipt: `3497ED1485EA92BA5A49FF61E0527F2E790FD889B89F19FD701E1A93090C20BD`
- Animated pedestrian bridge receipt: `CAD5CD10489BFEA4A71EB4FC9D0DA4D3EF6058FB01A1CA5BD51C08CC559D09BB`

## Boundary

Technical parity does not approve visual quality and cannot promote an asset. Transient visual inspection frames were not retained as library assets.
