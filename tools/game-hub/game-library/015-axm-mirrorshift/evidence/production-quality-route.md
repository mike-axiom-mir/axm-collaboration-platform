# Production quality evidence route

## Slice claims

### `driving.drift.equal-contract`

- Kind: deterministic behavior; risk medium.
- Pass condition: gas + brake + steering above the shared minimum speed charges three declared tiers; release grants the tier's declared boost; every racer uses the same contract; hit/off-road cancellation remains meaningful.
- Primary surface: `tests/mirrorshift-selftest.js` known-input assertions.
- Counterevidence: per-character performance branches, boost without qualifying charge, off-road boost farming, or hit immunity during boost.
- Secondary surface: held-out AI soak and live HUD/VFX sequence.
- Current verdict: deterministic, soak, and live visual sequence PASS; human driving-feel judgment remains open.

### `balance.seed-smoke`

- Kind: learning/balance improvement; risk medium.
- Pass condition: 24 held-out deterministic seeds all resolve within budget, at least three seats win, no seat exceeds 58%, average duration remains 18-90 seconds, and AI exercises the player drift contract.
- Primary surface: `tests/quality-soak.test.js`.
- Counterevidence: non-resolving races, implausible finishes, one-seat dominance, or unused drift mechanic.
- Secondary surface: larger sample and human game-night results.
- Current verdict: 24-seed smoke PASS; production-scale balance remains UNKNOWN.

### `combat.threat-readable`

- Kind: visual appearance and interaction; risk medium.
- Pass condition: incoming targeted bolt or nearby armed mine produces a visible labelled warning; hit, drift cancellation, shield state, and recovery remain legible without colour alone.
- Primary surface: live browser before/action/settled screenshots.
- Counterevidence: attack lands without anticipation, alert sticks after threat, HUD collision, or colour-only state.
- Secondary surface: deterministic projectile/hit tests.
- Current verdict: PASS for implemented warning readability; live MINE NEARBY was visible after correcting start scroll and HUD stacking. Four-human attack-storm judgment remains open.

### `presentation.motion-language`

- Kind: motion/timing and visual quality; risk medium.
- Pass condition: drift sparks intensify by tier, release produces a distinct boost burst, high speed adds restrained streaks, impact adds bounded shake, reduced-motion disables intense screen motion, and the track/HUD remain readable.
- Primary surface: repeated browser frames at a declared viewport.
- Counterevidence: unreadable blur, clipping, continuous shake, effect/state mismatch, or reduced-motion violation.
- Secondary surface: source inspection and semantic HUD state.
- Current verdict: PASS for implemented drift/boost/threat motion language at 1280x720; reduced-motion and representative-player judgment remain open.

### `presentation.result-stage`

- Kind: deterministic presentation, visual composition, responsive layout, and reduced-motion behavior; risk medium.
- Pass condition: every Circuit Crown, Signal Tour, and Mirror Core result renders exactly four server-ranked entrants; Mike, Axiom/Mir, Codex, and Mirror each use one distinct bounded identity moment; mode-native metrics remain truthful; the stage adds no authority or performance change; reduced motion settles statically; desktop and 390x844 layouts retain all cards, rules, and the continuation action without overlap or inner overflow.
- Primary surfaces: frozen `RESULT_STAGE_MOMENTS`, pure `resultStagePose`, `tests/result-stage.test.js`, `evidence/mirror-podium-contract.md`, and the V21 race/battle live journeys in `evidence/visual-verification.json`.
- Counterevidence: missing or duplicate entrant, client-authored ranking, clipped continuation action, card overlap, stale race metrics in battle/tour, unbounded transform, reduced-motion animation, authority mutation, or a result pose altering gameplay state.
- Current verdict: PASS for the bounded local V21 contract. All 112 deterministic poses pass; natural race and Mirror Core debriefs each showed four distinct moments and truthful ordering; rematch preserved the selected mode; 1280x720 and 390x844 composition checks had no overlap or inner overflow; browser warning/error logs were empty. Human attachment, art-direction approval, high-cadence target-display motion, representative hardware, and physical phones remain open.

### `presentation.start-grid`

