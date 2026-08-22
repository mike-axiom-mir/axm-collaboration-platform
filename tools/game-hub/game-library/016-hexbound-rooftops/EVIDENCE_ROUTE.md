# Evidence route

## `package-exists`

- claim: the isolated game package and declared runtime assets exist.
- kind: existence / static structure; risk: low.
- pass condition: every `game.manifest.json` required path exists and parses where applicable.
- primary surface: package self-test.
- counterevidence: missing path, invalid JSON, or cross-lane dependency.
- observed evidence: package self-test passed 45/45 assertions after the Rival Schemes pass; the work remained inside game 016.
- verdict: **PASS**.

## `macro-systems`

- claim: squad sizing, faction modifiers, casualty Essence, expansion income, cap growth, and fog-cell memory produce deterministic expected values.
- kind: deterministic behavior; risk: medium.
- pass condition: focused known-input assertions pass.
- primary surface: Node systems tests; secondary: live HUD changes.
- counterevidence: incorrect casualty count, unchanged faction cost, unchanged income or cap.
- observed evidence: 5/5 systems tests; the earlier live borough check changed cap 480 to 560, Glow +3.6 to +4.9/s, and Scrap +2.3 to +3.2/s.
- verdict: **PASS**.

## `player-journey`

- claim: a player can enter, configure, start, act, and reach a debrief.
- kind: interaction journey; risk: medium.
- pass condition: real browser inputs traverse title to setup to battle to outcome with no blocking error.
- primary surface: in-app browser at 1280x720; secondary: HTTP tests.
- counterevidence: blocked start, blank battlefield, inert command, missing outcome, or runtime error.
- observed evidence: the earlier pass reached co-op victory at 1:02 and skirmish defeat at 1:21; the current growth pass repeated title to strong-co-op battle; 4/4 HTTP tests passed.
- verdict: **PASS**.

## `macro-interactions`

- claim: fast recruitment, field summons, whole-army plans, and expansion visibly change state.
- kind: behavioral / visual; risk: medium.
- pass condition: each bounded input creates its advertised visible effect.
- primary surface: repeated in-app browser screenshots plus targeted semantic/HUD reads.
- counterevidence: cost not paid, population unchanged, prompt stuck, plan label unchanged, or building income unchanged.
- observed evidence: earlier passes proved Commander recruitment, summons, plans, expansion, a Quartermaster Broom order increasing population 24 to 30, and a Grand March plan change. The signature pass showed a Commander Overtime Witchpack order deduct its faction-aware cost and increase population 31 to 38 after 3.4 seconds.
- verdict: **PASS**.

## `visual-quality`

- claim: title, war room, battlefield, HUD, fog, formations, anchors, minimap, and Quartermaster deck are legible at the tested desktop viewport.
- kind: visual appearance / quality; risk: medium.
- pass condition: stable frames show the named layers without blank canvas, blocking overlap, or clipped core control.
- primary surface: in-app browser screenshots; secondary: semantic snapshots.
- counterevidence: black battlefield, hidden units, clipped commands, or unreadable resource state.
- observed evidence: Commander battlefield and full Quartermaster command deck rendered legibly in desktop tabs. The five-card Recruit rack stayed usable at 1280x720, the signature card and battlefield regiment marker were visually distinct, and the expanded field guide remained readable. The browser surface did not expose a compact viewport controller, so portrait usability remains unobserved.
- verdict: **PASS at the tested desktop viewport; UNKNOWN for portrait/physical phone**.

## `quartermaster-transport`

- claim: a second browser can send a semantic order that the Commander applies and acknowledges.
- kind: transport plus receiver behavior; risk: high.
- pass condition: sender queues an identified order, host applies the same sequence, visible game state changes, and sender receives an applied receipt.
- primary surface: two live browser clients plus server command/ack receipts.
- counterevidence: local-only button effect, unacknowledged queue, rejected valid order, or unchanged host state.
- secondary surface: `tests/coop-relay.test.js` authorization, queue, state, and acknowledgement assertions.
- observed evidence: live command #1 `train:brooms` returned `APPLIED - Broom Patrol assembling`, while Commander population changed 24 to 30 and the event feed named the Quartermaster order. Live command #2 `macro:march` returned `APPLIED - Plan changed to GRAND MARCH`, while Commander plan changed from PROBE to GRAND MARCH. Relay test passed 1/1.
- verdict: **PASS**.

## `quartermaster-reconnect`

- claim: the same Quartermaster seat and receipts recover after a controller refresh.
- kind: persistence/recovery; risk: medium.
- pass condition: refresh rejoins using the issued token, restores live host state and prior receipts, and does not create a second seat.
- primary surface: live second-tab reload; secondary: fresh-process relay test with simulated timeout and token rejoin.
- counterevidence: occupied-seat response, lost receipts, new token, or disconnected host state.
- observed evidence: controller reload restored `LIVE WITH COMMANDER`, GRAND MARCH, 30/480 fighters, and both applied receipts; relay timeout/rejoin assertions passed.
- verdict: **PASS in one browser profile**.

## `full-shared-world-coop`

