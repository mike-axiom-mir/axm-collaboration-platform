# Bloomvale: Gatewatch — build receipt

- Artifact: `013-toonfall-gatewatch`
- Version: `0.5.0-chronicle-3d`
- Last stewarded: 2026-08-16 09:10 CEST
- Status: **WORKING — STEWARDED GAME NIGHT BUILD — NEEDS MIKE'S REVIEW**
- Approval: Mike review required; this receipt does not declare canon or a public release.

## Continued stewardship — 2026-08-16 09:10 CEST

- Expanded the server-owned defense arc from three generic waves / 37 slots to
  five named watches / 83 slots: Petal Breach, Ripple Rush, Bruiser Bloom,
  Lantern Siege, and Crown of Ink. Each profile owns its count, cadence, cue,
  accent, and enemy mix.
- Added the Heartlight-focused Siphon and one forced final Ink Crown. Siphons
  demonstrably ignore a nearby Scout to continue toward the beacon; the Crown
  has 560 health and can only occupy the final authored spawn.
- Every cleared watch seals one bounded run receipt with id, title, score,
  cumulative kills, Heartlight health, and elapsed authority time. Victory
  returns a detached five-receipt chronicle; no profile persistence is claimed.
- Added a local low-resolution WebGL presentation with depth testing,
  16-step-per-channel fragment quantization, raised district geometry, gates,
  roads, Heartlight forms, defenders, all enemy families, projectiles, pickups,
  NPCs, wisps, and range targets. Canvas remains authoritative for gameplay
  presentation, input, collision, aim, and effects.
- The first live polish frame exposed a doubled translucent island because the
  new dynamic WebGL geometry composited above the Canvas ink. The final layer
  order places WebGL beneath the translucent Canvas terrain wash, retaining 3D
  depth without obscuring combat silhouettes.
- Focused verification passes: 43/43 core/client/package checks, 30/30 dedicated
  3D-polish checks, server HTTP, partner-choice HTTP, and JavaScript syntax.
- A fresh semantic controller completed all 83 slots in 71.418 seconds: victory,
  five receipts, 83 result kills = Pippa 65 + Moxie 18, 276 human shots, 67%
  accuracy, score 25,800, and Heartlight 360.
- Live browser evidence covers current-source exploration and combat at
  1280×720 and 390×844 with exact viewport fit, dynamic 3D actor/enemy/
  projectile/pickup diagnostics, 4,350 exploration vertices, reduced-motion
  locked camera, reload recovery, and the 5/5 victory surface. Repeated frames
  do not prove between-frame cadence because no rolling buffer was available.
- All ten AGENTS.md root checks pass. `node verify.js` reports 0 failures and 41
  repository warnings; the warnings are retained as shared backlog, including a
  stale tools index. Passing checks do not canonize or release the game.
- The isolated verifier was stopped and port 19813 was confirmed closed after
  `/api/reset` restored story step zero, wave zero, and score zero.
- Steam packaging, store integration, achievements, physical-controller
  certification, broad hardware performance, and final human balance remain
  unbuilt or unverified.

## Delivered

