# Four Roots Adventure gameplay trailer claim/evidence matrix

Status: `TEST`

| Claim | Evidence able to prove it | Verdict | Truth limit |
|---|---|---:|---|
| The replay comes from the real native game semantics. | The fixed journey calls the exact byte-bound native engine, records 228 ordered actions, and verifies every before/after state digest. | PASS | Proves this complete scripted journey, not every possible player journey. |
| The trailer shows gameplay state rather than abstract marketing cards. | Forty unique gameplay frames render actual 15x11 maps, player and actor coordinates, movement traces, roots, quests, discoveries, moves, and engine messages from exact checkpoints. | PASS | Frames are deterministic reconstruction, not browser capture or live player input. |
| All five zones and the completed ending are represented. | The plan cites eight checkpoints for each of five gameplay scenes; the final checkpoint is action 227 with `completed: true`. | PASS | Does not prove that every route, failure, or optional interaction is shown. |
| Player motion is evidence-bound. | The trailer selftest checks the rendered player-marker pixels against all forty checkpoint coordinates and verifies the full action state-digest chain. | PASS | Does not measure live-input latency or control feel. |
| The four-root order cannot be bypassed. | Replay and planner adversarial suites reject reordered, missing, `HOLD`, or `FAIL` root evidence; the deliberately early Agency attempt remains blocked before Truth. | PASS | Passing the technical gate does not make the result CANON. |
| The plan and artifacts are deterministic and byte-bound. | Repeated generation is byte-identical; strict schemas bind content, manifest, engine, replay file bytes, replay semantics, plan, frames, containers, and receipt. | PASS | Exact-digest changes require a new request and evidence. |
| The output is a real 30-second video. | MP4 and WebM structures parse, first/middle/last samples decode, and live Chromium playback reports duration 30, readyState 4, and no media error. | PASS | No public streaming or broadcast-platform compatibility claim. |
| Captions and instructions are available. | The English WebVTT track reports `showing`; visible copy states WASD/arrows and E/Space. | PASS | The video is silent; audio description and screen-reader behavior were not tested. |
| The bounded native route needed no AI provider or internet. | Replay, planner, receipt, and local server tests report zero provider calls and zero network requests; the renderer reports zero child processes. | PASS | This does not prove every future creation body can remain networkless. |
| Browser presentation works at desktop and narrow width. | Repeated live screenshots showed changing maps; 390x844 measurement reported 375 document pixels, a 305.6x171.9 video, visible controls, and no horizontal overflow. | PASS | One current Chromium surface only; no physical-phone or other-browser proof. |
| The trailer routes back to the actual TEST game. | Live navigation opened the game route and returned to the trailer without browser console errors. | PASS | Trailer observation does not replace the existing full game journey and restart tests. |
| Installation, publication, promotion, and CANON remain separate. | Contract, plan, manifest, receipt, and tests retain authority `NONE`, public rights `HOLD`, and lifecycle booleans false. | PASS | Mike remains the final merge and publication gate. |

Primary durable evidence:

- `tools/game-hub/game-library/020-four-roots-adventure/media/rendered/gameplay-replay.json`
- `tools/game-hub/game-library/020-four-roots-adventure/media/rendered/trailer-plan.json`
- `tools/game-hub/game-library/020-four-roots-adventure/media/rendered/verification-receipt.json`
- `tools/game-hub/game-library/020-four-roots-adventure/media/trailer-selftest.js`
- `shared/code-capability-fabric/selftest-deterministic-gameplay-replay-v1.js`
- `shared/code-capability-fabric/selftest-deterministic-gameplay-trailer-planner-v1.js`
- `LIVE_VISUAL_EVIDENCE.md`
- `capability-gap.before.json` and `capability-gap.after.json`

