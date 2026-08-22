# Casino Alpha v0.3.2 Overdrive Theater Build Report

Status: **WORKING / TEST**  
Built: 2026-07-18  
Scope: local workbench and isolated integration staging only  
Publication: not committed, pushed, promoted, or uploaded

## Outcome

The local alpha now starts with ten playable slot styles instead of one:

- Backroom Story launches for one to four real Party A seats and contains ten
  shared chapters / 42 settled-event quests.
- House War launches equal 1v1 through 4v4 parties with all ten cabinets
  selectable at either casino.
- District contests choose one random slot style for the complete two-minute
  window and score gross settled payout before awarding five-minute NPC traffic.
- NPCs move among available styles after 20–50 paid spins while still stopping
  at exactly 100 paid wagers per complete visit.
- Host, party screens, and seat controllers observe one server-owned district.

The package name remains a temporary alpha identifier, not a final game title.

## Probability implementation

- One private casino-wide Draw Spine is an unbiased permutation of 50,000
  neutral tickets.
- Every style has a separate full 50K ticket-to-row permutation. Style choice
  commits which book is read; it does not choose the next neutral ticket.
- A new private session seed reshuffles the master order and all style maps.
- Humans, adapters/AI seats, NPCs, and earned free spins advance the same cursor.
- No client/save receives the seed, master order, mappings, or future rows.
- Neutral ticket grouping supplies exactly 500 human jackpot tickets (1%) and
  25 NPC jackpot tickets (0.05%) in every complete 50K epoch. Human payment
  also requires a visible shared 30-paid-spin heat meter to be ready.
- Wager, bankroll, actor, owner, location, quest state, and ability state are
  absent from the outcome interface.

LUX-5 retains its solved reels, scatters, 4/7/18 free spins, retriggers, and
six-face Overdrive. The nine additions use exact finite distributions. Each one
contains 50,000 outcomes and sums to exactly 96% base RTP while using its own
hit rate, ceiling, symbols, mechanic evaluator, feature, copy, and board shape.

## Economy and simulation

- Human contribution 5%; NPC contribution 1%.
- Jackpot cap 100× wager; remainder retained.
- Integer-microcredit conservation around wallets, houses, district reserve,
  progressive, and NPC entry/exit.
- A committed payout settles before solvency evaluation and can break a house.
- NPC bankroll 14–200, fixed 1% initial-bankroll wager, exact 100 paid spins,
  and additional legitimately earned LUX-5 free spins.
- Exactly-once commands, increasing sequences, seat tokens, and rival-state
  filtering remain enforced.

## Player-facing visual alpha

- The compact controller now exposes a ten-cabinet picker.
- All ten cabinets have original inline SVG emblems; no remote or stock art is
  fetched and no emblem is a recolour-only duplicate.
- Each style has a distinct responsive board layout, symbol treatment, accent,
  robot-head silhouette, signature text, and feature readout inside the shared
  cute machine family.
- Settled wins animate the machine face, active cells, payout banner, and local
  particle burst; reduced-motion settings collapse those effects.
- The district view has a deeper neon-lux atmosphere and an explicit AXM
  signature while retaining WORKING / LOCAL FIRST truth labels.
- On narrow phones the ten cabinets use a swipeable rail with readable cards
  instead of compressing ten names into tiny fixed columns.
- Story distinguishes READY, DISCOVER, and STORY LOCK states.
- House War exposes all ten immediately; contest travel fixes the active style.
- Host and party routes show the ten-machine roster, current contest cabinet,
  shared quest chapter, ledgers, traffic, and settled event feed.
- All assets remain local with a self-only content security policy.
- LUX-5's committed six-face wheel result now drives a robot-to-spinner
  transformation. A progressive hit uses the same robot theater and clearly
  repeats the 100×-bet cap / retained-remainder rule.
- Settled payout tiers add proportionate callouts and light shows without
  touching payout values. Optional Web Audio cues are synthesized locally and
  start only after player interaction.
- The controller shows six personal settled results as history—not a forecast—
  plus next-bet wallet exposure and the jackpot cap, reinforcing deliberate
  wager choice without reading that wallet inside the slot engine.

## Automated verification

`node alpha/tests/run-all.js` passes in the current v0.3.2 tree and covers:

- original LUX-5 math: 15 checks;
- original complete LUX-5 50K book audit;
- ten-slot catalog: count, distinct mechanics, exact nine-book 50K/96% sums,
  deterministic rows, and economy-neutral interface;
- Draw Spine: full permutations, exact jackpot counts, global mixed-style
  interleaving, deterministic replay, public-state filtering, and epoch rollover;
- casino core: 17 contracts including all team sizes, all ten House War styles,
  wager neutrality, jackpot rules, free-spin locks, contests, exact NPC visits,
  full two-player ten-chapter campaign, persistence, closing bell, and bankruptcy;
- HTTP runtime: static security, 2v2 launch, tokens, exactly-once input,
  persistence, and managed environment launch;
- isolated staged Game Hub: discovery, managed 2v2, managed co-op story, and
  server-owned result return;
- package manifest, local assets, source syntax, and eight-seat rules.

The ten repository-required Workshop checks also pass with zero failures:
`verify.js`, the five hub checks, HTML script syntax, Tool Forge packaging,
Agent Tool Forge, and Evidence Desk.

## Not run and not claimed

- real browser render/click-through QA;
- physical-phone LAN or physical 4v4 testing;
- long game-night balance sessions and player comprehension testing;
- final 3D/multilayer art, recorded audio, and accessibility passes; the local
  synthesized cues and Overdrive Theater still require human browser playtest;
- mobile browser/PWA packaging or internet matchmaking;
- first interference ability playtest.

Passing automated checks does not make this CANON and does not authorize GitHub
publication. Follow `CODEX_LOCAL_LAYER_DROP.md` for a local integration test.