- claim: both humans own synchronized world-rendering clients under shared authority.
- kind: transport / shared state; risk: high.
- pass condition: two independent world clients send divergent commands and converge on matching authoritative state across reconnect.
- primary surface: world snapshot/frame digests from two physical clients plus server authority logs.
- counterevidence: a single browser-local simulation authority or command-deck-only second seat.
- observed evidence: the Commander browser remains the declared simulation authority; the Quartermaster is an acknowledged semantic-command seat.
- verdict: **DEGRADED / MISSING HAND** (`game.rts.coop.shared-world-authority`).

## `living-map-mechanics`

- claim: each selectable battlefield changes the macro rules rather than only changing its name and tint.
- kind: deterministic behavior plus live visual appearance; risk: medium.
- pass condition: six unique mechanic contracts produce deterministic phases/effects, every selected map launches with the correct anomaly panel, and representative active events visibly change their advertised surface.
- primary surface: `tests/map-mechanics.test.js`; secondary: six-map live launch smoke plus repeated desktop screenshots/semantic snapshots.
- counterevidence: duplicate mechanic identifiers, nondeterministic phase timing, wrong map panel, unchanged advertised income/resources/vision/speed, or invisible state.
- observed evidence: 4/4 focused tests cover uniqueness, phase/pulse direction, income/speed modifiers, and bridge proximity. All six maps launched with their own objective and anomaly panel. Cloud Nine paid +18 Glow/+12 Scrap for its one finished district; Royal Table changed income from +3.6/+2.7 to +5.9/+4.5; Witch Mall showed a synchronized EASTBOUND phase and restricted neon arrows to eligible lanes.
- verdict: **PASS for six mechanical rules**. Separate topology evidence is routed through `living-map-topologies`.

## `quartermaster-map-sync`

- claim: the human Quartermaster sees the Commander map's current mechanic, phase, direction, and countdown.
- kind: transport plus visual state; risk: medium.
- pass condition: the relay sanitizes bounded mechanic fields and two live tabs display the same named phase/countdown.
- primary surface: relay test; secondary: live Commander/Quartermaster semantic snapshots and screenshots.
- counterevidence: missing mechanic object, unbounded color/text input, mismatched phase, or stale countdown.
- observed evidence: relay test preserved title/phase/color through publication; live Witch Mall tabs simultaneously displayed `EASTBOUND · 2s` and the same effect copy.
- verdict: **PASS**.

## `faction-signature-regiments`

- claim: every playable faction has exactly one recruitable signature regiment with a distinct automatic macro passive.
- kind: static structure plus deterministic behavior; risk: medium.
- pass condition: eight unique faction-to-unit and unit-to-passive mappings exist; each faction's recruit list contains the four core squads plus only its own signature; deterministic passive helpers return bounded advertised modifiers.
- primary surface: `tests/faction-signatures.test.js`; secondary: package inspection and live Commander browser.
- counterevidence: duplicate ownership/passive identifiers, a foreign signature in a recruit list, passive helpers outside advertised bounds, or a fifth card that does not match the selected faction.
- observed evidence: focused faction suite passed 3/3. Live Clockwork and Graveyard battles exposed exactly five Recruit cards with Overtime Witchpack and Coffin Union Local 13 respectively; the Clockwork signature completed recruitment and increased population 31 to 38.
- verdict: **PASS**.

## `quartermaster-signature-routing`

- claim: the human Quartermaster can recruit the Commander's current faction signature through a stable semantic order and receive an accurate historical receipt.
- kind: transport plus receiver behavior; risk: high.
- pass condition: the controller displays the host-published regiment name/passive/cost, sends `train:signature`, the Commander resolves it to the current faction, applies the cost and queue, population changes, and the acknowledged receipt keeps the actual regiment name after a later faction switch.
- primary surface: two live browser clients; secondary: relay and package tests.
- counterevidence: internal unit IDs leaking into the controller contract, a foreign regiment spawning, no host state change, or old receipts relabeling to the new faction.
- observed evidence: Graveyard co-op published Coffin Union Local 13 at 105 Glow / 96 Scrap; receipt #1 was applied; both seats changed from 44 to 58 fighters. Switching the Commander to Temporal updated the live order to Deadline Dragoons at 100 / 82 while the old receipt remained Coffin Union Local 13 after the discovered relabeling seam was fixed.
- verdict: **PASS**.

## `district-charter-strategy`

- claim: future roofs can inherit one of four low-chore macro charters, while nearby different charters create a bounded diversity bonus and Volunteer Seances can muster free squads.
- kind: deterministic behavior plus live interaction and appearance; risk: medium.
- pass condition: four unique charter contracts affect only their advertised surfaces; network bonus is 15% per distinct nearby charter and capped at 45%; a live mixed district changes HUD state and a live Seance produces a squad without recruitment input.
- primary surface: `tests/district-charters.test.js`; secondary: repeated desktop screenshots and semantic snapshots.
- counterevidence: duplicate effects, same-charter stacking, a bonus over 45%, unchanged cap/income, a paid or missing free squad, or invisible district identity.
- observed evidence: focused tests passed 3/3. Live Impossible Housing completed at wonderweb x1.15, changed cap 480 to 612, and rendered its charter identity and network link. In a bounded skirmish observation, Volunteer Seance reported one free squad and fighters changed 31 to 41 without a recruit action.
- verdict: **PASS**.

## `quartermaster-charter-routing`

