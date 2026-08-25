# Evidence route — local co-op action game v2.21

Status: `TEST` branch · generated candidate remains `EXPERIMENTAL`

The game output is the primary truth surface for playability and visible quality. Focused engine checks cover deterministic state and counterexamples only; they do not substitute for play.

| Claim | Native proof surface | Verdict |
| --- | --- | --- |
| Both keyboard seats independently move and fire | Live browser inputs and visible state | PASS |
| Proximity link is visible and changes when players separate | Live browser inputs, HUD, and arena | PASS |
| Warden practice exposes the boss without a hidden scenario | Visible button and live browser journey | PASS |
| Overlapping bolts hit rather than tunneling through the Warden | Live boss fight plus focused regression trace | PASS |
| Warden defeat produces score and repairs the damaged shared reactor | Live browser journey: enemies `1 → 0`, reactor `76 → 88`, P1 score `0 → 5` | PASS |
| The game is fun and balanced for two humans | Mike / second-player play judgment | UNKNOWN |
| Frame-perfect timing or transient flicker is clean | Ephemeral rolling-buffer hand unavailable | UNKNOWN |

No browser observation proves installation, publication, persistence, provider use, or CANON. Those remain absent or held.
