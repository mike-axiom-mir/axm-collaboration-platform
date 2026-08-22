# AXM Game Night feedback and gradual migration queue

Status: **TEST WORKING NOTES**. This is an append-only playtest aid, not canon.
Mike remains the play-feel and merge gate.

## What to capture after each game

- Could both players join without explanation?
- Did keyboard, QR phone, and gamepad controls match what the screen promised?
- What felt fun, confusing, too slow, too hard, or unfinished?
- Was there a clear next thing to do after the first round or objective?
- What is the smallest change that would make us want one more round?

## Party co-op controller queue

| Order | Game | Players | Universal control status at queue start | Keyboard | Playability follow-up after controls |
|---:|---|---:|---|---|---|
| 002 | AXM Pong: Duet | 1–2 | Migration in progress | Yes | Judge its three arenas, specials, story co-op and 1v1 before adding another activity. |
| 003 | AXM Pong: Cross | 3–4 | Mapping needed | Yes | Two-player night needs explicit AI-fill or should wait for 3–4 humans. |
| 004 | Relaybound | 2 | Integrated | Yes | After control feedback, consider one additional encounter/objective only if the current relay loop is clear. |
| 006 | Lumenwake | 1–4 | Integrated | Yes | Test carry/cover/revive, the two optional Aurora Duets, and three-minute aurora pacing. |
| 008 | AXM District Party | 1–8 | Mapping needed | Yes | Inventory existing missions/vehicles first; add activities only where the city has an empty loop. |
| 011 | AXM BuddyFarm | 1–3 | Adapter migration needed | Yes | Prioritize a repeatable shared farm goal in the large world after controls. |
| 012 | Pulse Choir | 1–4 | Adapter migration needed | Yes | Test triads, bank multiplier, surge and shields before adding another song/rule. |
| 013 | Bloomvale: Gatewatch | 1–2 | Integrated | Yes | Test human/Connected-AI/in-game-AI partner choice and existing districts/activities. |
| 014 | Bonk & Bolt: The 24th Hour | 1–2 | Adapter migration needed | Yes | Verify the existing adventure loop and robot finale progression before adding scope. |
| 019 | Brace Room | 1–4 | Mapping needed | Yes | Test station readability and emergency variety; fix its manifest seam before promotion. |

## Session log

### 2026-08-08 · 002 AXM Pong: Duet · baseline play

- Setup: two Human seats, shared laptop/TV screen, two QR phone controllers available.
- Existing fallback: P1 A/D + Space; P2 arrows + Enter; Escape pauses.
- Migration target: pad 1 → P1, pad 2 → P2; stick/D-pad moves; A/RT power; Menu pauses.
- Software verdict: **PASS** — mapping tests, authoritative game selftest, manifest policy, browser start and keyboard pause/resume passed with no console errors.
- Physical Xbox/gamepad verdict: **AWAITING MIKE PLAYTEST** — reload the shared screen after the current baseline round to load the new browser code.
- Current human verdict: **REWORK BEFORE RETEST** - technically improved, but the moment-to-moment play is not yet fun or readable enough.
- Feedback:
  - Chapter order: **FIX DEPLOYED FOR RETEST** - a fresh story session had opened on Chapter 2; the fallback now starts on Chapter 1.
  - Between matches: **FIX DEPLOYED FOR RETEST** - after a loss, both players had to walk back to the laptop. Either QR phone can now choose a chapter, start a rematch, advance after a win, and trigger the shared 3-2-1 countdown.
  - Performance: **SMOOTHING DEPLOYED FOR RETEST** - the shared-screen motion felt somewhat laggy during real phone play; the screen now projects the authoritative ball between server packets while keeping server outcomes unchanged.
  - Progress: reached Chapter 2 during the first two-player phone playtest; the first phase felt promising despite the loop and motion issues.
  - Join/QR: **BUG** — Errol scanned seat 2 but the controller displayed the stale saved name “Michaela”. The QR route was P2; the seat label was wrong.
  - Control feel: **FAIL FOR PHONE PLAY** - the QR phone controls are still too laggy for a reaction-heavy Pong game, even though the latest smoothing was an improvement.
  - Fun/readability: **MIXED** - the maps look cool, but the gameplay elements feel boring and repetitive. It does not yet capture the lively PS1-era Pong inspiration in AXM's own style.
  - Power-up readability: **FAIL** - it is difficult to see when a player has a power-up, when it activates, and what effect it has.
  - Bugs: **PHONE FIX READY FOR RETEST** — Errol’s phone controller appeared to flash controls on and off. A 390×844 browser reproduction stayed visible for 30/30 samples, but inspection found the phone was unnecessarily running the hidden canvas, lighting engine and gamepad animation loop. Those loops are now shared-screen-only.
  - Start flow: **FIX DEPLOYED FOR RETEST** — launching felt like it immediately began play. The shared screen now waits in setup for an explicit Start Match action, shows 3-2-1, then begins. Duplicate start requests cannot reset a running match.
  - “One more round” improvement: rebuild the core rally around clearer power-up possession/effects and more expressive gameplay choices so each map changes how the match is played, not only how it looks.
  - Keep/change/remove: keep the map art and overall visual direction; change the core mechanics, phone responsiveness and power-up communication before adding more chapters.
  - Network observation: **BETTER** - phone control lag was noticeably smoother in the Chapter 2 retest. Router signal may still be a major part of the remaining delay; evaluate a dedicated local LAN router for future game nights.
  - Session interruption: Casino Alpha was accidentally launched while Chapter 2 was active, so the Hub replaced Pong and showed the casino screen. This was not a Pong chapter failure. The Hub now asks for confirmation before replacing any running match.

