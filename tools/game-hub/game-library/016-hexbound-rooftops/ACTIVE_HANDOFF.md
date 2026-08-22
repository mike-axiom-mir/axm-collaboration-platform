# HEXBOUND active handoff

Updated: 2026-08-16 07:36 Europe/Amsterdam  
Lane: `tools/game-hub/game-library/016-hexbound-rooftops/`  
Persistent goal: **steward the full macro RTS toward a longer, Steam-worthy AXM Game Hub release** (active, not complete).

The current bounded segment is the unsealed **Department of Later growth pass** documented in `BUILD_RECEIPT.md` and `EVIDENCE_ROUTE.md`. It is source-backed and tested, but remains `TEST` material: it is not promoted, CANON, or accepted by Mike Tobi.

The latest sealed segment remains the prior [Last-Rites Exchange release](evidence/session-last-rites-exchange-release-2026-07-28.jsonl), source SHA-256 `42f58380a10525e4ca3dd60dea4f389c80e7dabfb9cf80ad6b4a08645be198b5`; its [structural seal](evidence/session-last-rites-exchange-release-2026-07-28.seal.json) has file SHA-256 `992c9971cf35b1f7620e7a07f51ee5b996e238b55f646cae87bee8ad1942e4c7`. All older sealed releases remain append-only and unchanged.

## Current release candidate

Release: `0.20.0-department-of-later`  
Status: `PLAYABLE LOCAL ALPHA - DEPARTMENT OF LATER` / `TEST`  
Manifest SHA-256: `7623afa9219c557417e3900912536870bd5cbee2b2ab16de1fe2ab2ad1f352d5`

Implemented:

- Temporal Mischief's ordinary `C` Watchmoon is now the **Department of Later**, preserving 50 Glow, 90 Scrap, 3.4-second construction, 390 durability, huge vision, and no attacks;
- every fourteen seconds, a completed living Department deterministically files the nearest currently visible enemy formation within 520 for a three-second pause to movement and attack recovery;
- route, target, and macro order survive the pause, so the formation resumes rather than losing player or rival intent;
- mixed nearby charters lengthen the filing through the capped x1.45 wonderweb to 4.35 seconds;
- buildings, allies, dead, distant, invalid, and already-deferred formations are excluded; a second office cannot stack a new filing onto the active target;
- rival Temporal remains Wonderwork-first, then uses the same Watchmoon conversion; Office of Already Done retains its separate recruitment/power-cooldown role;
- the battlefield now renders a temporal facade, `LATER` fascia, idle brackets, active source ring and beam, `DEFERRED` duration, target shield, and `FILED: LATER` receipt;
- all eight factions now have one ordinary-district conversion without workers, individual-fighter control, routine siege, or a new co-op command.

## Evidence

- Runtime syntax: **5/5 PASS**.
- Focused faction-district suite: **20/20 PASS**.
- Full Node suite: **72/72 PASS**.
- Package contract: **69/69 PASS**.
- Isolated HTTP suite: **4/4 PASS**, reporting v0.20, eight conversions, 14/3/4.35/520 boundaries, capped charter scaling, active-target exclusion, order preservation, building exclusion, and rival parity.
- Live sequence: **PASS for recorded scope** at 1280x720, Tuesday/Mildly Inconvenient, Temporal Mischief versus Boo Brigade, Guard, auto-scout off.
- Baseline: the completed ordinary `LATER` Watchmoon is visible on the home approach.
- Active: a real hostile formation shows the cyan `FILED: LATER` shield while the source shows `DEFERRED 3.0s`, its active docket ring, and beam.
- Settled 4.5 seconds later: temporary source/target cues clear while both the Department and formation remain.
- Browser warning/error log: empty.
- Exact sub-frame cadence remains **UNKNOWN** because no rolling buffer was exposed.
- The first valid live run is retained as counterevidence in the receipt: its office was away from rival traffic and the Grand Clock fell at 03:34 without a trigger. A completed source alone was not counted as behavioral proof.
- No screenshots were retained because the user did not request evidence artifacts.
- All ten repository-required commands exited 0. `node verify.js` still reports the repository's existing **43 warnings** with **0 failures**; warnings were not treated as passes or repaired outside this lane.

Source hashes:

- `runtime/game-data.js`: `56b5b12a7f3b7d763a83286925510d30102783a5e106c4dcd8a0c26b92f53fcb`
- `runtime/systems.js`: `a99ed0528b0ad6f9cb0992d5fa7aec4771400c4b79e93d98be0511d1def094d8`
- `runtime/app.js`: `5fb141e17e8e1bbb736072661fd66d5a3e5431d51a3cd64bba9c9a5819b14be0`
- `runtime/server.js`: `d476b52b1bd5fc3e33b678b99c88f5d39fc35b0ba97c1fa7a37eeb9b79277641`
- `tests/faction-districts.test.js`: `5895e81741974ef207864ce8942558a1b8365674d60af699afb7425cf54acebc`
- `tests/package-selftest.js`: `fe2f0ba6fdf4497b814185608a9c16532fe1d3e81d91384e9042e50269c769dd`
- `tests/server-http.test.js`: `fea5f694139179cf16351d2d5b2a388cd422aeb4afcea879f1f6693ee05527a2`

## Runtime and shared-workspace seams

This run did not inspect, restart, or stop the previously reported externally owned listener on port 8816. Fresh HTTP and live browser proof used an isolated `runtime/server.js` process on port 19816; it must be stopped at handoff.

Lane 016 remains an untracked directory in the already-dirty shared worktree. This pass changed only lane-owned files under `016-hexbound-rooftops`; it did not touch the concurrently active Casino or Lumenwake lanes, the Game Hub registry, or Foundation sources. No cleanup or process-control boundary was bypassed.

## Open seams and next growth route

Honest product seams remain: the four core balance families are shared beneath 32 faction-role visual variants; there is no campaign, save/replay contract, complete upgrade/technology tree, synchronized server-authoritative world, physical-phone QA, gamepad/remapping layer, rolling-video cadence proof, representative hardware performance matrix, Steam build/depot proof, store integration, achievements, or platform packaging verification.

Highest-value next bounded content route: author one **three-battle faction chronicle** from the existing maps, schemes, doctrines, and eight conversion identities, targeting a 25-35 minute local run with clear mission variation and a truthful end-of-run summary. Keep it local and replayable before adding persistence; do not imply Steam readiness until depot, controller, performance, save, packaging, and store evidence exists.