- Kind: deterministic presentation, interaction, responsive layout, and reduced-motion behavior; risk medium.
- Pass condition: every Circuit Crown, Signal Tour, and Mirror Core countdown renders exactly four authority-owned seat/character assignments; each identity uses one distinct bounded ready moment; mode/route/signal copy remains truthful; the reveal adds no authority or performance change; reduced motion settles statically; desktop and 390x844 layouts retain the countdown and all cards without overlap or horizontal overflow; visible mode controls reach the server authority.
- Primary surfaces: frozen `START_GRID_MOMENTS`, pure `startGridPose`, `tests/start-grid.test.js`, `evidence/start-grid-contract.md`, and the V22 three-mode public-control journeys in `evidence/visual-verification.json`.
- Counterevidence: missing/duplicate entrant, client-authored seat or mode state, hidden HUD hit interception, clipped countdown, card overlap, stale route/signal copy, unbounded transform, reduced-motion animation, authority mutation, or a start-grid pose altering gameplay.
- Current verdict: PASS for the bounded local V22 contract. All 112 deterministic poses pass; public controls selected and launched Mirror Core, Signal Tour, and a configured reflection Circuit Crown; all four distinct moments remained visible; 1280x720 and 390x844 compositions had no horizontal overflow; each countdown transitioned into server-owned play; browser warning/error logs were empty. Human attachment, independent art direction, high-cadence target motion, representative hardware, physical phones, and steward approval remain open.

### `audio.engine-responsive`

- Kind: audio quality; risk medium.
- Pass condition: engine pitch/filter follows player speed, drift changes timbre, event layers are distinct, mute silences the continuous layer, and the mix is acceptable on target speakers.
- Primary surface: physical listening or captured audio from the actual runtime.
- Counterevidence: stuck oscillator, audio after mute, clipping, fatigue, or events masked by engine.
- Current verdict: implementation exists; listening evidence UNKNOWN.

### `audio.music-adaptive`

- Kind: deterministic behavior plus audio quality; risk medium.
- Pass condition: each circuit and Mirror Core has a distinct profile; lobby, countdown, race pressure, final lap, battle pressure, showdown, and results select bounded layers deterministically; mute silences the music bus; the mix remains readable and non-fatiguing on target speakers.
- Primary surfaces: `musicStateFor` focused assertions and live `window.__MIRRORSHIFT_AUDIO__` transition/mute telemetry.
- Counterevidence: profile leakage, stale cues, scheduler stalls, audio after mute, clipping, masked engine/events, or listener fatigue.
- Current verdict: functional adaptation and mute contract PASS; listening and mix-quality judgment UNKNOWN.

### `reliability.input-session-continuity`

- Kind: transport, persistence, and interaction recovery; risk high.
- Pass condition: screen and phone retain stable client identities, receive monotonic next-sequence handshakes, produce tied action acknowledgements and measured request-to-ack telemetry, survive page reload, recover after authoritative process replacement, and can coexist on one seat without neutral input overwriting an active controller.
- Primary surfaces: live controller baseline/reload/reconnecting/recovered sequence plus `/api/telemetry` sender/receiver receipts in `evidence/visual-verification.json`.
- Counterevidence: stale-sequence rejection after reload, silent disconnected controls, session eviction, sequence collision, neutral-client cancellation, or match-state persistence claimed after a process reset.
- Secondary surfaces: `tests/server-http.test.js`, `tests/restart-recovery.test.js`, and the 30-virtual-minute `tests/reliability-soak.test.js` rotation workload.
- Current verdict: PASS for local session continuity and acknowledged transport. Physical phone/router behavior and in-progress match persistence across authoritative process replacement remain outside the claim.

### `reliability.local-rotation-soak`

- Kind: deterministic lifecycle and bounded local resource smoke; risk medium.
- Pass condition: 12 alternating race/battle rotations cover 30 virtual minutes, every requested resume/action is acknowledged without stale-session rejection, each rotation settles, server tick p95 stays within 5 ms, and heap growth remains below the declared 96 MB smoke ceiling.
- Primary surface: `tests/reliability-soak.test.js` under the named accelerated workload.
- Counterevidence: rejected resumed action, unresolved rotation, session-sequence regression, tick-budget breach, or unbounded heap growth.
- Current verdict: PASS for accelerated local lifecycle behavior; UNKNOWN for real-time target-hardware thermal, battery, Wi-Fi, and frame-pacing safety.

### `reliability.four-phone-lan-qualification`

