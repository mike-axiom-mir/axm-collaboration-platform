# Four Roots Adventure trailer claim/evidence matrix

Status: `TEST`

| Claim | Evidence able to prove it | Verdict | Truth limit |
|---|---|---:|---|
| The plan is deterministic and byte-bound. | Planner selftest repeats the same request, validates strict closed schemas, and checks exact content/manifest digests. | PASS | Proves this declared recipe, not arbitrary semantic generation. |
| The trailer preserves the ordered four-root gate. | Planner rejects missing, reordered, `HOLD`, or `FAIL` root evidence; the rendered timeline names all four roots in order. | PASS | Does not make the game or trailer CANON. |
| Marketing claims come from game evidence. | Eight claims cite the exact content or manifest reference; inflated counts and authority claims fail closed. | PASS | Human taste and marketing effectiveness remain unmeasured. |
| The output is a real playable video, not a storyboard claim. | Native structure inspection, decoded first/middle/last samples, exact codec receipts, and separate live browser playback. | PASS | No broadcast-platform or streaming-service compatibility claim. |
| The result explains how to play. | Scene and caption text state WASD/arrows plus E/Space; the exact game manifest is the source. | PASS | Physical touch, gamepad, screen-reader, and console controls were not tested. |
| The output is bounded. | Receipt records 30 seconds, 640x360, 12 fps, 360 samples, 48 unique frames, 44,236,800 raw unique-frame bytes, zero children, and zero network. | PASS | Browser CPU, memory, GPU, and frame pacing were not independently measured. |
| AI and network are unnecessary. | The native builder and tests used pinned Workshop components; manifest and receipt say AI false and network false. | PASS | This does not prove that every future media adapter can be native-only. |
| Playback works in the local browser. | Live WebM load reached readyState 4 with no error; Replay advanced time and changed visible scenes. | PASS | One current Chromium surface only; other browser/device families remain unrun. |
| A narrow phone-sized layout is responsive. | A real 390x844 viewport showed a fitted 305.6x171.9 video and no horizontal overflow. | PASS | This is responsive browser evidence, not a physical-phone or touch test. |
| Publication and CANON authority remain outside the adapter. | Request, plan, manifest, player, and render receipt retain `TEST`, `publishAuthorized: false`, public-rights `HOLD`, and authority `NONE`. | PASS | Mike still decides integration, reuse rights, publication, promotion, and CANON. |
| One concept can later flow to other devices or worlds. | The game-to-trailer boundary demonstrates one typed content-to-body adapter. | PARTIAL | TV, phone app, VR, lights, hardware, and cross-device transport require separate adapters, consent, budgets, and sender/receiver evidence. |

Primary durable evidence:

- `tools/game-hub/game-library/020-four-roots-adventure/media/rendered/trailer-plan.json`
- `tools/game-hub/game-library/020-four-roots-adventure/media/rendered/verification-receipt.json`
- `tools/game-hub/game-library/020-four-roots-adventure/media/trailer-selftest.js`
- `shared/code-capability-fabric/selftest-deterministic-game-trailer-planner-v1.js`
- `LIVE_VISUAL_EVIDENCE.md`
- `capability-gap.before.json` and `capability-gap.after.json`