### 2026-08-08 - 004 Relaybound - next-test preparation

- Players and seat types: seat 1 Human; seat 2 remains selectable as Human, Connected AI, or in-game AI.
- Input methods: QR phone, Xbox/Brawl gamepad profile, and PC keyboard fallback are integrated.
- Start flow: **PASS** - the arena waits at Ready to Bind; either human phone or the shared screen can start the shared 3-2-1 countdown.
- More to do: two optional Bond Beacons now reward coordinated positioning with a team heal and a temporary attack/expose/shield boost. They do not block story progression.
- Replay loop: **PASS** - Bondfire reports beacon progress and Play Again resets the complete run to Ready to Bind.
- Software verification: **PASS** - focused server test, syntax check, manifest parse, live two-human start flow, live beacon completion, and live Bondfire replay passed.
- Physical phone/gamepad verdict: **AWAITING MIKE + ERROL PLAYTEST**.
- Next feedback: Are both beacons understandable and worth the danger? Does the role relay leave both players with enough to do?
- Verdict: **TEST READY**. Normal slot 004 stays unlaunched while the active Pong test continues.

### 2026-08-09 - 004 Relaybound - first physical playtest blocker and hotfix

- Human verdict before fix: **FAIL - MOVEMENT BLOCKER**. Mike and Errol could not complete a meaningful playtest because movement stalled while enemies continued attacking; aiming appeared to put the player into the map.
- Correction to the earlier claim: launch/start/replay and scripted objectives had been verified, but sustained two-phone movement under enemy pressure had not. The earlier **TEST READY** label was too strong.
- Reproduced causes:
  - Every phone loaded and ran the hidden Three.js scene and all character/world assets.
  - Pointer movement could create overlapping input requests over Wi-Fi.
  - The shared screen sent idle zero-movement keyboard packets to Player 1, competing with the Player 1 phone.
  - Shades could converge into one stack and synchronize their opening volley.
- Hotfix (`0.3.1-movement-hotfix`): phone-only compact state, zero phone 3D requests, one-in-flight/coalesced control transport, no idle shared-keyboard overwrite, smoothed shared-screen positions, enemy separation, staged opening shots, opening/reset grace, and reduced projectile burst damage.
- Software retest: **PASS**. Both humans sustained movement through enemy pressure; Mike moved from x=12 to x=33.03 and Errol to x=29.71 in the live browser check with full health, no script errors, no missing assets, and zero 3D requests from the phone route. Both focused HTTP tests pass.
- Physical verdict: **RETEST REQUIRED**. Mike + Errol still decide whether actual two-phone control now feels playable on the current router.
- Verdict: **RETEST READY - DO NOT CALL PHYSICALLY PASSED YET**.

### 2026-08-09 - 007 Casino Alpha - interrupted test