- Kind: transport, interaction journey, persistence/recovery, physical setup attestation, and evidence capability; risk high.
- Pass condition: before the clock starts, healthy telemetry reports exactly one currently connected and explicitly confirmed controller identity for every P1–P4 seat and records only sanitized counts; one stable controller-kind session per seat then remains simultaneously connected for at least 95% of a requested 30-minute run; every seat produces applied meaningful drive, fire attempt, at least ten heartbeats and RTT samples, and RTT p95 at or below 80 ms; at least one stable-session resume and one same-seat input-owner rejection are observed; telemetry remains healthy; all three physical host attestations are explicit; receipt retains no session IDs, address, user agent, or raw actions; the physical verdict remains external.
- Primary surfaces: `tests/four-phone-lan-qualification.test.js`, per-session sender/receiver HTTP assertions, and a live host-panel/four-controller/reload/overlap journey.
- Counterevidence: START can run with a missing, duplicate, disconnected, stale, or unconfirmed controller identity; a closed duplicate requires a server restart; a screen client can confirm or counts as a phone; confirmation disappears on same-session reload; identity becomes unstable; connection ratio or challenge evidence is low; RTT, reconnect, or owner protection evidence is absent; an attestation auto-checks; raw identifiers are retained; a short smoke becomes eligible; or JavaScript self-certifies physical phones.
- Secondary surface: eventual externally observed 30-minute intended-router session with the appointed steward.
- Current verdict: PASS for the local measurement-hand, start-preflight, and controller-seat-confirmation contracts. Held-out cases cover ready, missing, duplicate, stale-disconnected, unhealthy telemetry, unconfirmed P3, controller/screen confirmation authorization, same-session confirmation resume, and a 101-snapshot 30-minute qualification with four stable seats, reconnect, owner protection, privacy, complete/partial semantics, and the external verdict boundary. At the default 1280×720 browser surface, live local controller tabs showed 4/4 connected but 0/4 confirmed and blocked, changed individually from `CONFIRM P#` to `START`, enabled host START only at 4/4 confirmed, preserved P1 confirmation across reload, and produced a 10-second partial receipt with confirmation readiness true, zero authority writes, and the physical verdict external; browser warnings/errors were empty. The advertised 390×844 override did not alter the live viewport, so current portrait confirmation layout remains unobserved. The tabs are explicitly not phones, all attestations remained false, and `qa.physical-four-phone-lan` stays UNKNOWN until an externally observed 30-minute intended-router run uses four real phones.

V17 responsive follow-up: an explicit 390×844 browser override now rendered the P1 controller without clipping and exposed tour/point/lap, steer, brake, gas, fire, confirmation, drift, catch-up, and three guard segments. This supersedes only the earlier portrait-layout observation gap; it is still a local browser surface, not a physical phone, touch-feel, intended-router, or four-device receipt.

### `transport.managed-lan-bind`

- Kind: transport reachability and launch-policy compatibility; risk high.
- Pass condition: an AXM Game Hub-managed child without an explicit `HOST` binds `0.0.0.0`, an ordinary standalone child without `HOST` binds `127.0.0.1`, explicit operator overrides win, and the managed socket serves health through both loopback and an available private host interface.
- Primary surfaces: `resolveHost` in `runtime/server.js`, `tests/managed-lan-bind.test.js`, and `evidence/managed-lan-bind-contract.md`.
- Counterevidence: managed launch resolves loopback, standalone launch expands exposure without consent, explicit `HOST` is ignored, or the private-interface self-probe cannot reach the all-interface socket.
- Current verdict: PASS for host-interface binding. The same-machine private-interface probe does not prove a firewall exception, intended-router isolation policy, Wi-Fi latency/recovery, or physical-phone reachability; `qa.physical-four-phone-lan` remains UNKNOWN.

### `identity.character-draft`

- Kind: deterministic behavior, persistence, and cross-screen interaction; risk medium.
- Pass condition: every stable seat can select any of four unique characters only in the lobby; choosing an occupied identity atomically swaps it; character name, signature, palette, and vehicle body move together; seat ownership, assists, input order, and equal performance do not change; rematch reset preserves assignments.
- Primary surfaces: focused `setCharacter` assertions, `/api/character` HTTP lock/reset receipts, and the live shared-screen plus P2-controller swap sequence in `evidence/visual-verification.json`.
- Counterevidence: duplicate identities, character styling left on the old seat, controller/AI ownership movement, any stat change, mid-race selection, or reset reverting the draft.
- Current verdict: PASS for implemented deterministic and live local interaction contracts. Human character appeal, physical-phone touch, and the updated 390px-width layout remain outside this claim.

### `identity.signature-expression`

