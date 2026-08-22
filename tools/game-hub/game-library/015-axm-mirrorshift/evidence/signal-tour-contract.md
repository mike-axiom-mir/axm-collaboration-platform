# Signal Tour contract

Schema: `axm.mirrorshift-signal-tour/v1`

Signal Tour is an optional, server-authoritative three-round race format. It composes existing authored circuits and signal conditions; it does not create a new driving, item, catch-up, shield, or vehicle-stat contract.

## Fixed itinerary

1. Mirror Forge — Clear Signal — 3 laps
2. Splitglass Gardens — Shardline Sprint — 2 laps
3. Null Foundry — Redline Gauntlet — 4 laps

Clients may select Signal Tour only in the lobby. While the tour is active, `/api/track` and `/api/variant` reject manual changes with `tour-itinerary`. After a non-final result, `/api/tour/advance` is the only progression route; the authority loads the next fixed round, clears round-local entities and racer statistics, retains cumulative points, characters, assists, and transport ordering, then starts the countdown. A completed tour rejects further advancement and requires an explicit new-tour reset.

## Scoring and tie-break

Each round awards `9 / 6 / 4 / 2` points by finishing place. There are no bonus points. Cumulative standings sort by total points, then placement in the latest completed round, then stable seat order (`P1`, `P2`, `P3`, `P4`). The final result retains both the final-round winner and the cumulative champion when they differ.

## Preserved contracts

- Four original selectable identities: Mike, Axiom/Mir, Codex, Mirror.
- Equal vehicle base stats: `260 max / 178 acceleration / 2.45 turn`.
- Rank catch-up remains capped at `+7.5%`.
- Race item draws remain `85%` attack-heavy.
- Flux Guard remains repairable and starts with three segments.
- Race simulation and progression remain server-authoritative.

## Verification route and boundary

- `tests/signal-tour.test.js` deterministically completes all three rounds, verifies the fixed itinerary, point totals, latest-round tie-break, champion/final-winner split, no duplicate awards, profile retention, round resets, and frozen mechanic contracts.
- `tests/server-http.test.js` verifies selection, health/state/observation exposure, manual itinerary rejection, and early-advance rejection across the live HTTP authority.
- Shared-screen and controller live journeys must verify readable round/point presentation before this slice is sealed.

This contract proves local authored progression and deterministic authority behavior only. It does not prove four physical phones, router membership, representative target-hardware performance, human mix/listening quality, human character attachment, broad content depth, or steward approval.
