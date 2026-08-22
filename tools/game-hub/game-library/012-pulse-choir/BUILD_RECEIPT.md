# Pulse Choir build receipt

Status: **playable human-stewarded Game Night alpha V4**.

Pulse Choir is installed as Game Hub slot `012` and currently launched through the managed Game Hub runtime with one human seat and two AI seats.

## What was built

- Server-authoritative 75-second co-op rounds.
- Four coarse phases: lobby, countdown, playing, results.
- Shape-coded collectible beats with safe, steady, and volatile risk/value choices.
- A real bank-now-versus-carry-more decision: Spark + Chord + Wild creates a high-value TRIAD, full cargo slows movement, and consecutive banks build a timed room multiplier.
- Shared central objective with a 1.9-second synchronized pulse window.
- Perfect synchronized surges grant one-hit choir shields; unshielded glitch hits break the harmony chain.
- Telegraph-first glitch lanes that can stun a player and drop one carried beat.
- Input sequence validation, short pulse buffering, bounded event/input ledgers, and deterministic random state.
- Separate AI decision and action execution through the same semantic input gate.
- One shared camera, an authored generated cosmic arena backdrop, code-rendered performer characters, layered stage lighting, trails, shockwaves, floating scores, local synthesized cues, reduced motion, high contrast, text/shape/light redundancy, and a measured frame-cost display.
- Responsive portrait controller with touch joystick, PULSE, Start, status, and optional haptics.
- Contribution-aware SHOW RECEIPT debrief with room totals, per-seat bank/pulse/hit evidence, a performance-specific replay challenge, and clean replay recovery into countdown.
- A deterministic, server-authoritative three-act LIVE SETLIST: every round selects one human-agency act, one whole-room act, and one risk/flow act from six authored contracts. Acts expose timed progress, rotate on timeout, award score through the rules host, and persist completion evidence into the SHOW RECEIPT.
- Server-owned SHOW MEMORY across an evolving three-round arc. Every completed round advances a deterministic seed, records a bounded receipt history, accumulates night score and cleared acts, preserves the best result, and publishes the exact next Setlist. Replay consumes that preview; abort/reset returns to the same unplayed round without erasing the night.
- A transparent, server-owned LIVE CONDUCTOR. The latest bounded receipt deterministically produces an OPENING, RECONNECT, LOCK-IN, or HEADLINER plan with a visible title, short cue, full reason, source round, and exact act kinds. The room sees why its next Setlist changed before pressing Start; no adaptation is hidden or client-authored.
- Human-only ROOM SIGNAL steering between completed rounds. Each eligible human has one replaceable TOGETHER, BOLD, or FLOW vote; the server owns validation, counting, stable tie resolution, exact next-act replacement, checkpoint persistence, round consumption, and receipt storage. AI attempts are refused, while the shared lobby and portrait controller expose the winning count, transparent reason, and exact resulting Setlist.
- Checkpoint-safe Conductor schema evolution. Restored pre-cue result snapshots are normalized into the current plan contract without losing the completed receipt, current-round Setlist, next-round preview, or night totals.
- Quiet support AI outside active play. Lobby/results idle decisions no longer advance AI input sequences or fill the bounded action ledger with rejected synthetic inputs.
- Crash-safe same-host SHOW CHECKPOINTS. The runtime writes a bounded, roster-bound checkpoint through temporary write, fsync, and atomic rename; a fresh managed process restores live phase, score, show history, Setlist, player state, and input sequences while pausing deadlines across downtime. Corrupt, expired, or roster-mismatched data falls back to a fresh lobby, and New Show deliberately clears retained night memory.
- An explicit, server-authoritative Game Hub handback. After a completed round, the shared display offers a two-step Return to Game Hub action. The host projects a bounded show summary from SHOW MEMORY, delivers it once to the configured loopback Hub callback, retires the completed-show checkpoint, and preserves recoverability if the callback fails.
- Shared-screen and portrait-controller Setlist parity, including act number, title, instruction, progress, human-link/room-flow semantics, remaining time, completion feedback, and receipt chips.
- Clean recovery semantics: replay resets the authoritative round and the two-step mid-round reset now clears stale gameplay announcements when it returns to the lobby.
- Automatic discovery by Game Hub; no root router or existing game package needed modification.
- Support AI keeps the room active but bank points are weighted to 40% of human value; a deterministic and full live unattended round both prove two AIs cannot carry an idle human to HEADLINER.

## Atlas use

`CAPABILITY_PLAN.json` maps every module in balanced wave 1 to a concrete implementation. Twenty targeted supporting patterns cover the 30-second truth, cooperative interdependence, input recording/buffering, camera-safe metrics, explicit phases, transactional interaction, timing accessibility, seeded randomness, cooperation rewards, lighting state, reduced-intensity presentation, real-event profiling, sequenced input, deduplication, authoritative seats/objectives, shared-camera rules, command validation, and replay/state diffs.

## Verification