- One human Scout Pippa plus one visible selectable Human, Connected AI, or built-in Moxie partner on a shared camera; no split screen.
- Three illustrated story scenes, an explicit briefing, five explorable districts, five player-triggered named watches, exploration returns between watches, defeat, victory, and restart.
- Five named neighbors, ten collectible color wisps, six range blooms, four optional activities, and six run-local unlocks with material gameplay effects.
- A live directional wayfinder points to the next useful route, while the field map highlights one route target and shows exact progress toward every upgrade.
- The top live objective now mirrors that route with an action, destination, and distance; the wayfinder exposes its cardinal direction to assistive technology.
- Responsive play-first HUD rules keep the live objective on small laptops, move 768–820 px devices onto the compact rail, and remove nonessential progress chrome before it can cover Pippa.
- A camera-derived threat compass groups enemies hidden beyond the viewport or beneath protected HUD/footer space into counted edge cues and exposes the same directions through a polite live status.
- Every accepted defender hit now records the authoritative attacker coordinates, kind, and damage in a bounded effect. The client turns that truth into a target ring, a safe-edge bearing and amount, a rose health-card pulse, and exact `hit from <direction>` progressbar semantics without adding client-owned combat inference.
- Contact attacks now have server-owned windups: Nibs show a short bite cone for 360 ms, Sprinters a narrow lane for 250 ms, and Bruisers a broad stomp radius for 520 ms. Enemies lock their target and aim, stop advancing during the tell, and only deal damage if the target remains in range and vulnerable at the authoritative resolve time.
- Moving or dashing clear spends the enemy attack, emits a target-bound mint `DODGED` confirmation, and preserves health. Active player-targeting tells also publish a bounded `Dodge now` direction through the existing polite canvas status; HUD-obscured tells receive an amber `!` edge marker.
- A perfect dodge now awards 35 color and arms one 2.4-second Prism Counter. The single charge doubles the next player shot, renders a two-tone ×2 projectile and backed impact, survives offscreen and wave-clear transitions through the Scout Kit, exposes exact timing through observation, and clears on fire, expiry, or reboot.
- Pause freezes the complete authoritative clock rather than only movement; windups, cooldowns, effects, reboot timers, combo time, and the Prism Counter window resume with exactly their pre-pause remainder, while latent non-pause input is rejected.
- Lethal Heartburst damage now follows the shared award path so every cleared wave slot reconciles with player/ally kills, score, combo, effects, and the final result.
- Heartlight damage now persists beyond its hit toast: the active objective names danger/critical state and exact health, the HUD meter and arena vignette shift from stable to amber or rose, and an accessible progressbar plus polite threshold announcement carries the same urgency without color alone.
- Downed defenders now take over their team card with an exact reboot countdown and filling recovery rail; the active objective prioritizes the outage, screen-reader progress changes from health to reboot semantics, and down/return events are announced once.
- Authoritative return events now hold a short `ONLINE` world ring and `BACK ONLINE` team-card state while the health meter explicitly reports `back online`; reduced-motion retains the information while collapsing decorative animation.
- Downed fire, Dash, and Heartburst input is rejected at authority intake and scrubbed again during simulation, so no stale edge can move, heal, shoot, or consume cooldowns on reboot; the Scout Kit visibly reports both abilities offline and the observation contract exposes only wait-for-reboot and pause.
- WASD movement, mouse aim/click fire, Space fire, Shift dash, E Heartburst, F interact/start wave, M field map, H field manual, Escape pause, muted-by-default local Web Audio, reduced-motion control, and edge-latched gamepad mappings.
- Hybrid low-poly WebGL plus authoritative Canvas storybook color world beneath a full-bleed modern interface: luminous glass HUD, compact team/ability clusters, clean system typography, cinematic story/briefing/pause/result overlays, health/cooldown feedback, enemies, projectiles, pickups, effects, score, combo, and result statistics.
- Labeled modal dialogs, deterministic entry/return focus, progressbar semantics, forced-colors fallbacks, and automatic system reduced-motion initialization.
- Keyboard Tab and Shift+Tab stay contained inside whichever story, briefing, pause, map, manual, or result dialog is active.
- Active dialogs also make every background stage layer and the footer inert, preventing pointer or programmatic focus from leaking into canvas and settings controls behind the modal.
- Reload/reconnect input-sequence alignment, historical-event suppression, and queued fire/dash/Heartburst edges that survive an in-flight request until server acceptance.
- Authoritative input counters reject non-finite, fractional, out-of-range, and implausibly distant sequence values without mutating accepted state; clocks remain monotonic under backward or non-finite time proposals, and the client realigns after a rejected or restarted session.
- Connection loss now switches the live chip to a warning state, raises one bounded reconnect notice, and confirms authoritative resynchronization once the local server returns.
- Normalized health feedback remains within its rail when Heart Pocket raises Pippa's maximum health to 125.
- Bounded player-following camera traverses the expanded 2400 × 1350 world on desktop and compact screens without letterboxing.
- Managed local server authority for world, AI, combat, waves, exploration, meetings, collectibles, activities, unlocks, health, score, and result; clients send semantic input intentions only.
- The local transport byte-bounds JSON requests, returns stable `400 invalid-json` and `413 request-body-too-large` envelopes while preserving the session, rejects cross-origin preflight, and marks JSON/static resources `Cross-Origin-Resource-Policy: same-origin`.
- Observation, launcher-state, health, bounded telemetry, reset, CSP-protected static delivery, and reload recovery routes.

## Verification results