- claim: the second human can choose the global charter for future Commander roofs and receive an applied receipt.
- kind: transport plus receiver behavior; risk: high.
- pass condition: sender queues a whitelisted charter identifier, the host applies the same sequence, both seats display the new plan, and the sender receives an applied receipt.
- primary surface: two live browser clients with sender and receiver receipts; secondary: relay authorization/queue/ack test.
- counterevidence: unacknowledged order, unknown charter accepted, host plan unchanged, or disagreement between seats.
- observed evidence: live Quartermaster command #1 selected Impossible Housing, returned `APPLIED`, highlighted the plan on the controller, and produced the Commander event `Quartermaster filed Impossible Housing`. The next claimed roof inherited it. Relay test passed 1/1 with a Volunteer Seance charter command.
- verdict: **PASS**.

## `quartermaster-tactical-atlas`

- claim: the second human receives a readable strategic map without bypassing the Commander's fog of war.
- kind: transport, visual appearance, and authorization boundary; risk: high.
- pass condition: the relay publishes a bounded 19-roof graph; unexplored roofs expose no ownership; invisible rival formations are absent; the live controller distinguishes player, ally, visible rival, neutral, and fog states.
- primary surface: `tests/tactical-atlas.test.js` plus relay sanitization assertions; secondary: two-browser semantic snapshots and screenshots at 1280x720.
- counterevidence: hidden rival pips, an owner label on an unexplored roof, unbounded arrays or coordinates, a missing roof graph, or unreadable overlap.
- observed evidence: deterministic tactical coverage passed 3/3. A fresh live atlas showed Roof 08 as the player Borough, four mapped roofs, disabled fog roofs, seven friendly/ally formations, and zero rival formations before vision. Later state grew to 12 mapped roofs and showed only then-visible rival pips. The full graph remained legible with fog-muted branches.
- verdict: **PASS at the tested desktop viewport**.

## `quartermaster-roof-targeting`

- claim: the Quartermaster can apply acknowledged macro actions to a specific explored roof and the Commander receives the intended battlefield effect.
- kind: transport plus receiver behavior and live visual interaction; risk: high.
- pass condition: the sender queues a whitelisted order with a valid roof identifier, the host applies the same sequence, game state changes at that roof, a named battlefield marker appears, and the sender receives an applied receipt.
- primary surface: two live browser clients with sender and receiver receipts; secondary: relay target-validation test.
- counterevidence: an invalid roof accepted, an unexplored roof enabled, a generic frontline effect instead of the chosen roof, missing state change, or an unacknowledged command.
- observed evidence: live Rally Beacon on Roof 09 changed both plan readouts to `RALLY @ ROOF 09`, moved the whole army, rendered the mint `QM RALLY` marker, and returned `#1 APPLIED`. Live Rooftop Pirates on Roof 09 changed Essence 60 to 0 and fighters 31 to 62, rendered three crews and a violet `QM PIRATE RIFT`, and returned `#1 APPLIED`.
- verdict: **PASS**.

## `match-scoped-command-lifecycle`

- claim: a queued Quartermaster order cannot leak from a finished match into the next battle.
- kind: transport lifecycle and recovery; risk: high.
- pass condition: every command carries the active match identifier; publishing an outcome rejects any still-queued command; new orders receive 409 while no battle accepts them; drains return only the active match.
- primary surface: deterministic relay test with a queued target followed by outcome publication; secondary: live discovery of the original queue/outcome race and normal v2 applied receipts after the fix.
- counterevidence: a queued command remains pending after outcome, drains into a different match, or the controller reports application after the battle ended.
- observed evidence: the live pirate probe first exposed a queue/outcome race. The v2 relay test now proves the same sequence becomes `rejected` with `Match ended before application`, refuses another order with 409, and allows only match-matching drains. Fresh live v2 matches returned normal applied rally and pirate receipts.
- verdict: **PASS**.

## `rival-strategic-planner`

- claim: the skirmish rival chooses a board-relevant macro objective, stages a bounded formation, telegraphs fair counterplay, and then commits without introducing routine siege.
- kind: deterministic planning plus live behavior and appearance; risk: high.
- pass condition: five distinct schemes exist; early expansion, late clock pressure, economy, wonderweb, and vision opportunities select deterministic plans; difficulty changes formation size and cadence; Commander and Quartermaster agree on phase and target; fog-hidden rival staging does not leak a roof identifier.
- primary surface: `tests/rival-strategy.test.js`; secondary: two live browser tabs, relay sanitization, and Commander canvas screenshots at 1280x720.
- counterevidence: fixed waves always attacking the Clock, an unavailable target, an untelegraphed mass spawn, a staging roof still named after launch, hidden atlas ownership, or any siege unit in a composition.
- observed evidence: focused strategy coverage passed 5/5. A Properly Serious opening chose Annex the Punchline, claimed a forward roof, staged four formations for 5.5 seconds, then committed against the player Crooked Borough. The first live pass exposed and fixed a staging-roof/attack-target label seam. The following cycle rotated to Very Final Tuesday and named the Grand Clock. Both seats showed matching plan, target, countdown, and counterplay; the explored target gained a red war-table marker while fog and invisible-force rules remained intact.
- verdict: **PASS**.

## `bridgefront-logistics`

