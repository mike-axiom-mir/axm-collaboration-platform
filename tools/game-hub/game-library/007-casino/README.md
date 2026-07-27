# Casino Workbench · Ten-Slot Alpha

Status: **WORKING / TEST**  
Version: `0.3.2-alpha`  
Publication: local workbench only; no GitHub action and no live-library promotion

This local package contains one authoritative casino game with two routes:

- **Backroom Story** — one to four real Party A seats share a ten-chapter campaign.
- **House War** — equal parties from 1v1 through 4v4 operate and attack casinos, play random-slot district contests, and try to survive the closing bell.

The alpha starts with ten mechanically distinct slots:

1. LUX-5
2. Moss & Bolt: Graftgarden
3. Mirror Mice
4. Pip's Night Courier
5. Pocket Vault Crew
6. Nimbus-9 Weatherheart
7. Choir of Spare Parts
8. Nullbloom
9. Orbit Oven
10. Twinlight Relay

Every settled spin advances one casino-wide 50,000-position AXM Draw Spine.
The neutral ticket is then mapped into the already-selected style's independent
50,000-outcome book. Actor, wager, bankroll, casino, owner, quest, and ability
state never enter outcome selection. A new session seed reshuffles the neutral
order and all ten mappings, so repeated sessions do not start with the same
play sequence.

The v0.3.2 Overdrive Theater pass gives every cabinet an original vector emblem, its own
robot silhouette/accent, mechanic-shaped board, win personality, and readable
mobile card. The shared presentation follows AXM's premium dark neon-lux DNA:
gold identity, cyan structure, magenta spark, cute machines, and honest WORKING
labels rather than fake finished-game art. The settled receipt now also drives
the robot-to-wheel transformation, payout-tier celebrations, optional local
synth audio, a recent-result strip, and an explicitly non-predictive wager-risk
meter. None of those presentation systems can select or change an outcome.

Key paths:

- `slots/slot-catalog.js` — ten style definitions, exact finite-book audits,
  and ten presentation evaluators.
- `slots/axm-draw-spine.js` — the shared without-replacement 50K draw authority.
- `slots/lux-5/` — the original solved LUX-5 reels, free spins, and Overdrive math.
- `alpha/` — server, clients, story campaign, multiplayer simulation, and tests.
- `ALPHA_GAMEPLAY_ROUTE.md` — the locked gameplay and probability contract.
- `CODEX_LOCAL_LAYER_DROP.md` — the safe local Game Hub integration handoff.
- `BUILD_REPORT.md` — implemented scope, verification, and remaining QA.

## Launch modes

- **Managed Game Hub mode:** Game Hub owns the managed port, visible seat map,
  session ID, launch lifecycle, and result return. Open slot 007 from Game Hub;
  do not start a second copy on the same port.
- **Standalone local-test mode:** from this directory run
  `START_CASINO_ALPHA_LOCAL.bat` on Windows or `./start-casino-alpha.sh` on
  macOS/Linux. The casino creates its own temporary local roster and controller
  links. This is for isolated alpha testing, not a replacement for Hub seats.

Run the complete local verification from this directory:

```sh
node alpha/tests/run-all.js
```

The package remains beside the discoverable `game-library` on purpose. Passing
tests makes it a reviewable alpha, not CANON and not published software.