| Check | Result |
|---|---|
| JavaScript syntax, runtime and test files | PASS |
| `tests/toonfall-selftest.js` | PASS — 43 checks, including five-watch receipts, Siphon/Crown behavior, hybrid WebGL contract, progression, multi-seed stress, sequence/time hardening, mastery, pause, reconnect, modal focus, responsive HUD, accessibility, gamepad, and package contracts |
| `tests/toonfall-3d-polish-selftest.js` | PASS — 30 checks covering local WebGL, transparent composition, geometry primitives, dynamic actors/enemies/projectiles/pickups/exploration, live diagnostics, quantized palette, and no remote dependencies |
| `tests/server-http.test.js` | PASS — 15 route/authority checks, including transported windup target/resolve timing, pause-frozen windups/mastery windows/latent input, raw exponent-form sequence rejection, structured malformed/oversized request recovery, and same-origin browser enforcement |
| `tests/live-semantic-driver.js` against isolated port 19813 | PASS — current `0.5.0` core, five receipts, 83 reconciled kills, Pippa 65 / Moxie 18, 276 human shots, 71.418 s, 67% accuracy, score 25,800, Heartlight 360 |
| Shared game-package verifier | PASS — slot 013 has 0 errors and 0 warnings |
| Required AGENTS.md root checks | PASS — 10/10 |
| Game experience recovery self-test | PASS |
| Game Night discovery seam review | PASS — 22 seams, 0 open |
| Asset handoff self-test | PASS — 24 assertions |
| Hub self-test | PASS — 0 failures |
| Tool-index generation and parallel verification | PASS — 187 tools, 1,363 capabilities, 86 promotion self-tests |
| Public discovery generation/self-test | PASS — 187 modules, 1,363 declared capabilities |
| `node verify.js` | PASS — 0 failures; 41 retained repository warnings |

The broad verifier is green. Its 41 warnings remain cross-repository package,
manifest-kind, and generated-index backlog. Slot 013 has zero package errors;
passing tests do not make this build CANON or Steam-ready.

## Continued stewardship - 2026-07-28 16:00 CEST

- A direct pre-change replay proved the new dodge loop stopped at avoidance: Pippa stayed 100/100 and an `enemy-miss` existed, but there was no mastery stat, no charged window in observation, and the next player shot remained an ordinary 24-damage projectile.
- A player-targeted miss now awards 35 color, increments `perfectDodges`, and arms one authoritative 2.4-second Prism Counter. The charge exposes ready time, remaining milliseconds, and ×2 multiplier through observation; the next shot consumes it for 48 base damage, while exact expiry or defender-down clears it without a latent shot.
- The client carries that truth through a two-tone Pippa orbit, timed Scout Kit label and depletion strip, `PERFECT DODGE` / `PRISM COUNTER ARMED` world feedback, a cyan-lime ×2 projectile, and a backed impact badge. The first impact was too faint and its toast could lose to `enemy-popped`; `counter-hit` is now the final authoritative beat, remains available for 1.8 seconds, and mirrors `COUNTER HIT · 48` plus exact semantics when compact framing hides the target or the wave clears.
- The timed reward exposed a deeper pause contradiction: movement froze but authority time continued, consuming windups, cooldowns, effects, reboot timers, and rewards behind a card that promised nothing advances. External time is now offset around the pause interval, `state.now` remains fixed, non-pause input is rejected, and every timer resumes with only the first real post-resume tick deducted.
- Browser-primary proof covered armed, projectile, and impact states at 1280 × 720 and 390 × 844. Both documents exactly matched their viewports with no overflow; the compact offscreen impact retained its world badge and `COUNTER HIT · 48` Scout Kit state. No rolling-frame capability was available, so exact orbit/rotation/fade cadence remains unclaimed.
- The focused suite passes 39 checks and the HTTP suite passes 15. The first updated full victory exposed a lethal-Heartburst accounting seam—37 wave slots cleared but only 36 kills were credited. Heartburst now uses the shared award path; the rerun reconciled 37 result kills = Pippa 33 + Moxie 4, 114 human shots, 48% accuracy, score 7390, 29.992 seconds, and Heartlight 360.
- The exact prior 8803 process and isolated 8804 verifier were stopped after command-line verification. The current authority/client started hidden on 8803 as PID 25256, serves the Prism Counter, pause-clock, Heartburst, and compact impact contracts, while ports 8804/8805 are closed; `/api/reset` restored story step zero with zero score, zero perfect dodges, and no armed counter.
- The finalized handoff tab is connected to 8803 at 1280 × 720 with story one visible, `CONTINUE STORY` focused, an exact-size document, no overflow, and zero handoff-scoped browser warnings or errors.

