# ChatGPT/Codex Local Layer-Drop · Casino Alpha v0.3.2

Status: **TEST integration handoff**  
Source: `tools/game-hub/game-workbench/007-casino/`  
PR14 target: `tools/game-hub/game-library/007-casino/`

This handoff is deliberately local. It does not authorize a commit, push, pull
request, live-library promotion, Foundation rewrite, or overwrite of unrelated
slot `007` work.

## Safe layer order

1. Read `integration/PR14_INTAKE.md` and inspect the current PR14 target first.
2. Confirm that slot `007` and port `8797` still refer to the PR14 LUX-5 game.
3. Diff the complete payload against `game-library/007-casino/`. Preserve any
   PR14 changes newer than the reviewed head; stop on an unexplained conflict.
4. Upgrade that directory in place. Do not make a parallel
   `007-casino-alpha` directory and do not add another `/games/007` route.
5. Keep `slots/slot-catalog.js`, `slots/axm-draw-spine.js`, and `slots/lux-5/`
   beside `alpha/`; the runtime relies on that relative structure.
6. Compare `payload/exports/lux5-rng/` with the Workshop root
   `exports/lux5-rng/`. Keep the canonical 50,000-row set; stop if the same seed
   differs instead of overwriting unexplained audit evidence.
7. Do not alter `game-engine/engine-core.js`. The adapter consumes the visible
   ready seats supplied by Game Hub.
8. Use seats 1–4 only for Backroom Story. Use matching counts from seats 1–4
   and 5–8 for House War.
9. Use the casino host dashboard's tokenized controller links during alpha.

## Required pre-play checks

From the upgraded game directory:

```sh
node alpha/tests/run-all.js
```

Expected scripts:

```text
node slots/lux-5/lux5-math-selftest.js
node slots/lux-5/lux5-book-selftest.js
node slots/slot-catalog-selftest.js
node slots/axm-draw-spine-selftest.js
node alpha/tests/core-selftest.js
node alpha/tests/server-selftest.js
node alpha/tests/game-hub-integration-selftest.js
node alpha/tests/package-selftest.js
```

After the local layer is installed, run the Workshop's ordinary regression
suite. Source and HTTP checks do not replace an actual browser click-through.

## Expected managed contract

- manifest game ID `007-casino-alpha`, version `0.3.2-alpha`, port `8797`, max
  eight seats;
- client `/games/007/?role=host`, ready route `/games/007/state`;
- environment `AXM_GAME_SESSION_ID` and `AXM_PLAYERS_JSON`;
- story inferred when no Party B seat is active;
- House War inferred when both parties contain equal active seat counts;
- all ten styles immediately unlocked in House War;
- ten sequential shared chapters in Backroom Story;
- server-owned result returned through `/game-api/game/end`;
- Workshop save under `state/game-hub/007-casino/`, which stays outside the
  game package; standalone extraction falls back to `alpha/data/`;
- no seed, Draw Spine permutation, style mapping, or future row in any save or
  client observation.

## Integration seams that remain real work

PR14 has shared-control and AI observation changes beyond this isolated game
package. Reconcile its current session/intent contract during the layer review.
Do not claim that tokenized controller links are the final shared-control UX,
and do not broaden AI observations beyond the existing filtered player/party
views without an explicit contract review.

## Stop and report

Stop instead of silently repairing when PR14 has newer conflicting work, slot
`007` or port `8797` changed ownership, persistence is malformed, the seat map
violates the manifest, any automated check fails, or browser/phone state differs
from the authoritative host.