- Players and seat types: Mike + Errol, two Human seats.
- Human verdict: **FAIL - REWORK BEFORE RETEST**.
- Reliability: **FAIL** - the two-player co-op session crashed about halfway through.
- Slot animation: **FAIL** - the co-op slot play does not present a convincing reel/machine animation, so spins lack anticipation and payoff.
- Special moments: **FAIL** - free spins and other bonuses are not visibly celebrated or explained; only the overall jackpot is clearly presented.
- Jackpot pacing: **TOO FAST** - the jackpot is won before it has time to build tension or feel special.
- Machine access/navigation: **FAIL** - players cannot reliably try every slot because the interface pushes them back to the machine-choice start before they can click. It flashes between the choice screen and gameplay.
- Cabinet controls: **FAIL** - bet controls sit outside the slot machine instead of belonging to its cabinet, which is annoying and removes the physical slot-machine feeling.
- Rework order: stabilize the co-op session and machine focus first; then move bet/spin controls into each cabinet, add readable reel and bonus animations, and slow the jackpot economy enough to create anticipation.
- Verdict: **BLOCKED FOR PLAY - CORE CO-OP UX REWORK REQUIRED**.
- 2026-08-09 fix pass (`0.3.4-alpha`): **FIX READY FOR RETEST**.
  - Stability/navigation: background NPC, house, and jackpot polling now patches live numbers without rebuilding the phone controller. The selected cabinet and horizontal rail stay in place instead of flashing back to the first choice.
  - Slot feel: every spin now shows a minimum reel-rush phase before the settled board appears.
  - Cabinet controls: wager, risk, progressive heat, free-spin bank, Spin, and keyboard hints now live inside the robot cabinet.
  - Special moments: free-spin awards receive a prominent bonus theater, explicit award count, banked count, and free-spin button state.
  - Jackpot pacing: the immutable 1% human ticket frequency remains, but payout eligibility now builds visibly across 30 shared paid human spins and resets after a paid jackpot.
  - Co-op reliability: the deterministic two-player tour completed 80 alternating paid spins across all ten cabinets without ending or entering a quest/story state.
  - Verification: all 20 core contracts, standalone/managed server checks, staged Game Hub launch, package policy, integrated reel animation, stable cabinet selection, and a live `+4 FREE SPINS` moment passed.
  - Physical verdict: **AWAITING MIKE + ERROL RETEST** on the actual phones; the isolated QA server is not the normal Game Hub launch.

### 2026-08-09 - 006 Lumenwake - next-test preparation

- Players and seat types: one to four visible Human, Connected-AI, or in-game AI seats; smallest next test is Mike + Errol as two Human seats.
- Start/replay flow: **FIX READY FOR TEST** - the run now waits at Ready to Wake. The shared screen, either phone, keyboard Enter/Space, or a controller Menu button can start; phones also expose Play Again after an outcome.
- Universal controls: **INTEGRATED** - Xbox/Brawl default uses stick/D-pad movement, A/X/RB Pulse, B/RT Dash, and Menu for Start/Replay. P1 and P2 also have separate shared-keyboard mappings.
- New optional activity: two Aurora Duets ask distinct players to hold paired pads for 2.2 seconds. Completion heals the party, stuns current gloom, and returns eight light without blocking the main objective.
- New achievement: **Woven Together** for completing both optional duets and waking the aurora.
- Software verification: **PASS** - explicit start/idempotence, duet occupancy/reward, core syntax, phone-start transport, live start/countdown/arena rendering, manifest policy, and seeded balance runs passed.
- Balance sample: solo AI 18/20 wins, two-seat AI 13/20, four-seat AI 12/20; every completed run stayed within the three-minute contract.
- Physical verdict: **AWAITING MIKE + ERROL PLAYTEST** for actual portrait phones and Xbox pads.
- Next feedback: Are duet pads obvious enough? Is the 2.2-second hold satisfying? Does the heal/stun/light reward feel worth leaving the carrier route?
- Verdict: **TEST READY AFTER RELAYBOUND**. Normal slot 006 remains unlaunched so the active Relaybound run is not replaced.

### 2026-08-09 - 008 AXM District Party - first city-life pass