## Continued stewardship - 2026-07-28 15:24 CEST

- A one-millisecond authority probe proved contact damage had no anticipatory state: at t=999 ms Pippa was 100/100 and the touching Nib exposed only ordinary movement fields; the next authority step at t=1000 ms immediately reduced her to 92/100. The matching browser frame showed the overlapping enemy with no world, HUD, or semantic warning.
- Every enemy now owns an explicit windup start, resolve time, locked target, and aim. Nib, Sprinter, and Bruiser tells are mechanically distinct and remain visible under reduced motion; the observation contract transports target, resolve time, and remaining milliseconds without granting control authority.
- Damage resolves only after the tell and only if the locked target is still alive, in range, and vulnerable. A tested Dash moved Pippa from contact to x=920.5, consumed the Nib attack at t=1360, kept health at 100, and emitted a server-owned miss with defender coordinates. The final compact frame held a mint `DODGED` ring on Pippa, `Dodge confirmed` semantics, and the expected 1.5-second Dash cooldown.
- Browser-primary proof covered the original no-tell frame, a frozen 180 ms midpoint at 1280 × 720 and 390 × 844, motion full/low, a HUD-obscured north-boundary attack with amber safe-edge `!`, a screen-safe dodge confirmation, and a three-family gallery. All sampled documents remained exact-size with zero overflow; the first dodge label followed the enemy offscreen and was corrected to bind to the defender before sealing.
- The focused suite now passes 37 checks, the HTTP suite passes 14 checks including transported windup timing, the slot package gate remains clean, and an updated isolated authority won all three waves in 32.621 seconds with 37 kills, Pippa 33 / Moxie 4, 125 human shots, and Heartlight 360. Repeated controlled screenshots were used because no rolling visual buffer is available, so exact between-frame animation cadence is not claimed.
- The previously verified 8803 Bloomvale process was stopped exactly, and the current authority/client source was started hidden as PID 19840. Live static inspection found the windup timing, target-lock, authority helper, and telegraph renderer; ports 8804 and 8805 are closed, and `/api/reset` restored story one at step zero.

## Continued stewardship - 2026-07-28 15:02 CEST

- A deterministic wave-one authority froze a real nonlethal contact hit: Pippa was 92/100 at the north camera boundary, but the baseline world and HUD looked calm and exposed neither the impact source nor a control-recovery state.
- Accepted defender damage now emits a bounded server-owned `defender-hit` effect with target, attacker coordinates, enemy kind, amount, and authoritative time. A focused core regression proves the nib hit, 8-point loss, finite southeast source, and transported effect.
- The client derives one consistent signal from that authority: a world target ring when Pippa is visible, a clamped screen-edge chevron plus damage amount when camera/HUD chrome hides her, a rose card pulse, a mild vignette, and health semantics reading `92 of 100, hit from southeast`. The first proof frame caught and closed a center cue that overlapped the Heartlight and a world damage label that clipped beneath the north HUD.
- A controlled authoritative reboot return now shows `ONLINE` around Pippa, `BACK ONLINE` in the footer, and `70 of 100, back online` semantics. Proof passed at 1280 × 720 and 390 × 844; the portrait hit state also passed with motion full and motion low, exact-size documents, and zero overflow.
- The focused suite now passes 35 checks, all 13 HTTP checks remain clean, and the updated isolated authority completed a fresh victory with 37 kills in 31.054 seconds, Pippa 35 / Moxie 2, 120 human shots, and Heartlight 360. Repeated screenshots were used because no rolling visual buffer is available, so exact between-frame cadence is not claimed.
- Ports 8804 and 8805 were closed. The verified Bloomvale listener on 8803 received a bounded managed restart as PID 6748, serves the new `defender-hit` authority fields, and is reset to story one with the 1280 × 720 handoff tab connected and overflow-free.

## Continued stewardship - 2026-07-28 14:39 CEST

