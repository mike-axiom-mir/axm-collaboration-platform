# AXM Runtime Gameplay Organ Contract v0.1

Status: **EXPERIMENTAL · accept for test**

`axm.gameplay-organ/v1` is a separate runtime contract. It does not replace,
weaken, rename, or repurpose the candidate-only `axm.game-organ/v1` planning
contract.

A runtime gameplay organ declares server-owned truth, deterministic seed
inputs, spatial/time/resource bounds, conflicts, refusals, append-only receipt
types, exact replay inputs, failure behavior, migration holds, and a
telegraph-before-effect activation contract. Its current assurance ceiling is
headless contract behavior only; readability, balance, appearance, and fun
remain human judgments.

`candidate-adapter.js` is intentionally one-way and incomplete. It can preserve
candidate identity and provenance in an
`axm.gameplay-organ-adapter-draft/v1`, but its output is authority-ungranted,
activation-disabled, and invalid as a runtime gameplay organ. The adapter has
no promotion operation. A real runtime organ must be authored and validated
independently.

Run:

```powershell
node shared/gameplay-organ/selftest.js
```