- Human baseline verdict: **GOOD MAP SHELL, EMPTY CITY**. The improved map was a good start, but the labeled shops/casinos could not be entered, parked/driving cars were not discoverable, and there was no clear progression into weapons, bodyguards, gang cars, road control, or optional street activity.
- Root cause: Map 1 shipped six technically drivable cars without an on-screen take/drive affordance, only eight civilians across the complete 12,288 x 8,192 city, and no gameplay-backed venue definitions. The existing venue documentation explicitly described empty future shells.
- City-life vertical slice: **FIX READY FOR PHYSICAL RETEST**.
  - Cars: six parked cars are explicitly stealable; four deterministic civilian traffic cars circulate and can be taken over as the driver. Phone prompts change to TAKE / HIJACK / EXIT, and the full map tracks public vehicles.
  - Population: twelve additional deterministic market/centre residents make the starting district visibly busier without adding network randomness.
  - Daily roles follow-up: all twenty civilians now have fixed names, distinct jobs, staggered day/night shifts, workplaces, task cycles, leisure stops and home destinations on a deterministic two-minute city day. Job badges and current tasks render above citizens; the City Pulse shows city time plus on-duty/commuting totals; ACTION asks a nearby citizen about their current shift. Vehicle and venue actions keep priority.
  - Venues: Iron Lantern Armory, Neon Crown Casino, and Party Crew Garage now have marked entrances and shared-screen venue interiors/menus. These are functional menu interiors, not yet walkable building-floor simulations.
  - Upgrades: personal funds can buy a stronger/faster sidearm, armored lining, up to two following armed bodyguards, two armored four-seat gang cars, casino VIP progression, and a 60-second street roadblock.
  - Optional play: the casino has a deterministic high-card table and free street intel; a rotating optional cache pays 40% to its collector and 60% to the shared party fund. No quest is forced.
  - Street control: the garage roadblock renders three barricades and blocks authoritative vehicle movement at the civic crossing until it expires.
  - Readability: the shared HUD exposes a deterministic City Pulse, nearby ACTION prompt, venue prices/results, optional-cache status, and full-map venue/cache/roadblock markers. Phone labels change while browsing a venue or driving.
- Live browser journey: **PASS**. The real phone controller entered the garage, hired Mike Guard 1, ordered an armored gang car, deployed the roadblock, left the venue, entered the delivered car, and drove it roughly 100 world units. The shared screen reflected the new NPC, vehicle, funds, prompts, menu, and driving state with no console warnings/errors.
- Automated verification: **PASS - 196/196** server/UI contracts, including deterministic citizen identities/schedules, geographically reachable jobs, work/leisure/home transitions, citizen conversation, deterministic traffic, car takeover, purchases, independent personal spending, roadblock collision, menu input latching, and shared-cache payout.
- Honest boundary: this is the first coherent alive-city loop, not a complete GTA-scale simulation. Next physical feedback should decide whether driving feel, traffic density, bodyguard usefulness, venue distance, and street-event variety are strong enough before adding larger interiors, car theft reactions, shops throughout every district, vehicle combat/customization, or persistent gang territory.
- Verdict: **RETEST READY - NEW CITY LOOP IMPLEMENTED; PHYSICAL FUN VERDICT STILL OPEN**.

### 2026-08-09 - 006 Lumenwake - first physical playtest and resonance-route fix

- Players and seat types: Mike + Errol, two Human seats using the shared screen and phone controllers.
- Human baseline verdict: **GOOD START, BUT TOO FAST/LAGGY AND TOO THIN**. The first run showed promise and the Pulse/combo skill was the standout, but movement felt too fast, phone response was very laggy, the second run ended about halfway through, and one arena plus end art/achievements did not provide enough to do.
- Crash evidence boundary: no preserved exception or formal crash result exists for the interrupted second run, so its exact failure cannot honestly be named. The observed code did contain several credible session-risk seams: unguarded SSE disconnect errors, every phone rendering the hidden arena, 20 Hz full-world phone state, overlapping input posts, and idle shared-screen input competing with the phones.
- Stability/transport fix (`0.3.0-resonance-routes`): phone routes no longer render the arena, receive a compact controller state, and coalesce input requests. The shared screen no longer sends constant idle input over an active phone. Quick Pulse/Dash taps are latched until a physics tick, stream disconnects are guarded, and a tick failure resets input instead of killing the runtime.
- Pace/readability fix: player movement, dash speed, enemy speed, enemy spawn pace, and active enemy cap were reduced; shared-screen motion is interpolated; the run ceiling is now 3:30.
- More to do: Aurora Basin and Prism Causeway are selectable between runs. Each has a distinct route layout, two cooperative duet pads, and three named partner Pulse shrines. One player arms a shrine with Pulse and the other completes the chord for light, healing, and a temporary enemy stun. Completing all three adds the **Full Chord** achievement.
- Keep/change/remove: **KEEP** the Pulse/combo idea and visual foundation; build replayability around readable cooperative timing choices rather than adding decorative end rewards alone.
- Automated verification: **PASS** - core/client/server syntax, package selftest, two-map contracts, Pulse-combo rewards, compact phone-state contract, and balance simulations passed (solo 19/20, pair 18/20, four-seat 19/20; bounded 3.5-minute runs).
- Isolated live verification: **PASS** - a real fast phone Pulse registered once after the latch fix; 60 abrupt compact-stream disconnects plus 180 input posts left the runtime healthy; live compact controller state was 24% of the full running-world payload; shared screen and phone logs were empty.
- Physical verdict: **RETEST REQUIRED**. The software repair is ready, but Mike + Errol still decide whether two real phones now feel smooth, whether the slower pace is right, and whether the second map and six optional co-op activities create enough variety.
- Verdict: **RETEST READY - DO NOT CALL PHYSICALLY PASSED YET**.