- claim: macro movement uses the rooftop bridge graph as an authoritative formation route, adapts costs to live map rules, and remains low-micro and visibly legible.
- kind: deterministic behavior plus live interaction and appearance; risk: high.
- pass condition: connected distant orders return a stable shortest bridge sequence; Tuesday, Gargoyle, and Witch mechanics alter edge choice or cost; same-roof and disconnected orders fail safely to direct local movement; live squads consume waypoints; selecting the army does not overwrite the strategic plan.
- primary surface: `tests/bridge-routing.test.js`; secondary: Commander semantic snapshots and repeated 1280x720 still frames.
- counterevidence: formations crossing arbitrary roof gaps, unstable equal-cost paths, a hot Gargoyle roof preferred despite a cheaper safe route, a stuck disconnected order, route hops never decreasing, or `SELECT ARMY` replacing `GRAND MARCH`.
- observed evidence: deterministic bridge coverage passed 4/4. A live Tuesday order gave four squads / 31 fighters a six-hop mint route across actual links; later observation showed one remaining hop while formations had advanced and fought. The first pass exposed a selection/stance seam; after the fix, Commander selection remained active and both seats continued to report `GRAND MARCH`.
- verdict: **PASS** for route choice, progression, and desktop readability. Exact rolling animation cadence remains **UNKNOWN** because the verifier exposed repeated still frames rather than a rolling buffer.

## `quartermaster-route-boundary`

- claim: the second human can read friendly active bridge lanes without receiving hidden rival routes or invalid graph edges.
- kind: transport, authorization boundary, and visual appearance; risk: high.
- pass condition: the Commander publishes only friendly remaining route segments; the relay retains a segment only when both endpoints and their actual bridge link survive sanitization; the controller highlights retained links and reports their count; no rival route is serialized.
- primary surface: tactical and relay tests; secondary: fresh two-browser co-op atlas snapshot and screenshot.
- counterevidence: an arbitrary endpoint pair accepted, a route to a removed roof retained, a rival route serialized, a lane count without a highlighted edge, or a route highlight bypassing fog ownership rules.
- observed evidence: the focused bridge/tactical/relay suite passed 8/8. The fresh Quartermaster atlas first reported five active lanes; later it reported one active lane and contained exactly one `line.marching`, visibly drawn as a dashed mint bridge edge. Enemy formations remained governed by current vision and no rival route field exists in the published tactical snapshot.
- verdict: **PASS at the tested desktop viewport**.

## `grand-doctrine-branches`

- claim: every faction offers exactly two exclusive once-per-match Grand Doctrines that specialize a core formation and change at least one empire-level lever.
- kind: static authorship, deterministic behavior, and live interaction; risk: high.
- pass condition: sixteen unique branches map two-to-one across all eight factions; foreign doctrine choices are rejected; each pair has materially distinct formation and empire signatures; a live choice retrofits existing forces and future recruitment without adding siege.
- primary surface: `tests/faction-doctrines.test.js`; secondary: Commander setup, Council, Recruit, and Expand panels.
- counterevidence: duplicate or cross-faction options, a reversible second choice, unchanged formation/economy/building state, generic recruitment after ratification, or routine siege text.
- observed evidence: focused doctrine coverage passed 5/5. Live Clockwork setup previewed both branches. Midnight Union locked its alternate, changed starting population 31 to 34 and Scrap income 2.7 to 2.9, and produced Picket Familiar Union at 74/18. A fresh Borrowed Tomorrow branch produced Tomorrow Patrol at 54/44 and Watchmoon at 39/71.
- verdict: **PASS**.

## `quartermaster-doctrine-ratification`

- claim: either human seat can ratify the offered faction doctrine exactly once and receive matching state plus an acknowledged receipt.
- kind: authorization, transport, receiver behavior, and appearance; risk: high.
- pass condition: the relay accepts only a currently host-published option; Commander applies the same identifier; both seats lock the alternate; sender receives an applied receipt; a foreign or unavailable identifier is rejected.
- primary surface: two live browser clients plus `tests/coop-relay.test.js`; secondary: server sanitizer and controller DOM.
- counterevidence: arbitrary doctrine accepted, disagreement between seats, second choice succeeds, receipt missing, or host faction changes the historical receipt.
- observed evidence: in fresh Moonwake co-op, the Quartermaster ratified Black-Sail Logistics; the Commander feed named the Quartermaster action, both seats displayed the same active branch and disabled Letters of Marque, and receipt #1 returned `APPLIED`. The relay suite rejects non-offered doctrine identifiers and passes the offered option through the match-scoped queue.
- verdict: **PASS**.

## `specialized-roster-sync`

- claim: after doctrine ratification, the Quartermaster sees and pays the same specialized formation sizes, names, costs, and Essence power prices as the Commander.
- kind: synchronized bounded state and visual clarity; risk: high.
- pass condition: host publishes sanitized core-recruit and power contracts; controller replaces generic labels; the specialized fighter count appears exactly once; live values match the Commander.
- primary surface: two live browser clients; secondary: relay sanitization and package contracts.
- counterevidence: generic controller roster, stale price, duplicated size text, internal identifier leakage, or Commander/Quartermaster mismatch.
- observed evidence: the first pass exposed generic Quartermaster recruits; the second exposed a duplicated baked-in formation count. After both fixes, fresh Black-Sail Logistics co-op showed Crow's-Nest Cutters at 7 fighters and 54/38 on both seats, live 11/9/6 sizes for the remaining core formations, and Frontline Pirates at 44 Essence.
- verdict: **PASS**.

