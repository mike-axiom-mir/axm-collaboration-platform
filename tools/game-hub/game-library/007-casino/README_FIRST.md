# Read First · Casino Alpha v0.3.2 Overdrive Theater

This is a **local TEST intake** for ChatGPT/Codex Local. It does not request or
authorize GitHub publication, a commit, a push, CANON status, or replacement of
unrelated Workshop work.

## PR14 payload target

PR14 already owns slot `007`, route `/games/007`, port `8797`, and this target:

```text
payload/tools/game-hub/game-library/007-casino/
```

The complete deterministic LUX-5 audit fixture is separately included at
`payload/exports/lux5-rng/`. Compare it with PR14's root `exports/lux5-rng/`
and retain the byte-identical canonical set.

Treat this package as an in-place upgrade candidate for that directory after a
conflict review. Do not create `007-casino-alpha`, do not add a second slot-007
route, and do not patch the Foundation or Game Hub seat engine. The package
contains the original solved LUX-5 files as well as the expanded game.

Read `integration/PR14_INTAKE.md` before layering. If PR14 has moved beyond the
reviewed head, re-inspect the live destination and preserve any newer work.

## Verify after layering

From the installed `007-casino` directory:

```sh
node alpha/tests/run-all.js
```

Then run the Workshop's required repository checks. Browser rendering,
controller audio, physical-phone LAN play, and physical 4v4 remain explicit
human QA gates and are not claimed by the automated report.

## Included game scope

- one-to-four-player shared Backroom Story;
- equal 1v1 through 4v4 House War;
- ten starting slot styles and ten story chapters;
- one casino-wide 50K Draw Spine with ten independent style mappings;
- exact 96% base finite-book audits for the nine new styles;
- original solved LUX-5 reels, free spins, and six-face Overdrive;
- exact 1% human and 0.05% NPC jackpot ticket counts per 50K epoch;
- server-authoritative money, NPC visits, contests, persistence, and results;
- ten original vector emblems, distinct cute robots, neon responsive layouts;
- receipt-driven robot bonus transformation, payout-tier celebrations,
  optional local synth audio, personal result history, and wager-risk feedback.

The final presentation additions only read settled receipts. They do not
reroll, smooth, forecast, repair, or otherwise change the immutable books.

See `CODEX_LOCAL_LAYER_DROP.md` and `BUILD_REPORT.md` before integration.