### 2026-08-09 - 013 Bloomvale: Gatewatch - partner authority closure

- Requested choice: the second seat can now be selected as **Human**, **Connected AI**, or **in-game AI**. The default remains the in-game Moxie AI instead of silently claiming that a connected agent exists.
- Authority boundary: Connected AI receives the same visible seat observation and semantic action gate as a human seat; it does not receive hidden world state or bypass the game rules.
- Software verification: **PASS** - 40 package assertions, the focused HTTP lifecycle, and the three-way partner-choice HTTP test all pass.
- Physical verdict: **RETEST REQUIRED** for actual gamepad feel and the chosen Connected-AI provider/session.
- Verdict: **CHOICE FIXED AND SOFTWARE-VERIFIED; EXTERNAL AI CONNECTION REMAINS SESSION-DEPENDENT**.

### 2026-08-09 - 012 Pulse Choir - phone and universal-control repair

- Original blocker: the next playtest could not begin because no usable phone controls appeared.
- Phone repair: the dedicated QR controller exposes an explicit Start Round button in the lobby, then a visible movement pad and Pulse action during play. A live isolated browser run reached the playing state without console errors.
- Universal controller migration: standard Xbox/Brawl defaults are now stick or D-pad to move, A/X/RB to Pulse, and Menu to start or replay. The mapping is visible on the shared screen and declared in the manifest; unused buttons remain intentionally available for later game-specific actions.
- Software verification: **PASS** - 23 package assertions plus HTTP lifecycle, process-recovery, and Game Hub handback tests all pass.
- Physical verdict: **RETEST REQUIRED** on two real portrait phones and real gamepads. A desktop browser can prove controls render and send input, but not Wi-Fi latency, touchscreen ergonomics, or controller hardware feel.
- Verdict: **RETEST READY**.

### 2026-08-09 - Workshop, Game Hub, and growth-panel stability closure

- Port/path correction: the normal D: Workshop is standardized on `8790`; Game Hub authority stays on `8789`. Start scripts now health-check and reuse those exact services instead of opening a duplicate server on an accidental port. Game launches receive `AXM_WORKSHOP_PORT=8790`.
- Server crash report: the observed `ERR_CONNECTION_REFUSED` was a stopped/mismatched local process, not enough evidence to name an application exception. The healthy D: Workshop and Game Hub were restarted/reused with explicit health probes; no ready players or live match were displaced.
- Workshop Growth/Mirror Growth: **VISIBLE AGAIN** in live browser verification. The populated panel reported current Workshop counts, deltas, constellation data, Mirror family data, and timeline history. A cold exact scan took about 11 seconds and a warm scan about 6 seconds, so the panel can look empty briefly while it measures a large Workshop.
- Automated verification: Hub selftest **0 failures**, identity router **PASS**, Game Night **PASS**, package-verifier selftest **PASS**, and launcher syntax/fixed-port preflight **PASS**.
- Remaining performance boundary: the full growth aggregate test exceeded its 64-second harness timeout while scanning the very large shared workspace, although the same live API completed and populated the UI. This is a performance warning, not a hidden pass.
- Verdict: **RUNNING AND RETEST READY; KEEP THE D: WORKSHOP WINDOW OPEN DURING GAME NIGHT**.