## `living-map-topologies`

- claim: all six selectable battlefields have separately authored, strategically legible rooftop networks rather than one renamed or jittered graph.
- kind: static authorship, deterministic graph behavior, and live visual appearance; risk: high.
- pass condition: six unique topology identifiers, coordinate/link signatures, and strategy descriptions exist; each has exactly 19 named in-bounds roofs and 30-38 valid unique links; every graph is connected and survives removal of any single bridge; setup and live battlefield frames visibly differ.
- primary surface: `tests/map-topologies.test.js`; secondary: all six setup SVGs and repeated Commander screenshots.
- counterevidence: duplicate geometry/link signature, isolated roof, invalid edge, one bridge disconnecting a map, incorrect home alignment, shared preview, or live battlefield still using another map's graph.
- observed evidence: focused topology coverage passed 4/4, including every single-edge removal across all six maps. The setup rendered Clockface Spiral (30), Six-Level Switchback (35), Banquet Spine (34), Sleeping Ribcage (34), Department Constellation (38), and Escalator Atrium (38), each with 19 nodes and distinct copy. Live Witch Mall showed three escalator levels and a four-hop formation route; Cloud Annex visibly changed to separated office clusters.
- verdict: **PASS**.

## `quartermaster-named-topology`

- claim: the second human receives the selected sanitized topology and public roof names without weakening ownership, force, route, or target fog boundaries.
- kind: transport, authorization boundary, interaction, and visual appearance; risk: high.
- pass condition: the host publishes a bounded topology label plus names for retained roof identifiers; the relay caps them; the controller renders the selected 19-node graph, uses names in accessible labels and receipts, and still withholds unexplored ownership and invisible rival formations/routes.
- primary surface: two fresh live browser clients plus tactical/relay tests; secondary: sanitizer source and semantic reads.
- counterevidence: generic or wrong topology label, hidden owner/force leak, unbounded text, anonymous receipt, graph mismatch, or named target applied to an unexplored roof.
- observed evidence: fresh Dragon Metro co-op reported `SLEEPING RIBCAGE`, 19 nodes, and 34 links. Tail Platform was the mapped player Borough while Snout Terminus remained unexplored fog. A Quartermaster rally returned `#1 APPLIED · Rally Beacon · Tail Platform`, produced the same named Commander feed event, and later highlighted three friendly active lanes. An initial generic-label observation came from the still-running pre-change relay and passed after the updated sanitizer restarted.
- verdict: **PASS**.

## `faction-ordinary-rooflines`

- claim: all eight factions own a visibly distinct ordinary-district architecture while preserving the shared Borough, Moot, Watch, and Bridgehead macro grammar.
- kind: static structure plus live visual appearance; risk: medium.
- pass condition: eight unique faction/motif contracts exist; all four ordinary role presentations resolve through the faction kit; matched live completed Boroughs remain role-readable and visually distinct at 1280x720.
- primary surface: `tests/faction-districts.test.js`; secondary: eight same-route live browser proof frames.
- counterevidence: a missing/duplicate kit, generic fallback for a roster faction, two materially identical completed rooflines, unreadable role loss, or a faction treatment leaking to another faction.
- observed evidence: the focused architecture contract passed for all eight factions. Matched Tuesday build journeys captured gear crowns, spectral paperwork dome, pirate rigging, briars, bone braces, lantern windows, patchwork flags, and temporal echo frames in `evidence/live-roofline-*-2026-07-28.jpg`.
- verdict: **PASS at 1280x720**.

## `thorn-briarway-conversion`

- claim: Thorn Court's ordinary Bridgehead becomes a low-chore repair-support Gatehouse without changing the ordinary expansion contract or widening into siege.
- kind: deterministic behavior plus live interaction/timing/appearance; risk: high.
- pass condition: only Thorn Bridgehead changes name/icon/detail; cost, time, durability, and role key remain ordinary; every eight seconds it repairs only damaged completed allied ordinary districts within 520; mixed charters scale but cap the amount; a live damaged district receives a visible pulse and receipt; rival Thorn uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: real-pressure live skirmish receipt and selected pulse frame.
- counterevidence: worker input, self/Clock/Wonderwork/enemy/unfinished repair, over-range healing, unbounded scaling, changed ordinary price, siege production, missing live state change, or rival skipping its Wonderwork allowance.
- observed evidence: four focused cases passed, including a max x1.45 pulse of 20.3 repair and all exclusion boundaries. The live card charged the ordinary Bridgehead price, completed under Junk Jamboree, and then reported `Briarway Gatehouse repaired 1 wonderweb district` while `BRIAR MEND x1` rendered in `evidence/live-briarway-repair-pulse-2026-07-28.jpg`.
- verdict: **PASS**. Exact sub-frame animation cadence remains **UNKNOWN** because the visual backend exposed repeated stills rather than a rolling buffer.

## `moonwake-black-sail-conversion`