- Kind: deterministic behavior, visual motion, functional audio state, and quality; risk medium.
- Pass condition: four frozen identity profiles remain unique, declare no performance change, move with draft identity, provide materially different bounded flourish geometry and four-note motifs, respect reduced motion and SOUND, expose readable launch/result labels, and do not disturb fairness or lifecycle regressions.
- Primary surfaces: expression-contract and identity-event assertions in `tests/mirrorshift-selftest.js`; before/countdown/launch/result Browser sequence; DOM-tied `axm.character-expression-diagnostics/v1` cue/note/visual receipts.
- Counterevidence: expression branch modifies speed/handling, stale expression after a swap, indistinguishable visuals/motifs, flourish obscures race state, audio ignores mute, reduced-motion motion remains intense, or soak outcomes change.
- Secondary surfaces: complete race/track/battle/reliability suites and live frame-delta smoke.
- Current verdict: PASS for the implemented non-mechanical local presentation contract. Human listening quality, character attachment, physical-phone output, full animation/voice breadth, and target-hardware performance remain UNKNOWN.

### `presentation.kinetic-identity`

- Kind: deterministic presentation behavior, visual motion, accessibility, and local performance; risk medium.
- Pass condition: four identity-bound rigs remain unique and presentation-only; idle, drive, brake, drift, boost, impact, wheel, suspension, and signature-phase poses remain finite and bounded; reduced motion clamps ambient/reaction amplitudes and freezes cycling; character swaps move the rig; no authority object, stats, catch-up, item weights, or Flux Guard contract changes.
- Primary surfaces: frozen `KINETIC_RIGS`, pure `vehicleAnimationPose`, and `tests/kinetic-rig.test.js` across 108,000 poses with finite/amplitude/reduced-motion/no-mutation/frozen-mechanics assertions.
- Counterevidence: NaN/unbounded pose values, rig left behind after identity swap, reduced-motion cycling or full-amplitude reaction, a stat/authority mutation, clipped/unreadable active scene, browser errors, or measured local actor/render regression.
- Secondary surfaces: 1280×720 live lobby/countdown/active/reset still sequence; DOM-tied all-four draft-to-rig mapping; idle-to-drive state and 8,499+ pose frames; active 1.48 ms average / 3 ms p95 total render work with 0.4 ms actor average; zero browser warnings/errors.
- Current verdict: PASS for the bounded local deterministic, accessibility, visual-composition, and render-work claims. High-cadence motion quality remains UNKNOWN because no rolling buffer is exposed; representative target hardware, physical phones, human attachment, broader animation/voice breadth, and steward approval remain separate open gates.

### `presentation.authority-packet-interpolation`

- Kind: deterministic presentation behavior, motion/timing, and authority separation; risk medium.
- Pass condition: ordinary racer poses follow a bounded linear path and shortest heading arc between consecutive authority packets; jumps above 180 world pixels snap immediately; input, physics, collision, ranking, stats, and packet objects remain unchanged; race and battle visuals retain their authored composition.
- Primary surfaces: pure `interpolatePresentationPose` assertions plus `tests/presentation-pipeline-soak.test.js` across 45,504 interpolated poses and 864 injected teleport snaps.
- Counterevidence: mutation of either authority packet, long-arc heading rotation, overshoot, interpolation across a reset/teleport, render-budget regression, or a visual layer changing authoritative state.
- Secondary surfaces: active Null Foundry Redline and Mirror Core DOM-tied diagnostics reporting interpolation frames, zero unexpected snap frames, authority packet cadence, render-stage costs, and complete 1280×720 screenshots.
- Current verdict: PASS for deterministic presentation behavior and preserved visual composition. Perceived high-cadence smoothness is UNKNOWN because this environment exposes repeated still frames rather than a rolling buffer or target display.

### `performance.client-render-work`

- Kind: measured performance under named local workloads; risk high.
- Pass condition: active authored race and battle scenes keep Canvas render-work p95 under 16.7 ms and HUD update p95 under 5 ms without deleting effects, characters, hazards, music state, or defence/status UI.
- Primary surface: DOM-tied `axm.render-performance-diagnostics/v1` stage samples under active Null Foundry Redline and active Mirror Core.
- Counterevidence: render p95 at or above 16.7 ms, HUD work above 5 ms, hidden visual reductions, frame cadence mislabeled as render cost, or local preview data presented as representative hardware proof.
- Secondary surface: complete 1280×720 screenshots, full simulation regression, and target-hardware profiling when available.
- Current verdict: PASS for the bounded local render-work claim: Redline 1.44 ms average / 3.3 ms p95 with HUD 0.55 / 0.8 ms; Mirror Core 1.41 / 2.8 ms. The separate end-to-end 60 fps and hardware-duration gate remains UNKNOWN/DEGRADED because preview frame p95 was 34.9–55.6 ms with 28.5–43.7 ms outside measured render work.