### 2026-08-09 - whole-night feedback closure audit

| Feedback area | Software state after closure pass | Human/physical gate still open |
|---|---|---|
| Universal party co-op default | Integrated in Pong, Relaybound, Lumenwake, Bloomvale, and now Pulse Choir; keyboard fallbacks remain. Migration is intentionally gradual and unused buttons are allowed. | District Party and other queued games still need their own safe multi-seat gamepad bridge; do not label the whole library migrated. |
| Pong / game 002 | Explicit ready/countdown, Chapter 1 default, phone chapter/rematch/start, authoritative seat names, lighter phone client, projected screen motion, and named active/recharging/ready power state are software-verified. | Mike + Errol decide phone latency, power readability, and whether the rebuilt rally is fun enough; router quality remains external. |
| Relaybound / game 004 | Movement-pressure, compact-phone, enemy-spacing, partner-choice, start/replay, and launcher contracts pass. | Two-phone movement and aim must be replayed on the actual router; the earlier first test was a real failure and is not overwritten. |
| Casino / game 007 | Separate personal wallets plus shared optional activity, stable cabinet focus, reel-rush animation, in-cabinet bet controls, visible free-spin theater, slower shared jackpot eligibility, and an 80-spin/twelve-cabinet co-op tour pass. | Mike + Errol still judge slot feel and confirm the prior halfway crash no longer repeats on the normal launch. |
| Lumenwake / game 006 | Compact/coalesced phone transport, guarded streams, slower pace, second map, six partner activities, and combo rewards pass focused recovery and balance checks. | Physical latency, pacing, second-session stability, and replay variety remain a two-phone verdict. |
| District Party / game 008 | The requested first alive-city slice exists: deterministic job/shift citizens, traffic and stealable cars, three venue menus, casino, armory, bodyguards, gang cars, roadblock, and optional cache; 196/196 focused contracts passed. | It is not a finished GTA-scale city. Driving feel, density, usefulness, variety, larger interiors, reactions, combat/customization, territory, and full shared-screen gamepad bridging remain future work. |
| Pulse Choir / game 012 | Phone controls render and start play; Xbox/Brawl mapping and keyboard help are present; all focused tests pass. | Real-phone portrait and real-gamepad playtest still required. |
| Bloomvale / game 013 | Human / Connected AI / in-game AI second-seat choice passes focused tests. | Connected-AI availability depends on the selected external/local agent session; physical gamepad test remains open. |
| Workshop/Game Hub | Fixed D: ports, health-aware launchers, growth UI live, package verification tolerant of visibly in-progress game folders. | Dedicated LAN router is hardware/substrate work, not a code fix. |

- Closure rule: **all reproducible software blockers reported tonight are fixed or have a tested repair ready**, but subjective fun, real-device latency, hardware controller feel, and previous crash non-recurrence require Mike + Errol to replay them. Those gates remain explicitly open rather than being converted into fake passes.

### 2026-08-09 - 008 AXM District Party - living-city contracts and controller closure

