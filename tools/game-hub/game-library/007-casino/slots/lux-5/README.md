# LUX-5 RNG Workbench

This is the first math-and-outcome foundation for the planned casino game. It
is outside the live game library and does not contain the casino economy,
graphics, player bankrolls, or a launchable Game Hub package.

## Current v1 candidate for review

- One LUX-5 style seed and one shared cursor per game session.
- Every physical LUX-5 cabinet uses that same style-level book.
- Five 83-stop virtual reels with four visible rows.
- Four horizontal paylines, evaluated left-to-right for 3 / 4 / 5 matches.
- At most one visible Power Core scatter per reel.
- 3 / 4 / 5 scatters award 4 / 7 / 18 free spins.
- Free spins can retrigger and pay Overdrive ×1.5 on line results.
- A screen containing one or more five-symbol lines activates the robot wheel
  once. That one six-face result adjusts all qualifying five-kind profit by
  −30%, −15%, −5%, +5%, +25%, or +35%.
- Every row contains a neutral jackpot ticket from 0 through 9,999. The external
  jackpot system interprets `< 100` as a human hit and `< 5` as an NPC hit.
  That is 1% per human spin and 0.05% per NPC spin.
- The progressive jackpot is outside the slot's 96% line/free-spin RTP.

The exact virtual strips produce 29.958168 free spins per 100 paid spins in the
infinite model, including retriggers. The paytable is solved against those actual
strip probabilities, not a rounded marketing number. Mike approved Overdrive
×1.5 on 2026-07-13; the exact strips and ordinary paytable remain candidates
until their play feel is tested.

## Files

- `lux5-model.js` — immutable strips, paytable, feature rules, evaluator, and
  theoretical math.
- `lux5-rng.js` — session seed creation, independent deterministic RNG lanes,
  unbiased range mapping, and compact book encoding.
- `lux5-outcome-book.js` — debug-row derivation, natural-book audit, canonical
  free-spin replay, and report generation.
- `generate-book.cjs` — one-shot 50,000-record generator. It refuses to replace
  an existing book unless `--force` is explicitly supplied.
- `lux5-math-selftest.js` — deterministic math, RNG, feature, and golden-row
  tests.
- `lux5-book-selftest.js` — validates and regenerates the delivered 50,000-row
  local artifact byte for byte.

## Generate a new local session book

From the repository root:

```text
node tools/game-hub/game-workbench/007-casino/slots/lux-5/generate-book.cjs
```

The compact `.bin`, complete derived `.jsonl`, manifest, summary, and readable
report are written to `exports/lux5-rng/`.

Supplying a seed is supported for deterministic development fixtures:

```text
node tools/game-hub/game-workbench/007-casino/slots/lux-5/generate-book.cjs --seed lux5-example --output-dir /tmp/lux5-example
```

## Runtime contract for later

The authoritative casino server owns:

```text
styleId + mathVersion + seed + 50,000-row book + cursor
```

An accepted human, NPC, paid, or free spin reserves exactly the next row and
advances the shared cursor. A rejected wager consumes nothing. Moving, selling,
or buying another physical LUX-5 cabinet never resets the cursor. Free-spin
queues belong to bettors, but their spins still consume the next global LUX-5
row and can interleave with other cabinets.

The slot never receives or stores wager size, bankroll, player identity, owner,
casino balance, or map location. It returns a normalized payout multiplier and
a raw jackpot ticket; separate systems settle the money.
