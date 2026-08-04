# MIRRORSHIFT Reflection Routes contract

Schema: `axm.route-direction/v1`

V20 adds `forward` and `reflection` as server-authoritative, lobby-locked Circuit Crown route directions. This is authored traversal depth, not a stat variant: both directions retain the same four racers, `260 / 178 / 2.45` base specification, `+7.5%` catch-up ceiling, 85% attack-heavy race item pool, and repairable three-segment Flux Guard.

## Deterministic mapping

- The finish line remains at authored point zero. Reflection traversal keeps point zero and reverses the remaining closed point loop.
- Item-pad indices and indexed hazard indices map to the equivalent physical points in the reflected loop.
- Each physical shortcut swaps its authored entry and exit before both indices are remapped. Shortcut hazards are recomputed from the reflected segment.
- Existing forward checkpoint, lap, AI look-ahead, assist, shortcut, and progress logic then runs on the derived route without a second mechanical branch.
- Derived reflection tracks never mutate the canonical forward track definitions.

## Authority and mode boundary

- `/api/route-direction` is the only selection route. The server rejects unsupported values, non-lobby changes, Mirror Core changes, and Signal Tour changes.
- Signal Tour remains its sealed three-round forward itinerary. Mirror Core has no route direction.
- State, health, session, observation, results, HUD, controller copy, and diagnostics disclose the selected direction.
- Mirror Echo v2 keys records by circuit, signal condition, and direction; it remains presentation-only and bounded to 18 browser-session records.

## Verification contract

- `tests/reflection-route.test.js` checks fixed finish geometry, reversed point order, pad/hazard remapping, shortcut entry/exit inversion, canonical-track immutability, lobby/mode locks, frozen mechanics, and 36 reflection races across all three circuits and signal conditions.
- `tests/server-http.test.js` covers the authority endpoint, packet/health disclosure, active-race lock, and reset preservation.
- Live verification must show the unique reflection selector, reversed start grid and traversal, a direction-labelled HUD/result, complete four-racer composition, no browser errors, and a responsive browser layout. Browser views are not phone or target-hardware evidence.

This slice doubles traversal combinations from nine to 18 without claiming nine new authored environments. It does not prove real-phone/router operation, representative target-hardware frame pacing, human balance or replay preference, human listening, broader animation/voice breadth, or steward approval.
