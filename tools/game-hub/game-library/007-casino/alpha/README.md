# Casino Alpha · Local Playtest

Status: **WORKING / TEST**  
Version: `0.3.4-alpha`  
Publication: local workbench only

This is the ten-slot gameplay alpha. One authoritative Node.js runtime serves:

- **Free Play** for one to four real Party A seats, with all ten cabinets open
  immediately and no quests, searches, chapters, or unlock puzzles.
- **House War** for equal 1v1 through 4v4 parties, with all ten styles, rival
  casino play, NPC traffic, contests, bankruptcy, and a closing bell.

## Start directly

Node.js 18 or newer is required. There are no packages to install.

From the `007-casino` directory:

```sh
node alpha/runtime/casino-server.cjs
```

Open `http://127.0.0.1:8797/?role=host`. Windows can use
`START_CASINO_ALPHA_LOCAL.bat`; macOS/Linux can use
`./start-casino-alpha.sh`.

The host creates a standalone mode and provides seat-token controller links.
When Game Hub manages the runtime, it supplies `AXM_GAME_SESSION_ID` and
`AXM_PLAYERS_JSON`; the casino validates and uses that visible roster without
silently adding seats.

## What is implemented

- Ten independent slot styles and ten distinct board presentations.
- One session-private, casino-wide 50K Draw Spine consumed by players, NPCs,
  contest play, and earned free spins.
- Exact 96% base finite-book audits for all nine new style books, plus the
  original solved LUX-5 math and full-book audit.
- Human 5% and NPC 1% progressive contributions.
- Exact full-epoch jackpot ticket frequencies of 1% human and 0.05% NPC; a
  human matching ticket pays only after the shared 30-paid-spin heat meter is ready.
- Jackpot payment capped at 100× wager with the remainder retained.
- Integer-microcredit ledger conservation across wallets, houses, district
  reserve, NPC entry/exit, and progressive.
- NPC bankroll 14–200, fixed 1% wager, 20–50-spin cabinet visits, and exactly
  100 paid wagers per completed visit.
- Random-style two-minute district contests scored by gross settled payout and
  five-minute traffic claims.
- Quest-free direct access to all ten cabinets.
- Local free-play/progressive persistence without seed, permutations, tokens, or
  future outcomes.
- Idempotent seat commands and filtered player/party observations.
- Responsive host, party, and light controller routes with a ten-cabinet picker.
- Stable polling that patches wallet, house, jackpot, and heat numbers without
  rebuilding the controller or interrupting a tap.
- Integrated cabinet wager/spin controls, a reel-rush delay before settlement,
  and a prominent free-spin award theater.
- Ten original inline vector emblems, cabinet-specific robot silhouettes,
  animated settled-win feedback, a richer neon district, and a swipeable
  phone cabinet rail with readable labels.
- A first true low-poly Three.js layer on the registered GameHub route: the
  shared district is a faceted neon tabletop and each controller cabinet gains
  a style-aware 3D robot stage behind its readable outcome board and controls.
- A receipt-driven Overdrive Theater where the robot transforms into the actual
  six-face bonus result or progressive spinner; payout tiers, optional low-key
  synthesized arcade cues, recent-result history, and next-bet exposure feedback.

## Local state

Inside a Workshop tree, normal play writes
`state/game-hub/007-casino/local-state.json`, outside the packaged source path.
A standalone extracted copy falls back to `alpha/data/local-state.json`. An
invalid file is refused and preserved. Tests use isolated temporary paths and
do not write the normal save.

## Verification

```sh
node alpha/tests/run-all.js
```

The runner covers:

```text
slots/lux-5/lux5-math-selftest.js
slots/lux-5/lux5-book-selftest.js
slots/slot-catalog-selftest.js
slots/axm-draw-spine-selftest.js
alpha/tests/core-selftest.js
alpha/tests/server-selftest.js
alpha/tests/game-hub-integration-selftest.js
alpha/tests/package-selftest.js
```

## Not yet claimed

- Real visual browser/click QA and physical-phone LAN QA.
- Physical eight-seat 4v4 and long game-night balance tests.
- Final 3D art direction, recorded audio, accessibility, or mobile/PWA pass;
  the first low-poly renderer and synthesized-audio theater still need human
  playtest and broader device/GPU coverage.
- Continuous avatar movement or internet matchmaking.
- The first non-outcome-changing interference ability.

See `../ALPHA_GAMEPLAY_ROUTE.md` for the locked rules and
`../CODEX_LOCAL_LAYER_DROP.md` for local Game Hub integration.