- Pure core and package self-test: **23 PASS, 0 FAIL**, including deterministic receipt-adaptive Conductor modes, human-only ROOM SIGNAL authorization/resolution/consumption, legacy-state normalization, show-memory replay/abort safety, Setlist determinism/variation, authoritative timeout rotation, human gating, bonus scoring, receipt closure, TRIAD scoring, harmony expiry, perfect-sync shields, AI contribution weighting, the idle-human rank guard, and idle-AI ledger suppression.
- Fresh-process HTTP lifecycle: **PASS** for health, static screen, controller, start, action, authoritative Setlist/show-memory state, changed-seed replay, abort-safe recovery, seat observation, stale-sequence refusal, telemetry, and reset.
- Separate-process crash-recovery suite: **PASS** for active-round restore, paused clock, neutral held input, stale-sequence refusal after restart, next-sequence acceptance, New Show, corrupt checkpoint, expiry, and roster mismatch.
- Focused Game Hub package verifier: **PASS slot 012**. The concurrently changing library is not used as evidence for this lane.
- Game Night and recovery self-tests: **PASS**.
- Live Game Hub API: **11 games; Pulse Choir discovered and managed launch PASS**.
- Live V2 desktop and phone-browser checks: **PASS**, 0 browser warnings/errors. The full lobby fits exactly at 1280×720, active play fits at 1280×800, and the portrait controller has no measured overflow at 390×844.
- Live contribution debrief: **PASS** at 1280×720 after a complete managed round. The authoritative result, room totals, all three seat contributions, next challenge, and Play Another Round fit without scrolling; replay cleared the debrief and restored the countdown contract.
- Full live final-balance round: **PASS**. With the human seat at 0 banked beats and 0 pulses, support AI finished at 2222 / IN RHYTHM rather than HEADLINER.
- Full managed LIVE SETLIST round: **PASS**. CALL & RESPONSE, PASS THE MIC, and RIDE THE STATIC rotated on the authoritative clock; RIDE THE STATIC cleared at 2/2, awarded 240 points, and produced a 2545 / IN RHYTHM receipt with SETLIST 1/3. Desktop active play/results and the portrait controller had no measured overflow, replay entered countdown at score 0000, reset recovered to a clean lobby, and browser warnings/errors stayed at zero.
- Full managed SHOW MEMORY journey: **PASS**. Round 1 seed 12026 finished at 2661 / IN RHYTHM and previewed Round 2 seed 12027 with HUMAN SPOTLIGHT / ONE-BREATH CHOIR / RIDE THE STATIC. Replay produced that exact changed plan on the shared stage and portrait controller. Aborting Round 2 preserved the Round 1 receipt and returned to an unconsumed Round 2 lobby. A duplicated result row and phone header mismatch found during visual QA were fixed; final 1280×720 and 390×844 views had no overflow or browser warnings/errors.
- Managed runtime restart: **PASS**. The shared display visibly traversed HOST LIVE → RECONNECTING → HOST RESTORED. A new runtime process recovered seed 12026, Round 1, score 1183, revision 901, 39.420 seconds remaining, p1 position, active Setlist act, and p1 input sequence 2 exactly; held input restored neutral. The controller exposed REJOINED, and the completed round's memory remained available in the Round 2 lobby.
- Managed Game Hub handback: **PASS** for the authoritative sender and receiver path. Session `session-1785243247668` returned one completed round and 2686 night points; Game Hub stored the exact summary, moved to LOBBY, and stopped the child runtime. The next managed launch, `session-1785243494983`, started fresh at Round 1 with zero history and night score. The shared display visibly showed the confirmation and `SHOW SAVED · RETURNING` states. Direct visual proof of the final Hub page landing remains **UNKNOWN** because this verifier backend blocks local port 8790; Hub receipt/application is proven through native HTTP state instead.
- Managed LIVE CONDUCTOR journey: **PASS**. Opening Round 1 finished at 2349 / IN RHYTHM with one act cleared, zero human banks/pulses, zero perfect choirs, and best chain 13. The host published `RECONNECT SET · CLEARER HUMAN LINK` with CALL & RESPONSE / PASS THE MIC / CHAIN REACTION. Shared result/lobby and portrait result/active views exposed the same reason and plan with zero measured overflow or browser warnings/errors. The result card fit 7 px inside the 1280×720 stage and the active controller fit 19 px inside 390×844. A managed restart also proved nested result-memory migration before the feature was replayed and reset safely to the Round 2 lobby.
- Managed ROOM SIGNAL journey: **PASS**. In session `session-1785246383789`, Mike selected BOLD on the 390×844 controller and the host recorded `BOLD 1/1`; an AI FLOW attempt returned HTTP 403 without changing revision, tally, or plan. The shared Round 2 lobby exposed the receipt-derived RECONNECT reason plus the human override and exact HUMAN SPOTLIGHT / PASS THE MIC / RIDE THE STATIC plan. Starting the round instantiated those exact server-owned acts, and shared/portrait active views both rendered HUMAN SPOTLIGHT. All observed pages had zero overflow and zero browser warnings/errors. A final native countercheck caught and fixed an abort-only round-label/seed regression; managed session `session-1785247439914` now rests in the exact unplayed Round 2 / seed 12027 lobby with the BOLD vote preserved, an empty input ledger, and all player sequences at zero.
- Focused slot 012 package verifier: **0 errors, 1 warning**. The only Pulse Choir warning is physical-phone QA; disconnect recovery is verified. The concurrent full-library snapshot reported 9 failures in unrelated active lane 016 plus 34 warnings, so it is not used as evidence against or for this lane.
- Authoritative local telemetry, 120 samples at 20 Hz: average simulation tick `0.092 ms`, p95 `1 ms`, declared server tick budget `4 ms`. This short desktop sample is not a general device-performance claim.

## Capability status

All required evolving-round, adaptive-conductor, human-steering, human-agency, surface-parity, resilient-session, managed-handback, and verification requirements are `READY`. The aggregate 2030 capability report is `DEGRADED` only because optional or future-scale gates remain open:

- physical-phone QA is unavailable in this task;
- human Game Night fun/replay judgment is still unknown;
- direct visual proof of the final Game Hub page landing is unavailable in this verifier backend; and
- production-scale networking and matchmaking are intentionally outside this local alpha.

## Playtest question

After one round, ask: **Did the LIVE CONDUCTOR’s explanation feel accurate—and did choosing TOGETHER, BOLD, or FLOW create a real room conversation before the next Setlist began?**

If not, tune timing and decision pressure before adding content.