- claim: Moonwake Corsairs convert the ordinary Moon Moot into automatic, spread-friendly route infrastructure without changing the ordinary expansion contract or adding a movement chore.
- kind: deterministic behavior plus live interaction and appearance; risk: high.
- pass condition: only Moonwake Moon Moot changes presentation; cost, time, durability, and role key remain ordinary; only completed living allied Anchorages support nearby formations that are already following a macro route; mixed charters scale the x1.16 bonus up to x1.232; multiple sources do not stack; rival Moonwake uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: live card/build/route semantic receipts and selected 1280x720 frames.
- counterevidence: worker input, idle/enemy/distant support, unfinished or destroyed source, stacking Anchorages, changed ordinary price, a new micro command, siege production, rival skipping its Wonderwork allowance, unreadable route signal, or repeated per-squad feed spam.
- observed evidence: six focused faction-district cases passed, including unchanged ordinary stats, route-only same-team boundaries, x1.45 wonderweb scaling to x1.232, non-stacking sources, and rival parity. Live Moonwake charged 95 Glow / 110 Scrap, completed under Pumpkin Night Market, then one shared army order produced one `Black-Sail Anchorage opened a wonderweb route lane` receipt, a two-hop route readout, purple formation arcs, and `SAIL LANE x1.16` in `evidence/live-black-sail-route-lane-2026-07-28.jpg`. The initial live pass exposed per-squad feed fanout; source-level gating fixed it before promotion.
- verdict: **PASS at 1280x720**. Exact continuous movement cadence remains **UNKNOWN** because the browser exposed repeated stills rather than a rolling buffer.

## `boo-spectral-census-conversion`

- claim: Boo Brigade's ordinary Watchmoon becomes slow, automatic, bridge-bounded strategic fog infrastructure without replacing mobile scouting or changing the ordinary expansion contract.
- kind: deterministic topology/knowledge behavior plus live interaction, timing, and appearance; risk: high.
- pass condition: only Boo Watch changes presentation; cost, time, durability, and role key remain ordinary; every eleven seconds a completed living Bureau chooses one stable still-unexplored roof within four bridge hops; mixed charters shorten but bound the interval; the active reveal ends while remembered fog remains; rival Boo receives the same conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: 1280x720 baseline-active-settled live frames and named semantic receipts.
- counterevidence: worker input, a new scan command, global reveal, disconnected or fifth-hop filing, unstable target choice, changed ordinary price, permanent current visibility, missing remembered claim access, Broom removal, siege, or rival conversion use before Wonderworks.
- observed evidence: focused district/strategy/route coverage passed 18/18 and the full deterministic/HTTP/relay suite passed 56/56. Live Boo charged 50 Glow / 90 Scrap, completed in 3.4 seconds under Pumpkin Night Market, then rendered `CENSUS FILED`, stamped forms along the connected path, `FILED CLOCKHEART`, and `Spectral Census Bureau filed Clockheart.`. The 4.8-second follow-up removed the active trail while the filed roof remained mapped and claimable in `evidence/live-v014-census-cadence-settled.png`.
- verdict: **PASS at 1280x720**. Exact sub-frame animation cadence remains **UNKNOWN** because the browser exposed repeated stills rather than a rolling buffer.

## `rival-own-fog-planning`

- claim: the rival's macro planner uses its own strategic knowledge instead of silently reading every player district and occupied roof through fog.
- kind: deterministic information boundary plus live semantic UI; risk: high.
- pass condition: rival squads/buildings populate separate explored and current-visible grids; own buildings and public Grand Clocks remain known; player ordinary districts and neutral-roof availability enter planning only after rival exploration; Boo Census writes to the rival map; hidden targets stay honestly unnamed to the Commander.
- primary surface: `tests/faction-districts.test.js` strategic-knowledge boundary; secondary: fresh opening rival-plan panel and runtime health contract.
- counterevidence: hidden ordinary district chosen by kind/charter, hidden occupied anchor excluded from a supposedly unknown roof shortlist, player visibility reused by the rival, enemy Census writing into player fog, or a named unseen target in the opening telegraph.
- observed evidence: deterministic coverage retained rival-owned buildings and both Grand Clocks, admitted an explored player market, excluded a hidden player Watchmoon and dead rival district, and proved four-hop Boo parity. A fresh mild live opening labeled the rival target `FOG-HIDDEN FORWARD ROOF`; fresh health and launcher reported `rivalStrategicFog: true`.
- verdict: **PASS**.

## `faction-core-formations`

- claim: all eight factions own a readable presentation language across the four shared core squad roles without changing their balance or creating individual-fighter control.
- kind: static structure, deterministic presentation, regression boundary, and live visual appearance; risk: medium.
- pass condition: eight unique kits cover all factions; four unique role contracts cover Mobs, Hexbows, Brooms, and Lanterns; all 32 combinations resolve uniquely; signature regiments remain excluded; presentation data contains no combat/economy keys; matched live armies remain role-readable and faction-distinct at 1280x720.
- primary surface: `tests/faction-formations.test.js`; secondary: `evidence/faction-formations-visual-receipt-2026-07-28.json` and eight selected Tuesday gameplay frames.
- counterevidence: missing or duplicate kit, generic faction fallback, role silhouettes collapsing together, signature identity overwritten, core stat drift, individual-fighter selection, unreadable standards, or two materially identical faction hosts.
- observed evidence: focused coverage passed 5/5 and the full suite passed 61/61. Eight Mild Tuesday runs disabled auto-scout, recruited the Lantern role, measured the resulting fighter increase, selected five squads, and captured matched frames. The live host languages were Clockwork `XII`, Boo `FILE`, Moonwake `MOON`, Thorn `CROWN`, Graveyard `III`, Lantern `WIN`, Mob `!`, and Temporal `T+1`; browser warning/error logs were empty.
- verdict: **PASS at 1280x720**. Exact continuous motion cadence remains **UNKNOWN** because no rolling buffer was exposed.

