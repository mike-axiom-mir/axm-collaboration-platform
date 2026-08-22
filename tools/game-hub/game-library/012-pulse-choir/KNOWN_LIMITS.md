# Known limits

- Physical phone/controller QA has not been performed.
- Steam depot packaging, overlays, achievements, controller glyph certification, and distribution builds have not been exercised.
- Crash recovery is same-host and same-roster only. Checkpoints expire after 30 minutes by default; there is no cross-machine host migration.
- There is no host migration, remote matchmaking, account identity, voice chat, or internet service.
- AI is intentionally lightweight and deterministic; it does not claim human-like cooperation.
- The LIVE CONDUCTOR is deterministic authored adaptation from bounded receipts, not a learning system or a claim that it understands the room’s emotions.
- Audio is synthesized locally after a user gesture. There are no authored music or voice assets.
- Balance is a second playable pass. The TRIAD payout, 6.5-second chain window, shield frequency, 75-second target, and hazard cadence need human game-night testing.
- The five Constellation Circuit mastery goals and venue modifiers are deterministic and tested, but their difficulty curve and the full roughly eight-minute room arc still need human playtesting.
- ROOM SIGNAL authority, deterministic resolution, persistence, and cross-surface parity are verified; whether TOGETHER, BOLD, and FLOW feel equally meaningful or produce healthy social negotiation remains a human playtest question.
- The venue stage is genuine lane-local WebGL 3D, while performers, beats, hazards, labels, and effects remain an authoritative Canvas overlay. A fully 3D actor/effect renderer is not claimed.
- WebGL failure falls back to the previous authored Canvas presentation. The fallback remains playable but does not satisfy the preferred 3D presentation target.
- The arena is authored for a 16:9 shared display; unusual ultrawide and very short viewports still use a cropped atmospheric treatment.
- Canvas interpolation is cosmetic. The server remains authoritative and no local prediction claim is made.
- The same shared-screen route is used for playable keyboard input and spectators; Game Hub still keeps the display from occupying a player seat.
- This verifier backend blocks direct browser rendering of the local Game Hub on port 8790. The completed-show callback, stored result, Hub lobby transition, child shutdown, and fresh relaunch are verified natively, but the final Hub-page landing is not visually proven here.
