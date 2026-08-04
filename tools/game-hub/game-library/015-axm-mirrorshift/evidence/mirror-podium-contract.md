# MIRRORSHIFT Mirror Podium contract

Schema: `axm.result-stage-pose/v1`

V21 adds a presentation-only four-character result tableau to Circuit Crown, Signal Tour debriefs, and Mirror Core. The server-owned result ranking remains the only source of placement, winner, points, CORE score, and race metrics. Mirror Podium changes no state, physics, input, stats, catch-up, item weights, Flux Guard behavior, collision, scoring, or rematch action.

## Character and motion language

- Mike resolves with `RATCHET SALUTE`; Axiom/Mir with `TWIN ORBIT LOCK`; Codex with `COMPILE COMPLETE`; Mirror with `RETURN VECTOR`.
- `resultStagePose` is a pure bounded pose function over character identity, finishing place, elapsed presentation time, and reduced-motion preference.
- Every pose declares `changesPerformance=false` and `changesAuthority=false` and returns finite entrance, lift, roll, scale, opacity, and glow values.
- Reduced motion skips the entrance/floating transform while retaining static placement hierarchy, identity, readable metrics, and all four entrants.

## Result-surface contract

- Exactly four semantic ordered-list entries derive from the authority ranking. No portrait or reaction becomes a seat or racer.
- Every entry discloses placement, character, vehicle, a unique reaction label, and mode-native result metrics. The authority winner remains the headline and receives only presentation emphasis.
- The tableau must fit the 1280x720 game-night surface and a 390x844 responsive browser viewport without hiding the rematch/advance action or requiring horizontal scroll.
- Race, tour, and battle result journeys must preserve their existing result copy, rules, ranking order, and continuation behavior.
- `axm.result-stage-diagnostics/v1` exposes visible state, entrant count, winner, pose frame count, distinct moments, reduced-motion state, and the no-authority-write boundary for live verification.

## Verification boundary

- `tests/result-stage.test.js` covers all four identities, all four places, multiple entrance/settled times, reduced motion, bounded values, distinct moments, authority immutability, static wiring, and frozen mechanics.
- Existing deterministic and HTTP suites continue to prove server result authority and replay/reset behavior.
- Live verification must inspect a before/action/result/continue journey, all four portrait cards, legibility and clipping at both declared browser viewports, result-stage diagnostics, and warning/error logs.

This slice advances result presentation and character-expression breadth. It does not prove human character attachment, visual taste, high-cadence motion, physical-phone usability, representative target-hardware frame pacing, human listening/mix quality, broader voice/content breadth, or steward approval.
