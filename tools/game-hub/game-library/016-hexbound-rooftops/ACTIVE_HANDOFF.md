# HEXBOUND active handoff

Updated: 2026-07-28 16:22 Europe/Amsterdam  
Lane: `tools/game-hub/game-library/016-hexbound-rooftops/`  
Persistent goal: **steward it; let the full macro RTS grow toward a 2030-quality game** (active, not complete).

The current bounded segment is [Last-Rites Exchange release](evidence/session-last-rites-exchange-release-2026-07-28.jsonl), sealed with source SHA-256 `42f58380a10525e4ca3dd60dea4f389c80e7dabfb9cf80ad6b4a08645be198b5`; its structural receipt is [the seal](evidence/session-last-rites-exchange-release-2026-07-28.seal.json), file SHA-256 `992c9971cf35b1f7620e7a07f51ee5b996e238b55f646cae87bee8ad1942e4c7`. The semantic derived view is [the release summary](evidence/last-rites-exchange-release-summary-2026-07-28.md), SHA-256 `3ee83caef49ae84c3d537fee3688b6da753698aa2ed1bccea339a660cf1e8930`; retention decisions are in [the curation receipt](evidence/last-rites-exchange-curation-receipt-2026-07-28.json), SHA-256 `d71ebdcc89239a0df65b7504c00222334ba2b88218612168891d9779b90c4739`; and the matched state sequence is [the visual receipt](evidence/last-rites-exchange-visual-receipt-2026-07-28.json), SHA-256 `fa96b24b41110e79d9bb0962b0337ac9b46973c1c0621174805cdf96af6a451b`.

Prior sealed releases remain append-only. Every-Window Assembly has source SHA-256 `4b4779b5f7c108120bed2635b0110d347886e03f7d5ded7354bb0c184bdbe682`; Foreground Spotlight `87d0bffb5ee5eb1aaa8eb5c217cdd9263814bb7f0c399135cba6061dff32f868`; Thirteenth Hour `c21c9b372338d55e7501594bfc710b3f8912609cd16b04e5edf5d51b2de3ee3d`; Faction Formations `564a6a9c33b8c3c3d94f31c1de46a4511b217f12672ca0c0bc2d94ba6ba11513`; Spectral Census `83e312f535a17b92e8712f8e090804b489b38c6c1d86cdacfefa6e558ad8686e`; Black-Sail Routes `95cdd264ae90f174212252ed42d2a786edb4c3f003689a6403a6e1bd8dfc680f`; Faction Rooflines `11e560c6df286d402312ba923f6681337c8611dd496ca7f60a5f33460ecacabd`; Faction Wonderworks `3f75c462dbdf0aaf7f1189f55c52052635bf53deb18e72bb8fd71407331d9b9e`; Living Topologies `d7d5dcb4848a30fbf49eb58cc24a2ea0b739f3240c6f037084aab2b118d33448`; Grand Doctrines `f78528de0408d3bfebf13ff992a602b6c750e1670a135b9af5aeb535ecadb1d0`; Bridgefront checkpoint `922fed62f362ca3359e76aaf3a8b682a11591fe2ee5491aec4d88dbfc4d6f77e`; and Bridgefront release `a85589285a9bae781146a62c1846d8d49fda2cf4ea951693547e068c58e2a207`.

## Current release

Release: `0.19.0-last-rites-exchange`  
Manifest SHA-256: `673bb60932c212ae04a3901180d346d071836014d275040c58be232deb120e21`

Implemented:

- Graveyard Shift's ordinary `Z` Borough is presented as **Last-Rites Exchange**, preserving 80 Glow, 75 Scrap, four-second construction, 560 durability, passive income, and +80 cap;
- positive formation casualties within 520 receive a Wake Dividend equal to 55% of ordinary casualty Essence for the casualty formation's side through the strongest eligible completed living Exchange;
- mixed nearby charters strengthen the dividend through the capped x1.45 wonderweb to 79.75%; overlapping sources never stack;
- buildings, malformed or zero-death events, and unfinished, destroyed, hostile, or out-of-range sources are excluded;
- normal combat and hazard casualties share `awardCasualtyEssence`; player income credits shared Essence and rival income credits `enemyEssence`;
- `cashRivalEssence` lets the existing 60-Essence ghost audit spend Wake Dividend and Boo stipend income, so rival parity is behavioral rather than display-only;
- bone-ledger, abacus, skull facade, `LAST RITES` fascia, receipt ring and slips, `WAKE DIVIDEND +55%`, and exact credited-Essence plaques are rendered after squads so formation sprites cannot hide them;
- rival Graveyard remains Wonderwork-first and resolves ordinary Exchanges only after its two Wonderworks;
- seven ordinary conversions now ship: Clockwork formation tempo, Boo strategic fog, Moonwake routed movement, Thorn district repair, Mob target coordination, Tin formation cover, and Graveyard casualty Essence;
- unchanged high-population grouped-army, no-worker, automatic-scouting, casualty-Essence, field-summon, spread-economy, no-routine-siege, browser-host, server-relay, and `hexbound.coop-command/v2` contracts.