- Supersedes the earlier Game 8 row in the whole-night audit: the next deterministic city layer and the per-game universal controller bridge are now implemented in `0.5.0-living-city-contracts-public-test`.
- Cooperative work: Metro Dispatch offers three optional, repeatable party jobs without forcing a quest: a four-stop courier handoff route, a four-gate vehicle run, and a three-call rival patrol. Exactly one shared job runs per party; progress, target, timer, completion, and failure are visible on the HUD and city map.
- Separate/shared economy: the job's personal 40% is split only among the humans who contributed, while the party receives the shared 60%. This preserves separate bank accounts and makes the activity cooperative without inventing forced shared wallets.
- Vehicle consequences and progression: stealing parked or moving public cars now creates heat and nearby witness reactions. The Undercroft Chop Shop repairs cars, adds one permanent armor package, or changes plates/paint to legalize a stolen vehicle as a party-owned custom car while reducing heat.
- Living-city continuity: the twenty named citizens keep their deterministic work, leisure, commute, and home schedules; job encounters, traffic, witnesses, venue activity, caches, guards, gang cars, roadblocks, and justice all run on the same host-owned city clock.
- Universal controller: the shared screen now binds two standard Xbox/Brawl pads to the two visible Human seats. Left stick/D-pad moves, right stick aims, A acts, X/RT fires, RB sprints, B brakes/reverses, Y/View opens inventory, and Menu opens the map. Phone and gamepad inputs use independent sequence lanes so idle packets do not fight the active controller.
- Live managed journey: **PASS**. Game Hub launched Mike + Errol as two Human seats; the shared city screen rendered both wallets, justice, deterministic City Pulse, and gamepad help; Mike's real browser controller ACTION opened the mission board on the TV; the host-local binding route returned pad 1 -> Mike and pad 2 -> Errol. The session was restarted to a clean Party House state afterward.
- Automated verification: **PASS - 205/205** Game 8 contracts, standalone server lifecycle smoke, and complete game-library package verification with zero failures. The optional Playwright script remains unrun because that package is not installed, replaced for this pass by the live in-app browser journey and two observed frames.
- Honest boundary: physical pad feel, two-phone Wi-Fi latency, driving feel, and whether these jobs create the desired "one more round" pull still require Mike + Errol. The city is now a coherent deterministic public-test game loop, not a claim of GTA-scale content or simulation depth.
- Verdict: **GAME 8 v0.5 RETEST READY - SOFTWARE AND LIVE ROUTES PASS; PHYSICAL FUN VERDICT OPEN**.

### 2026-08-09 - 008 AXM District Party - Chop Shop tuning pass

- Version: `0.6.0-chop-shop-tuning-public-test` adds an exact per-car build rather than a decorative upgrade label.
- Service access: **TOW PARTY CAR** retrieves the nearest empty car already claimed by the player's party, so a player does not have to park perfectly beside the shop. It never selects another party's car.
- Performance upgrades: three engine stages change acceleration and top speed, three tire stages change steering, two brake stages strengthen stopping/reverse, and one armor package increases maximum health. The shop shows the current and next values before purchase and caps completed tiers.
- Handling: one paid ECU unlock opens Balanced, Grip, Drift, and Sprint presets; later preset changes are free. Drift uses a real lagging travel heading rather than being a cosmetic name.
- Styling: Street, Wide, and Rally body kits plus six deterministic paints/liveries are visible on the shared city screen. A tuned badge identifies engine/tire/brake tier and setup without covering the minimap.
- Ownership and persistence boundary: performance/cosmetic modifications require the exact target car to belong to the actor's party. Its owner and complete build survive destruction and host respawn during the session. Cross-session garage persistence is not claimed yet.
- Live managed journey: **PASS**. Mike claimed a parked car, reached the Chop Shop, towed that exact party car to the service pad, then installed engine stage 1, the Street kit, and Mint Circuit paint. The live HUD changed from top 190 / acceleration 210 to top 204 / acceleration 228, money was charged exactly, and the car visibly changed. Game 8 was then restarted through the normal Game Hub to a clean two-human Party House state.
- Automated verification: **PASS - 211/211** Game 8 contracts, CLI lifecycle smoke, and the complete 19-folder Game Hub package verification with zero failures. The running managed server reports `0.6.0-chop-shop-tuning` healthy on port `8798`.
- Physical verdict: **RETEST REQUIRED**. Mike + Errol still decide whether the upgrade prices, driving differences, visuals, and real controller/phone feel are fun enough.
- Verdict: **GAME 8 v0.6 RETEST READY - REAL MODDING/TUNING LOOP IMPLEMENTED; LONG-TERM GARAGE AND PHYSICAL FUN GATES OPEN**.

### 2026-08-09 - 008 AXM District Party - combat gear and enemy-role pass