## `clockwork-thirteenth-hour-conversion`

- claim: Clockwork Coven's ordinary Borough becomes automatic local formation-tempo infrastructure without changing ordinary expansion economics or duplicating the Shift-Bell Wonderwork.
- kind: deterministic behavior, timing, rival parity, and live visual appearance; risk: high.
- pass condition: only Clockwork Borough changes presentation; `Z`, cost, time, durability, income, and cap remain ordinary; a completed living Hall rings every twelve seconds for exactly four seconds; only living allied formations within 520 receive movement and attack-recovery multipliers; mixed charters strengthen but cap both; overlapping Halls do not stack; rival Clockwork uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: 1280x720 baseline-active-settled live frames, semantic selection receipt, package/HTTP contracts, and empty browser log.
- counterevidence: worker input, manual ability button, enemy/dead/distant buff, unfinished or destroyed source, longer active window, multiplicative stacking, changed ordinary stats, queue advancement, siege production, rival skipping Wonderworks, or persistent shift markers after expiry.
- observed evidence: focused coverage passed 11/11 and the full deterministic/HTTP/relay suite passed 63/63. The live Expand rack showed both the ordinary `Z XIII` Union Hall and separate `B XII` Shift-Bell Foundry. During the pulse, four formations displayed orange rings, chevrons, `XIII x1.18`, a Hall `SHIFT CHANGE x1.18` label, `Thirteenth-Hour Union Hall rang shift change for 4 formations`, and selected-army `THIRTEENTH HOUR x1.18`; the confirmed settled frame removed those formation and selection markers.
- verdict: **PASS at 1280x720**. Repeated stills and semantic polling prove the baseline-active-settled sequence; exact sub-frame animation cadence remains **UNKNOWN** because no rolling buffer was exposed.

## `mob-foreground-spotlight-conversion`

- claim: Once-Upon-a-Mob's ordinary Watchmoon becomes automatic local target-coordination infrastructure without changing ordinary expansion economics, adding target-paint micro, or enabling routine siege.
- kind: deterministic behavior, timing, rival parity, and live visual appearance; risk: high.
- pass condition: only Mob Watch changes presentation; `C`, cost, time, durability, huge vision, and no-attack role remain ordinary; every thirteen seconds a completed living Spotlight casts the nearest currently visible enemy formation within 520 for exactly five seconds; only nearby player or AI-allied formations gain x1.18 damage to that one formation; mixed charters strengthen but cap the value at x1.261; buildings are never cast; overlapping sources do not stack; rival Mob uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: retained 1280x720 baseline-active-settled frames, package/HTTP contracts, and browser log.
- counterevidence: worker input, manual target button, enemy or distant attacker benefit, building target, invisible target, unfinished/destroyed/expired source, longer active window, multiplicative stacking, changed ordinary stats, free-unit production, siege damage amplification, rival skipping Wonderworks, or persistent beam/marker after expiry.
- observed evidence: focused district coverage passed 13/13 and the full deterministic/HTTP/relay suite passed 65/65 before promotion. The live Expand rack charged 50 Glow / 90 Scrap and identified the stage as the ordinary `C LEAD` conversion; the completed baseline showed the three-lamp `FOREGROUND` stage. The active frame showed `LEAD ROLE x1.18`, a gold beam and target oval, `CAST: LEAD`, and the feed receipt; the settled frame removed beam, oval, and cast label while the completed stage remained.
- verdict: **PASS at 1280x720**. Repeated stills prove the baseline-active-settled state transition; exact sub-frame animation cadence remains **UNKNOWN** because no rolling buffer was exposed.

## `tin-every-window-assembly-conversion`

- claim: Tin Lantern Republic's ordinary Borough becomes automatic, threat-gated local formation shelter without changing ordinary expansion economics, adding repair micro, or protecting buildings.
- kind: deterministic combat boundary, timing, rival parity, and live visual appearance; risk: high.
- pass condition: only Tin Borough changes presentation; `Z`, cost, time, durability, income, and cap remain ordinary; every thirteen seconds a completed living Assembly with a currently visible enemy formation within 520 raises exactly five seconds of Civic Cover; only living player or AI-allied formations within 520 receive 14% incoming formation-damage reduction; mixed charters strengthen but cap the reduction at 20.3%; buildings are never protected; moving out of range, source destruction, or expiry removes cover; overlapping sources do not stack; rival Tin uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: retained 1280x720 baseline-active-settled frames, package/HTTP contracts, and empty browser log.
- counterevidence: worker input, manual cover button, no visible threat, enemy/dead/distant target benefit, building protection, unfinished/destroyed/expired source, longer active window, stale protection after leaving range, multiplicative stacking, changed ordinary stats, repair or reinforcement, siege production, rival skipping Wonderworks, or persistent shield markers after expiry.
- observed evidence: focused district coverage passed 15/15 and the full Node suite passed 67/67. Pure behavior coverage proves exact 13/5/520 boundaries, a base 0.86 incoming multiplier, capped mixed-charter 0.797 multiplier, player/team-1 AI alliance behavior, rival parity, building/dead/far/invalid exclusions, dynamic range, expiry, destroyed-source shutoff, and strongest-only sources. Live Tuesday proof showed the completed `ASSEMBLY` baseline; a currently visible rival entry then produced four gold polygon shields, four `CIVIC COVER 14%` labels, an active source ring, and `Every-Window Assembly raised Civic Cover for 4 formations.`; six seconds later those temporary cues cleared while the Assembly remained complete.
- verdict: **PASS at 1280x720**. Repeated same-viewport frames prove the baseline-active-settled state transition; exact sub-frame animation cadence remains **UNKNOWN** because `visual.capture.ephemeral-rolling-buffer/v1` was unavailable.