- The defender-reboot proof frame exposed a second contradiction: while Pippa was down, the Scout Kit still advertised `DASH READY` and `BURST READY`. A direct core probe also proved that ability edges submitted during the outage survived until reboot, then moved Pippa 148 units, healed her from 70 to 86, and consumed both cooldowns without a fresh post-return input.
- Authority intake now accepts the sequence number but gates firing, Dash, and Heartburst on live player control; the downed simulation path independently scrubs any legacy or in-flight edge, including on the exact return tick. Movement, health, effects, and cooldowns remain unchanged until a new post-return packet arrives.
- The observation route now reports downed abilities as unavailable, replaces the combat action set with `wait-for-reboot` and `pause`, and names the reboot objective instead of claiming active combat control.
- The Scout Kit card now shifts to a rose `SCOUT KIT · REBOOTING` state with explicit `DASH OFFLINE` and `BURST OFFLINE` labels, then restores live cooldown/readiness truth on return. Desktop, 768 × 720, and 390 × 844 browser proof closed two compact label-clipping seams while preserving exact-size documents and unobstructed play.
- Fresh HTTP proof on the isolated authority accepted sequence 1 while storing all three downed action flags as false; observation returned both readiness flags false and only the two recovery actions. Reboot returned at x=1080, health 70, zero cooldowns, and no latent input.
- The focused suite now passes 33 checks, the 13-check HTTP suite and package gate remain clean, and a fresh isolated victory cleared 37 threats in 31.648 seconds with Heartlight 360. Ports 8804 and 8805 were closed; live 8803 received a bounded managed restart as PID 13776, is reset to story one, and serves both the corrected authority and client.

## Continued stewardship - 2026-07-28 14:25 CEST

- A frozen real wave-three state reproduced a defender-comprehension seam: Pippa was authoritatively down for 4.2 seconds with 12 threats, but the footer exposed only `0`; the only visible recovery clue was `REBOOT 5` floating beneath the enemy crowd, and the semantic tree still described a zero-health progressbar.
- Downed Pippa or Moxie now receives a persistent rose team-card state, exact whole-second countdown, and a rail that fills from zero to the authoritative 4.2-second return. The progressbar temporarily becomes named reboot progress with exact remaining-time text, then restores health semantics on return.
- The live objective prioritizes single- or dual-defender outages while retaining exact Heartlight health. New down/return announcements are one-shot events rather than countdown chatter, and all new pulsing treatment collapses under the existing reduced-motion rules.
- Browser-primary proof covered the same downed state at 1280 × 720, 768 × 720, and 390 × 844. A controlled midpoint showed 52.381% reboot progress and two seconds remaining; the return restored Pippa to 70/100, removed the downed state, and announced `Scout Pippa is back in color.` The portrait pass caught and closed a truncated name before sealing the final layout.
- The focused suite now passes 32 checks, the 13-check HTTP suite and package gate remain clean, and a fresh isolated victory cleared 37 threats in 32.553 seconds with Heartlight 360. Ports 8804 and 8805 were closed; live 8803 was reset to story one and serves the updated client.

## Continued stewardship - 2026-07-28 14:09 CEST

- A frozen real wave-three state reproduced a damage-comprehension seam: Heartlight had fallen to 142/360 (39%) with seven threats and Pippa down, yet the lasting objective and meter remained neutral after the brief hit toast and camera shake ended.
- Added stable, amber danger, and rose critical Heartlight bands. During combat the objective now names the band, exact percentage, and remaining threat count; the meter, card, and arena vignette retain matching urgency until the authoritative state improves.
- Exposed Heartlight as an exact progressbar with non-color `STABLE`, `UNDER ATTACK`, or `CRITICAL` text and a polite announcement only when the band changes. A bounded 520 ms impact flash remains reduced-motion safe.
- Browser-primary screenshots and semantic snapshots verified the same authoritative 39% state at 1280 × 720 and 768 × 720 with no overflow. The transient flash is source/regression verified; rolling capture was unavailable, so live between-frame cadence is not claimed.
- The focused suite now passes 31 checks, the 13-check HTTP suite and package gate remain clean, and a fresh isolated victory cleared 37 threats in 32.231 seconds with Heartlight 360. Ports 8804 and 8805 were closed; live 8803 was reset to story one and serves the updated client.

## Continued stewardship - 2026-07-28 13:54 CEST