- Version: `0.7.0-combat-loot-public-test` turns the Armory upgrade labels into host-owned inventory items with real combat effects.
- Weapons: Pulse Repeater MK II, Lantern Scatter Blaster, and Undercity Arc Carbine have distinct damage, cadence, projectile speed, finite matched ammunition, silhouettes, colors, trails, and firing effects. The scatter weapon fires three physical pellets; the arc carbine pierces one target. Matched ammunition can be refilled at the Armory.
- Armor and movement gear: Street Weave and Rivalbreaker Riot Plate increase maximum health and reduce authoritative incoming damage. Kinetic Street Boots increase movement speed and draw animated step trails. Equipped gear uses the existing six equipment slots and twelve-slot bag, is validated by the host, and survives the existing group-save round trip.
- Enemy identity: Chargers telegraph then dash, Strafers orbit and fire two-bolt bursts, Shields brace behind visible protection before a slam, and Sappers keep distance and fire slowing orbs. Distinct low-graphics marks, target lines, warning rings, labels, and colors make each role readable without new external art.
- Loot and optional play: defeated roles drop different timed pickups: healing Quick Charges, matched ammo caches, a recoverable Guard Vest, or Kinetic Boots/cash fallback. Iron Lantern also offers a free repeatable four-role combat drill with a clear reward; it is optional and does not force a quest.
- Live isolated journey: **PASS**. To avoid interrupting the different game already selected in the shared Game Hub, a separate loopback Game 8 runtime was used. Errol entered Iron Lantern through normal controller intentions, bought a Scatter Blaster, Riot Plate, and Kinetic Boots, reached 140 maximum HP with 22% reduction and 12% speed, spent finite scatter ammo, fought all four role types, killed a Charger, and collected its Quick Charge. Repeated live state showed charge/slam/burst/slow-orb telegraphs, and the browser console stayed empty.
- Automated verification: **PASS - 219/219** Game 8 contracts, including real inventory purchases, three weapon profiles, armor mitigation, deterministic loot, repeatable drills, four enemy behaviors, save persistence, and renderer declarations. The CLI lifecycle smoke shut down cleanly; changed browser modules parse; the complete 19-folder Game Hub package verifier reports zero failures.
- Honest boundary: code-drawn animation and browser state are verified, but Mike + Errol still decide whether the silhouettes, drop readability, prices, ammo economy, enemy timing, and real controller/phone feel are fun and clear on the TV.
- Verdict: **GAME 8 v0.7 RETEST READY - COMBAT LOADOUT/LOOT LOOP IMPLEMENTED; PHYSICAL FUN AND BALANCE VERDICT OPEN**.

### 2026-08-09 - 008 AXM District Party - visual adventure pass

- Version: `0.8.0-visual-adventure-public-test` improves the travel/readability layer without changing authoritative collision, missions, purchases or controller input.
- Building quality: source-aligned blocks now have roof extrusion, parapets, rooftop equipment, solar panels, facade depth, lit windows and service entrances. Curated building overlays gain stronger foundations and visible approach thresholds.
- Adventure landmarks: station, harbour, arena, market and central-plaza motifs receive bounded animated details; morning/evening/night colour follows the host city clock.
- Destinations: the Armory, Casino, Crew Garage, Metro Dispatch and Chop Shop now appear as distinct illuminated storefronts with venue-specific symbols and readable ACTION entrances instead of generic map circles.
- Navigation: each player gets an animated shared-world breadcrumb toward the current voluntary contract or optional cache, while the expanded city map shows a matching curved route. This is a visual bearing, not authoritative street pathfinding.
- Renderer evidence: the actual local Canvas renderer produced `docs/previews/city-visual-adventure-v0.8.0.png` cleanly after a cross-renderer font-weight compatibility fix; the 10-frame frozen-clock preview suite is deterministic.
- Software verification: **PASS** - focused art/adventure contracts pass 8/8, the complete Game 8 suite passes 222/222, the 10-frame actual-renderer preview pass and standalone lifecycle pass, and the 19-folder Game Hub package verifier reports zero failures.
- Isolated live verification: **PASS** - a clean `v0.8.0-visual-adventure` runtime started two Human seats; the persistent shared screen showed Mike, Errol, City Pulse and Xbox/Brawl help; authoritative state exposed the morning/evening/night clock, all five venue storefront types and an optional cache; browser logs were empty. The exact verifier process was then stopped and its port confirmed down.
- Honest boundary: TV-distance sign scale, evening contrast, motion comfort and whether travel now feels like a visual adventure still require Mike + Errol's physical playtest.
- Verdict: **GAME 8 v0.8 RETEST READY - VISUAL ADVENTURE SOFTWARE/LIVE ROUTES PASS; HUMAN ART/FUN VERDICT OPEN**.

## Copy for the next entry

```text
### YYYY-MM-DD · game id/name · mode
- Players and seat types:
- Input methods:
- Join/QR:
- Control feel:
- Fun/readability:
- Bugs:
- “One more round” improvement:
- Keep/change/remove:
- Verdict: PASS / RETEST / BLOCKED
```
