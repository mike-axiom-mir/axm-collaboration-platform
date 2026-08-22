# MIRRORSHIFT Start Grid contract

Schema: `axm.start-grid-pose/v1`

V22 adds a presentation-only four-racer identity reveal during the server-owned countdown in Circuit Crown, Signal Tour, and Mirror Core. The authority state remains the only source of mode, circuit, direction, signal condition, player seat, character assignment, vehicle, countdown, and launch timing. Start Grid changes no state, physics, input, stats, catch-up, item weights, Flux Guard behavior, collision, scoring, or start action.

## Character and motion language

- Mike arms `RATCHET READY`; Axiom/Mir resolves `SIGNAL SYNCED`; Codex primes `COMPILE ARMED`; Mirror returns `VECTOR RETURNED`.
- `startGridPose` is a pure bounded pose function over character identity, seat, elapsed presentation time, and reduced-motion preference.
- Every pose declares `changesPerformance=false` and `changesAuthority=false` and returns finite entrance, lift, roll, scale, opacity, and glow values.
- Reduced motion skips entrance, float, roll, and scale animation while retaining the static four-seat identity grid.

## Countdown-surface contract

- Exactly four semantic ordered-list entries derive from the current authority-owned seat and character assignments. Cards are not controllers, players, or additional racers.
- Every entry discloses player seat, character, vehicle, and a distinct ready moment. Mode-aware heading copy derives from the current server state.
- The grid must fit the 1280x720 game-night surface and a 390x844 responsive browser viewport without horizontal scroll or obscuring the countdown number.
- Race, tour, and battle starts preserve their existing countdown, launch timing, copy, HUD transition, and play behavior.
- `axm.start-grid-diagnostics/v1` exposes visible state, entrant count, pose frame count, distinct moments, reduced-motion state, and the no-authority-write boundary for live verification.

## Mode-selection authority repair

- A visible enabled mode control always sends its requested mode to `/api/mode`; it no longer silently refuses based on a stale client phase cache.
- The hidden race HUD is visibility-gated so its item control cannot intercept lobby pointer input.
- The server remains the sole authority: `setMode` still rejects non-lobby requests with `mode-locked`, and the client reports that refusal through its live status region.
- The repair changes no server transition, mode rule, or input authority contract.

## Verification boundary

- `tests/start-grid.test.js` covers all four identities, all four seats, multiple entrance and settled times, reduced motion, bounded values, distinct moments, authority immutability, static wiring, server-owned mode locking, package registration, and frozen mechanics.
- Existing deterministic and HTTP suites continue to prove start timing, mode transition authority, input authority, and play behavior.
- Live verification must use the public controls to select each mode, inspect the four-card countdown at both declared browser viewports, confirm the racing transition, inspect start-grid diagnostics, and review warning/error logs.

This slice advances character presentation and repairs a public lobby seam. It does not prove high-cadence motion, human character attachment, visual taste, physical-phone usability, representative target-hardware frame pacing, human listening/mix quality, deeper voice/content breadth, independent art direction, or steward approval.