- A frozen real wave-one state reproduced a combat-readability seam: desktop hid one enemy beneath the footer, while 768 × 720 showed only three of four threats and gave no direction toward the off-right or footer-obscured danger.
- Added rose edge arrows and count badges for up to four nearest off-screen direction groups. The cue is computed from authoritative enemy positions plus the current camera, stays outside protected HUD/footer space, and does not alter combat or simulation state.
- Added an atomic polite status that reports the same groups in cardinal language. At 768 × 720 it announced `1 southwest, 1 southeast`; at 390 × 844 it grouped the frozen state as `3 southwest, 1 southeast`.
- Removed generated `PIPPA` content after the portrait semantic tree exposed the duplicate label `Scout PippaPIPPA`; the real name now fits and is announced once.
- Browser-primary screenshots verified default desktop, 768 × 720, and 390 × 844 combat with zero console errors or warnings. Rolling capture was unavailable, so between-frame cadence remains unclaimed.
- The focused suite now passes 30 checks, the 13-check HTTP suite and package gate remain clean, and a fresh isolated victory cleared 37 threats in 30.382 seconds with Heartlight 354. Ports 8804 and 8805 were closed; live 8803 was reset to story one.

## Continued stewardship - 2026-07-28 13:38 CEST

- Live browser inspection reproduced a tablet seam at 768 × 720: the objective disappeared, the expedition panel covered Pippa, and footer labels wrapped into a dense control block.
- Extended the compact play-first rail through 820 px. Between 821 and 1040 px, the live objective remains visible while the expedition panel contracts to its actionable prompt and wayfinder and the footer keeps single-line controls.
- Re-observed the same authoritative exploration state at 768 × 720 and 900 × 600. Both documents and stages exactly matched their viewports with no overflow; the tablet panel ended at y=257, the short-laptop panel measured 320 × 145, compact pause/resume remained unclipped, and the browser console reported zero errors or warnings.
- The focused suite now passes 29 checks, the 13-check HTTP suite remains clean, and the package gate remains at 0 errors / 0 warnings.
- A fresh isolated semantic run completed all three waves: 37 kills, Pippa 31 / Moxie 6, 129 human shots, 33.371 seconds, Heartlight 360; port 8804 closed afterward.

## Continued stewardship - 2026-07-28 11:36 CEST

- Reproduced two transport failures on an isolated runtime: malformed JSON returned an internal 500, while a 25 KB request destroyed the socket and surfaced only as `fetch failed`.
- Request parsing now counts bytes, drains over-limit bodies, and returns typed `400 invalid-json`, `400 request-stream-error`, or `413 request-body-too-large` envelopes without damaging authoritative state.
- Removed wildcard CORS from the local-only runtime, reject browser preflight with `405 cross-origin-disabled`, and mark JSON/static responses same-origin with no-referrer policy.
- The HTTP suite now contains 13 checks; the 28-check focused suite and package gate remain clean.
- Verified a bounded updated-runtime victory: 37 kills, Pippa 28 / Moxie 9, 112 human shots, 29.084 seconds, Heartlight 360; port 8804 closed afterward.
- After the preserved process exited, port 8803 was restored from the current hardened source with a fresh story run. Live checks confirmed `0.3.1-bloomvale-steward`, no wildcard CORS, `Cross-Origin-Resource-Policy: same-origin`, `Referrer-Policy: no-referrer`, and `405 cross-origin-disabled` for browser preflight.

## Continued stewardship - 2026-07-28 10:46 CEST

- Reproduced an authority poison path: exponent-form JSON can parse to `Infinity`; the old core accepted it as `lastInputSeq`, serialized it as `null`, rejected every later packet as stale, and still passed validation.
- Input sequences must now be safe positive integers within the declared protocol ceiling and bounded jump window; every rejected value leaves the accepted counter unchanged.
- Authoritative time no longer rewinds or becomes non-finite when a clock proposal moves backward or is invalid, and validation now rejects poisoned time/counter state.
- The client detects a restarted server session and realigns after stale, invalid, or excessive-gap sequence responses instead of continuing from a bad local counter.
- Added a durable 12-seed, 31,200-tick action/time stress regression. The focused suite now contains 28 checks; the HTTP suite contains 11.
- Verified a bounded updated-core victory: 37 kills, Pippa 30 / Moxie 7, 121 human shots, 31.248 seconds, Heartlight 360; port 8804 closed afterward.
- The existing process on port 8803 serves the updated client immediately but retains its previously loaded core module until the next managed restart; no false live-server hardening claim is made.