## `graveyard-last-rites-exchange-conversion`

- claim: Graveyard Shift's ordinary Borough becomes automatic local casualty-Essence infrastructure without changing ordinary expansion economics, adding corpse-harvest micro, or paying for building destruction.
- kind: deterministic casualty/account boundary, rival parity, and live visual appearance; risk: high.
- pass condition: only Graveyard Borough changes presentation; `Z`, cost, time, durability, income, and cap remain ordinary; every positive formation casualty within 520 receives a 55% extra Essence dividend for its own side through the strongest eligible completed Exchange; mixed charters strengthen but cap the dividend at 79.75%; buildings and malformed or zero-death events are excluded; overlapping sources do not stack; combat and hazards use the same award path; rival Graveyard credits and spends its own dividends after Wonderwork-first conversion use.
- primary surface: `tests/faction-districts.test.js`; secondary: retained 1280x720 baseline-active-settled frames, package/HTTP contracts, and empty browser log.
- counterevidence: worker input, manual harvest button, enemy-side miscredit, building casualty payout, zero-death payout, unfinished/destroyed/distant source, multiplicative stacking, changed ordinary stats, rival account leakage, dividends the rival cannot spend, siege production, protocol change, or persistent receipt markers after the visual state settles.
- observed evidence: focused district coverage passed 18/18 and the full Node suite passed 70/70. Pure behavior coverage proves the 520 boundary, 55% local dividend, capped mixed-charter scaling to 79.75%, strongest-only non-stacking, formation/building and source exclusions, player/rival account routing, normal-combat and hazard integration, existing 60-Essence rival audit spending, and Wonderwork-first rival parity. Live Tuesday proof showed the completed `LAST RITES` baseline; a nearby formation casualty then produced `WAKE DIVIDEND +55%`, `LAST RITES +0.6 ESS`, a bone receipt ring, and floating slips; the settled frame cleared temporary cues while the Exchange remained complete.
- verdict: **PASS at 1280x720, with a named cleanup seam**. Repeated same-viewport frames prove the baseline-active-settled state transition; exact sub-frame animation cadence remains **UNKNOWN** because `visual.capture.ephemeral-rolling-buffer/v1` was unavailable. Three current-loop temporary directories remain after exact cleanup was policy-rejected twice; only the three selected proof frames are cited for promotion.

## `temporal-department-of-later-conversion`

- claim: Office of Temporal Mischief's ordinary Watchmoon becomes automatic local enemy-tempo control without changing ordinary expansion economics, overwriting macro orders, or duplicating its Wonderwork.
- kind: deterministic targeting/timing boundary, rival parity, and live visual behavior; risk: high.
- pass condition: only Temporal Watch changes presentation; `C`, cost, time, durability, huge vision, and no-attack role remain ordinary; every fourteen seconds a completed living Department selects the nearest currently visible enemy formation within 520 for a three-second movement and attack-recovery pause; routes, targets, and orders survive; mixed charters lengthen but cap the filing at 4.35 seconds; buildings, allies, dead/distant/invalid/already-filed formations are excluded; rival Temporal uses the conversion only after its Wonderworks.
- primary surface: `tests/faction-districts.test.js`; secondary: package/HTTP contracts, repeated 1280x720 live observations, and browser diagnostics.
- counterevidence: worker input, manual ability, invisible or friendly target, building target, changed ordinary stats, order loss, route loss, attack damage, permanent stun, multiplicative active filing, range leak, unfinished/destroyed source, duplicate queue/cooldown acceleration, rival skipping Wonderworks, or persistent cues after expiry. The first valid live run placed the source off the rival route and lost at 03:34 without a trigger; it proves source completion alone is insufficient evidence.
- observed evidence: focused coverage passed 20/20 and the full Node suite passed 72/72. Pure behavior proves deterministic distance/id ordering, exact 14/3/4.35/520 boundaries, capped charter scaling, active-target exclusion, building/alliance/source boundaries, preserved-order integration, and Wonderwork-first rival parity. The second Mild Tuesday run showed a completed `LATER` baseline; a real hostile formation then received the cyan `FILED: LATER` shield while the source displayed `DEFERRED 3.0s`; 4.5 seconds later both temporary cues cleared while source and target remained. Browser warning/error logs were empty.
- verdict: **PASS at 1280x720 for the recorded scope; release remains TEST and unsealed**. Repeated still observation proves baseline-active-settled behavior. No proof images were retained, and exact sub-frame animation cadence remains **UNKNOWN** because no rolling buffer was exposed.