## Evidence

- Runtime syntax: **5/5 PASS**.
- Focused faction-district suite: **18/18 PASS**.
- Full deterministic/HTTP/relay suite: **70/70 PASS**.
- Package contract: **69/69 PASS**.
- Isolated HTTP suite: **4/4 PASS**, reporting v0.19, seven conversions, 520 range, 55% dividend, mixed-charter scaling, strongest-only non-stacking, building exclusion, player/rival parity, and rival dividend spending.
- Live sequence: **PASS with named cleanup seam** at 1280x720, Tuesday/Mildly Inconvenient, Graveyard Shift versus Temporal Mischief, Graveyard Collective, Guard.
- Active frame: receipt ring and slips, `WAKE DIVIDEND +55%`, and `LAST RITES +0.6 ESS`.
- Confirmed settled frame: temporary receipt cues and plaques cleared while the completed Exchange remains.
- All three retained JPEGs are native-verified 1280x720 with distinct SHA-256 digests.
- Browser warning/error log: empty.
- Exact sub-frame cadence remains UNKNOWN because `visual.capture.ephemeral-rolling-buffer/v1` was not exposed.

Source hashes:

- `runtime/game-data.js`: `7b5aeff46b59ec26a08fd73bacc9fbe56bdc26d632938e3259057e6d77627950`
- `runtime/systems.js`: `b804f6c32aa933fad507c8ddd7723c2f4fbab7b7f4f2bdab1b79bf8536f3c03b`
- `runtime/app.js`: `6763bad808f22ae1a1ff4f4140dd2842bb9718c9f467181c121939058d2ad49c`
- `runtime/server.js`: `c314f75b4895b951e4a7bac5a783c2c5c03df62a296883a2b074ee6af9dca579`
- `tests/faction-districts.test.js`: `2c739aeb4dd86644ac60db8adf2239cbc893b618cdf3bdc03ba663f5d189cbd0`
- `tests/package-selftest.js`: `d90c266c653f1b4a7df384052d8ffafd3321356baf2b5a73eded144268c50091`
- `tests/server-http.test.js`: `43ebbf642ac0b0d12ca235d79c2bc08e984cee9cc3acb285b33cde1a71e831cb`

## Runtime and curation seams

The existing server on `http://127.0.0.1:8816` is externally owned Node PID `20208`. It serves current v0.19 static assets and the served game data contains `last-rites-exchange`, but its unrestarted in-memory `/health` and `/api/launcher-state` metadata remains v0.14 with three conversions. Do not claim fresh live v0.19 health until an allowed restart has occurred; a freshly started isolated `runtime/server.js` process is already proven by the HTTP suite.

The three selected v0.19 proof frames are retained intentionally. Current-loop cleanup is incomplete: `evidence/visual-temp-last-rites-v19`, `evidence/visual-temp-last-rites-v19-guard`, and `evidence/visual-temp-last-rites-v19-story` remain after two exact deletion attempts were policy-rejected. They are isolated and are not promotion evidence. One historical temporary baseline also remains at `evidence/visual-temp-faction-formations/clockwork-before-lantern.png`, SHA-256 `aa071b3b1ca7f0169abefcd1d0d66c1d43d958a5e5ea63ae9e3607e931a27f45`, because its earlier exact deletion was rejected. Retry only an allowed exact-path deletion; never broaden the target or bypass policy.

## Shared-workspace state

Lane 016 is owned by this task. `game.manifest.json` remains the only shared release seam; it was re-read immediately before v0.19 promotion and immediately afterward. Foreign active paths outside lane 016 were not modified. No process-control denial, cleanup denial, or foreign shared seam was bypassed.

## Open seams and next growth route

Honest product seams remain: Temporal Mischief still lacks a mechanically distinct ordinary-district conversion; the four core balance families remain shared beneath their 32 visual variants; there is no complete upgrade/technology-age tree, synchronized server-authoritative world, physical-phone QA, save/replay contract, rolling-video cadence proof, or hardware performance matrix.

Highest-value next bounded route: author Temporal Mischief's eighth ordinary-district conversion on a macro axis not already occupied by Union tempo, Census vision, Black-Sail routes, Briar repair, Spotlight target coordination, Assembly formation cover, Last-Rites casualty Essence, or Temporal's existing doctrines/Wonderwork. Preserve the ordinary building's economics, durability, key, and role; automatic low-chore value; capped strongest-only mixed-charter interaction; Wonderwork-first rival parity; no workers; no individual unit control; no routine siege; and no new co-op command. Prove deterministic boundaries and a live baseline-active-settled state before promotion.
