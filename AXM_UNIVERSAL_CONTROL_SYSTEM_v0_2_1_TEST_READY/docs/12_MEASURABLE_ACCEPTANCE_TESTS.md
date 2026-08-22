# 12. Measurable acceptance tests

These thresholds are gates for live AXM integration, not claims about unmeasured devices.

## Functional gates

| Test | Pass condition |
|---|---|
| Shared action path | One game accepts phone, keyboard, and physical Xbox-style controller through the same runtime without raw-device checks in game behavior. |
| Neutral release | Disconnect, stale timeout, blur, page hide, pointer cancel, lost capture, and adapter stop produce a full neutral state before movement can remain stuck. |
| Context transfer | A held action changes to its visible remapped action and releases the previous action when context changes. |
| Remapping | Required actions can be rebound to compatible controls without changing game code; orphaned required actions are reported. |
| One-handed mode | Left/right one-handed layout and explicit MOVE/AIM role switching remain visible and persistent after reload. |
| Layout persistence | Size and position changes survive reload for that game without overwriting unrelated scopes. |
| Multi-phone isolation | P1 input never changes P2 state and vice versa across generated and live frames. |
| Resume identity | A valid resume token reclaims the same seat; a mismatched device/token cannot take it. |
| Poison-frame rejection | Malformed, oversized, duplicate, non-finite, and unknown actions never reach the game runtime. |
| Legacy rollback | Original Robo Pong `/input` client still runs after the optional semantic endpoint is added. |

## Performance gates

Record median, p95, maximum, and sample count where meaningful.

| Metric | Initial target | Hard failure signal |
|---|---:|---:|
| Phone-to-host transport RTT on normal local Wi-Fi | median ≤ 45 ms; p95 ≤ 90 ms | repeated p95 > 150 ms |
| Server forwarding time | p95 ≤ 5 ms | p95 > 15 ms |
| Input sample rate while sticks move | 25–35 samples/s | sustained < 20 samples/s |
| Sequence gaps | < 0.5% over 10 minutes | > 2% |
| Reconnect | neutral ≤ 250 ms after detected loss; usable ≤ 3 s after network returns | stuck movement or wrong seat |
| Analog center drift | exactly 0 inside configured dead zone | nonzero movement at rest |
| Analog transformation error | record before/after magnitude error across calibration grid | large or discontinuous error |
| Frame-rate impact | host loses < 2 FPS at a 60 FPS target with four controllers | loss ≥ 5 FPS |
| Network traffic | record bytes/minute/controller | uncontrolled growth or > 2 MB/min without explanation |
| Battery | record 30-minute snapshots and device temperature | heating or abnormal drain requiring investigation |
| Accidental touches | marked rate per play session and location | repeated unintended actions in normal grip zones |

RTT can be measured without synchronized clocks. One-way input latency cannot be claimed until clocks are synchronized or a defensible offset method is added. Battery snapshots are correlation evidence only and do not prove causation.

## Required live categories

1. top-down movement;
2. twin-stick action;
3. platformer;
4. driving/vehicle;
5. menu-heavy simulation;
6. turn-based;
7. local cooperative multiplayer;
8. multiple phone controllers.

The scenario profiles in this package prove schema and control-path fit only. Their live migration fields remain false in `proof/SCENARIO_PROOF_MATRIX.json`.