### `performance.target-session-recorder`

- Kind: measurement capability, deterministic aggregation, visual interaction, and authority separation; risk high.
- Pass condition: an opt-in 2-, 10-, or 30-minute session produces `axm.target-session-performance/v1`; bounded histograms summarize frame/render/HUD/tick/latency/long-task/supported-memory signals; workload and interruption/recovery transitions remain compact; stopped-early sessions stay `partial`; no user agent, address, raw frame log, external upload, or authority write is retained.
- Primary surfaces: `tests/target-session-recorder.test.js` held-out 108,000-frame/30-minute receipt plus package/static assertions.
- Counterevidence: unbounded samples, false `complete` status, hidden authority mutation, raw identifying data, recorder enabled during ordinary play, missing unsupported-API labels, or a local receipt presented as external hardware proof.
- Secondary surfaces: opt-in live Browser journey, HTTP delivery, and external profiler join during the eventual target run.
- Current verdict: PASS for the local measurement-hand contract after the 108,000-frame held-out test, HTTP/static admission, and live lobby/active-race smoke. The actual 30-minute target-hardware, thermal/compositor, 60 fps, and perceived-motion verdicts remain UNKNOWN until native evidence exists.

### `quality.beyond-aaa`

- Kind: whole-product quality and taste; risk high.
- Pass condition: every gate in `PRODUCTION_QUALITY_PLAN.md` passes on native evidence and AXM's human steward explicitly approves the finished comparison after repeated representative sessions.
- Primary surface: gate receipts plus human steward judgment.
- Counterevidence: any missing track/mode, unverified device, unresolved severity-one issue, or withheld human approval.
- Current verdict: NOT ACHIEVED; the active goal must remain open.

### `content.race-variants.three`

- Kind: deterministic behavior, balance, presentation, and complete journey; risk medium.
- Pass condition: Clear Signal, Shardline Sprint, and Redline Gauntlet are lobby-only choices with 3-, 2-, and 4-lap contracts; each creates materially different but readable hazard, item, shortcut, off-road, tempo, and visual pressure; no variant changes the frozen vehicle statistics or rank catch-up; selection persists through reset/result/replay and appears correctly on desktop and phone.
- Primary surfaces: frozen `RACE_VARIANTS` plus focused state/lock assertions, `/api/variant` HTTP receipts, and the 72-race 3-track × 3-variant held-out matrix in `tests/variant-soak.test.js`.
- Counterevidence: mid-match switching, lap totals disagreeing across authority/HUD/result, variant-specific stat or catch-up branches, unreadable atmosphere, one non-resolving format, or a format only proven by renamed copy.
- Secondary surfaces: 1280×720 lobby/countdown/active/result Browser sequence, DOM-tied `axm.race-variant-diagnostics/v1` receipts, adaptive-score status, and the controller's active `LAP 1 / 4 · REDLINE` state.
- Current verdict: PASS for the implemented three-format alpha contract. More race-format breadth and representative human preference/balance judgment remain open.

### `content.replay.mirror-echo`

- Kind: deterministic presentation behavior, bounded session memory, repeatable content, and visual interaction; risk medium.
- Pass condition: a completed lap begins from a valid observed boundary, retains no more than 720 samples, compacts rather than silently truncates long traces, replaces the course record only when faster, follows the shortest heading arc, appears only on a matching circuit/variant/direction, never enters Mirror Core, makes no authority write or packet mutation, cannot collide or occupy a seat, and tells players it is a replay rather than a fifth racer.
- Primary surfaces: `runtime/mirror-echo.js`, `tests/mirror-echo.test.js`, and `evidence/mirror-echo-contract.md`.
- Counterevidence: authority/state mutation, packet growth, collision or scoring effect, hidden fifth seat, stale course playback, battle playback, unbounded trace growth, long-arc rotation, misleading record text, clipped HUD/hologram, or frozen-mechanics drift.
- Secondary surfaces: the V20 natural 1280x720 reflection empty-lobby/first-seal/results/rematch journey, 390x844 responsive active-race composition, DOM-tied `axm.mirror-echo/v2` diagnostics, and full legacy regressions.
- Current verdict: PASS for the bounded local capture, direction-isolated replay, authority-separation, and composition contract across 18 course identities. The live reflection session sealed Mirror at 0:10.259 and the rematch rendered a labelled non-colliding hologram while all four racers stayed present. High-cadence target motion, persistent/shareable ghosts, a dedicated solo time-trial mode, human replay preference, real phones/router, and steward approval remain open.