## Continued stewardship - 2026-07-28 10:36 CEST

- Closed a modal interaction seam: the story overlay sits below the footer action layer, while the manual is a side panel, so pointer clicks could still reach background controls or the canvas.
- The active dialog now keeps itself interactive while every other stage child and the footer become inert; closing or switching panels restores only the appropriate surface.
- Added focused regression coverage; the suite now contains 26 checks.
- Verified live 8803 client delivery and a bounded isolated victory: 37 kills, Pippa 31 / Moxie 6, 125 human shots, 31.237 seconds, Heartlight 360; port 8804 closed afterward.
- Fresh rendered pointer verification remains `UNKNOWN` under the documented localhost browser restriction; source, live-static delivery, package behavior, and semantic authority are verified independently.

## Continued stewardship - 2026-07-28 10:28 CEST

- Fixed a state-color contradiction where the chip said `RECONNECTING` while retaining its green connected indicator.
- Replaced a hidden action-error text write with a visible, transition-bounded `LINK PAUSED` notice and a one-shot `LINK RESTORED` confirmation.
- Exposed the connection chip as a polite atomic status region, with explicit connected and reconnecting labels.
- Added a dedicated regression check; the focused suite now covers 25 checks.
- Verified the live 8803 static client contract and a bounded isolated victory: 37 kills, Pippa 28 / Moxie 9, 117 human shots, 30.812 seconds, Heartlight 360; port 8804 closed afterward.
- Fresh rendered reconnect observation remains `UNKNOWN` under the current localhost browser restriction; live static delivery and semantic server recovery are verified separately.

## Continued stewardship - 2026-07-28 10:22 CEST

- Replaced the generic exploration objective with the same route-aware action, destination, and distance already used by the wayfinder.
- Added cardinal direction to the wayfinder's accessible name without changing the painted world or its visual layout.
- Added Tab and Shift+Tab containment for all six modal dialogs while preserving their existing entry and return-focus behavior.
- Re-ran JavaScript syntax checks, all 24 focused checks, all 10 HTTP checks, the slot 013 package gate, and a final full isolated semantic victory: 37 kills, Pippa 30 / Moxie 7, 127 human shots, 31.192 seconds, Heartlight 360.
- The main server remains the existing process on port 8803 and serves the updated client files on refresh. The bounded 8804 verifier left no listener behind.
- Fresh browser visual verification is `UNKNOWN`: the current in-app browser URL policy rejected the local route. The prior visual report below remains historical evidence for the unchanged layout, not proof of the new dynamic objective or Tab loop.

## Live observed journey

The in-app browser was used for entry focus, story progression, briefing focus, guided exploration, Maribel meeting, map unlock, exact upgrade progress, map route marker, M/M and Escape map lifecycle, H/H and H/Escape manual lifecycle, ready-state reload, immediate accepted click, all five neighbor meetings, Heart Pocket 125/125 health, compact wayfinder/map checks, and final victory. A full semantic controller also crossed both explore breaks and defeated all 37 threats on the freshly restarted current server. The browser console reported 0 errors and 0 warnings.

- Desktop: 1280 × 720 CSS viewport; document and full-bleed world 1280 × 720; no overflow; wayfinder, focused dialogs, route marker, and six progress cards visible.
- Compact: 390 × 844 CSS viewport; document 390 × 844; no page overflow; wayfinder fits and the six-card field map uses bounded vertical scroll without horizontal overflow.
- Bounded 20 Hz server sample: 240 ticks, average 0.0083 ms, p95 0 ms against a 50 ms tick budget. This is not a long-session or other-device performance claim.

The stewardship pass additionally found and closed reload input-sequence lag, stale event replay, resume-behind-overlay behavior, 125% health fill, in-flight quick-tap loss, held-controller repetition, missing modal focus semantics, missing system-motion initialization, expanded-world navigation ambiguity, and a terminal-frame verifier race. Details live in `evidence/visual-verification.json`.

## Honest boundary

This is a native Canvas 2D Game Night beta with run-local exploration progression, not a persistent open-world profile or 3D skeletal-animation production build. NPC dialogue is authored and activities are one-time per run. All ten required capability routes are satisfied. Physical gamepad, phone/LAN play, long soak, continuous rolling capture, other machines, final balance, taste, and release approval remain unverified or deliberately out of scope. All visual/audio content is local and first-party to this package.