### `content.routes.reflection`

- Kind: server-authoritative route derivation, deterministic remapping, presentation, and repeatable content; risk high.
- Pass condition: Circuit Crown accepts lobby-only forward/reflection direction; reflection preserves the finish reference, reverses remaining traversal, remaps checkpoint/item/hazard indices, swaps and remaps shortcut direction, leaves canonical forward tracks immutable, persists through reset/rematch, and is disclosed consistently by authority state, health, HUD, controller, and results. Signal Tour remains forward-only and no frozen mechanic changes.
- Primary surfaces: `deriveTrackForDirection`, `/api/route-direction`, `tests/reflection-route.test.js`, `tests/server-http.test.js`, and `evidence/reflection-route-contract.md`.
- Counterevidence: canonical track mutation, inconsistent progress order, stale forward indexed hazards/items, one-way shortcut mismatch, mid-race direction change, tour direction change, state/HUD disagreement, echo cross-direction leakage, or any change to equal stats, +7.5% catch-up, attack weighting, Flux Guard, or server authority.
- Secondary surfaces: 36 deterministic reflection races across all tracks/variants, live API geometry correspondence, and the complete 1280x720 select/countdown/race/result/rematch plus 390x844 responsive-browser journey.
- Current verdict: PASS for the declared local V20 route contract. All four seats win in the matrix with 91% AI finish rate, 420 shortcut commits, and 831 hazard hits; the live authority reversed point 1 to the canonical last point and preserved reflection through result/rematch. Physical phones, representative target hardware/cadence, human route preference, and steward approval remain open. Reflection is traversal breadth over three environments, not six authored environments.

### `content.signal-tour.complete-loop`

- Kind: deterministic progression, server authority, visual appearance, and repeatable content; risk high.
- Pass condition: lobby selection initializes a fixed Forge/Clear → Gardens/Sprint → Foundry/Redline itinerary; clients cannot manually replace a tour route or signal condition; each result awards 9/6/4/2 exactly once; standings use total points, latest-round placement, then stable seat order; one authority action loads and starts the next round; the final result preserves both round winner and cumulative champion; new tour resets round and points while retaining the existing equal-stat/assist/character contracts.
- Primary surfaces: frozen `SIGNAL_TOUR`, `tests/signal-tour.test.js`, `/api/tour/advance` and HTTP lock/reset assertions, `evidence/signal-tour-contract.md`, and the V17 live complete journey in `evidence/visual-verification.json`.
- Counterevidence: double-awarded points, client-selected itinerary, skipped round, reset losing accessibility/identity profiles, cumulative tie instability, final race winner overwriting the champion, hidden route change, clipped standings, or any change to 260/178/2.45 stats, +7.5% catch-up, 85% race attack drops, or three-segment repairable Flux Guard.
- Secondary surfaces: full legacy race/battle/variant/reliability regressions and the 390×844 responsive controller composition.
- Current verdict: PASS for the bounded local three-round alpha contract. One natural 1280×720 run reached all three active circuits, cumulative Round 1/2 debriefs, a 27-point Codex champion screen, and a clean Round 1/zero-point restart; warning/error logs were empty. Broader tournament/ghost content, physical-phone game-night behavior, human replay preference, animation breadth, and steward approval remain open.

### `battle.mirror-core.complete-loop`

- Kind: deterministic behavior, transport, visual appearance, and interaction; risk high.
- Pass condition: lobby-only mode selection enters a distinct timed arena; 90% attack drops; guard breaks score +1; unguarded wipes score +2; wiped players reboot with three guards and protected re-entry; score/timer victory produces ranked results and replay preserves the mode.
- Primary surfaces: `tests/mirrorshift-selftest.js`, `tests/battle-soak.test.js`, and the live Browser journey in `evidence/visual-verification.json`.
- Counterevidence: mode changes after start, score without a server hit, chain-hit farming during cooldown, damage during protection, missing player after wipe, race HUD leaking into battle, clipped controller, or replay returning to the wrong mode.
- Secondary surface: `/api/mode`, `/api/state`, `/api/observe`, and `/api/reset` transport assertions.
- Current verdict: PASS for the implemented alpha loop. The 32-seed smoke covered all four winning seats; representative four-human balance and physical-phone play remain outside this claim.
