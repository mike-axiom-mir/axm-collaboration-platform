# Build receipt

Lane: `tools/game-hub/game-library/016-hexbound-rooftops/` only.

Outcome: original browser-playable macro RTS alpha with eight faction choices, six creative map choices, local skirmish AI, AI-ally co-op mode, formation units, fast recruitment, expansion economy, build anchors, fog, auto-scout, casualty Essence, field summons, high population cap, and no routine siege units.

## Quartermaster growth pass - 2026-07-28

- Added a genuine second-human asymmetric co-op seat at `runtime/controller.html`.
- Added versioned bounded relay `hexbound.coop-command/v1` with one tokened seat, whitelisted commands, host-state publication, sequence receipts, timeout, and reconnect.
- Added Quartermaster orders for four squad types, Guard/Raid/Grand March, auto-scout, Frontline Pirates, Second Wind, and Phantom Parade.
- Kept the authority boundary explicit: Commander browser owns simulation; local server owns command transport; Quartermaster owns high-level macro support.
- Updated the manifest to two visible human seats and added static, HTTP, and relay contracts.

Shared seams touched: none. Game Hub server, root server, registries, indexes, package files, and neighboring games were deliberately not edited while other builders were active.

Verification:

- `node --check runtime/server.js`, `runtime/controller.js`, and `runtime/app.js`: PASS.
- `node --test tests/systems.test.js`: PASS, 5/5.
- `node tests/package-selftest.js`: PASS, 20/20.
- `node --test tests/server-http.test.js`: PASS, 4/4.
- `node --test tests/coop-relay.test.js`: PASS, 1/1.
- In-app browser, two desktop tabs: PASS for Commander strong-co-op launch, Quartermaster join, shared resource/host-state view, command #1 recruit acknowledgement, six-fighter population change, command #2 Grand March acknowledgement, host plan change, and controller refresh/reconnect with receipts preserved.
- Visual pass: Commander battlefield and Quartermaster deck are readable in the tested desktop browser. Portrait/physical-phone QA remains unobserved because the active browser verifier did not expose a compact viewport control.

Earlier live coverage also passed fast local recruitment, Ghost Pirate placement, Select Army, expansion completion, victory, and defeat debrief. An initial camera edge-pan seam and stale placement-prompt seam were fixed in that pass.

See `KNOWN_LIMITS.md` for claims intentionally not made.

## Living maps growth pass - 2026-07-28

- Promoted all six map hazards from fiction into deterministic calm/warning/active macro systems.
- Added Chronogust bridge speed, Gargoyle contested-roof attrition, Royal Banquet economy surges, Dragon Breath fog reveals, Cloud Memo district windfalls, and alternating Witch Mall escalators.
- Added a persistent anomaly panel with countdown, effect/counterplay copy, map-colored activity state, and six different canvas treatments.
- Published bounded anomaly state through the co-op relay so Commander and Quartermaster can time plans together.
- Corrected the generic Tuesday objective copy and a live visual seam where vertical mall bridges were incorrectly painted eastbound.

Growth verification: `tests/map-mechanics.test.js` PASS 4/4; combined systems/map suite PASS 9/9; package PASS 24/24; HTTP PASS 4/4; relay PASS 1/1; JSON PASS 5/5. Live desktop pass covered all six launch panels, Cloud Memo payout, Royal income multiplier, Witch directional lanes, and synchronized Commander/Quartermaster anomaly timing.

## Signature regiments growth pass - 2026-07-28

- Added one unique starting and recruitable signature regiment for each of the eight factions.
- Added eight automatic macro passives: construction aura, Essence audit, forward muster, healing aura, one reassembly, march aura, last-act damage, and deadline dash.
- Added a fifth faction-colored Recruit card, `T` hotkey, signature battlefield marker, and passive copy in the selection panel and field guide.
- Added enemy signature waves and the Tin Lantern AI ally's Pocket Paladin signature support.
- Added a semantic Quartermaster `train:signature` command whose label, passive, faction-aware cost, and receipt follow the Commander faction without exposing internal regiment identifiers.
- Fixed a live two-seat history seam so an acknowledged old signature receipt does not adopt the name of a newly selected faction's regiment.
- Updated the local health/launcher contract to `0.4.0-signature-regiments` with eight signature regiments and eight automatic passives.

Verification: syntax PASS for five runtime JavaScript files; focused factions/systems/relay suite PASS; package PASS 31/31. Live desktop pass proved Clockwork's five-card rack and 31-to-38 signature recruitment, Graveyard's dynamic Quartermaster signature and acknowledged 44-to-58 recruitment, Temporal faction hot-swap to Deadline Dragoons, stable historical receipt naming, signature battlefield marker, and updated field guide. Repeated still frames were used; portrait/physical-phone and rolling-video cadence remain unobserved.

## District charters growth pass - 2026-07-28

- Added four global future-roof plans: Pumpkin Night Market for Glow, Junk Jamboree for Scrap, Impossible Housing for cap and vision, and Volunteer Séance for automatic free squads.
- Added a diversity-first wonderweb: nearby completed allied districts with different charters amplify effects by 15% per distinct charter, capped at +45%.
- Added colored district sigils, network rings, and mixed-charter links to make expansion strategy visible on the battlefield.
- Added `5-8` Commander controls plus a Quartermaster charter section with whitelisted relay orders, sanitized host state, and applied receipts.
- Made ordinary and free-mustered squads inherit the current Guard, Raid, or Grand March plan, reducing post-production micro.
- Cycled the rival AI through all four charters and allowed hostile Volunteer Séances to muster attacking squads.

Verification: charter/system/faction suites PASS; relay and package contracts PASS; live desktop proof showed the four-card Commander tab, four-button Quartermaster deck, applied Impossible Housing receipt on both seats, a mixed district completing at wonderweb x1.15, cap increasing 480 to 612, and a Volunteer Séance increasing the army 31 to 41 with an explicit free-squad receipt. Full release totals are recorded after the final manifest and HTTP pass below.

Final v0.5.0 release matrix: syntax PASS for five runtime JavaScript files; deterministic systems/maps/factions/charters PASS 15/15; package PASS 36/36; HTTP PASS 4/4; relay PASS 1/1; JSON PASS 5/5. Capability comparison remains honestly DEGRADED only because the second human is an asymmetric command seat rather than a synchronized shared-world client.

## Living War Table growth pass - 2026-07-28

- Promoted the Quartermaster from a command deck into a battlefield strategist with a styled 19-roof atlas, bridge graph, friendly/ally formations, and currently visible rival formations.
- Kept fog authoritative: unexplored roofs expose topology only, owner data is stripped, and enemy pips are withheld when not currently visible.
- Added two exact roof actions: Rally Beacon redirects the whole Commander army and becomes the plan inherited by new squads; Rooftop Pirates spends shared Essence at the selected explored roof.
- Added matching Commander markers: expanding mint `QM RALLY` rings and violet `QM PIRATE RIFT` rings plus named event-feed entries.
- Upgraded the relay to `hexbound.coop-command/v2` with bounded tactical sanitization, whitelisted roof identifiers, match identifiers, outcome rejection, and active-match-only drains.
- Fixed two live-discovered seams: a Boolean/object ternary that labeled the friendly Borough as enemy, and a queue/outcome race that could have carried a late order into the next match.

Verification: syntax PASS for five runtime JavaScript files; deterministic systems/maps/factions/charters/tactical coverage PASS 18/18; package PASS 40/40; HTTP PASS 4/4; relay PASS 1/1; JSON PASS 5/5. Live two-browser proof covered the fog-safe atlas, corrected player Borough label, exact Roof 09 rally with applied receipt and battlefield beacon, and exact Roof 09 pirate drop with Essence 60 to 0 and fighters 31 to 62. Capability comparison remains DEGRADED only for full synchronized shared-world authority; the new strategic-co-op atlas requirement is READY.

## Rival Schemes growth pass - 2026-07-28

- Replaced fixed Clock-bound enemy waves with five deterministic board-aware macro schemes: economy raid, wonderweb cut, vision blackout, Grand Clock assault, and forward expansion.
- Added difficulty-scaled formation composition, a real staging window, regroup cadence, forward-roof claiming, vulnerable-target scoring, and scheme rotation without adding siege units.
- Added a dedicated Commander plan panel, live canvas target brackets, readable staging/committed phases, target labels, countdowns, and explicit counterplay.
- Published bounded rival intent to the Quartermaster, added a matching plan panel, and marked only explored target roofs on the fog-safe living war table.
- Fixed a live-discovered clarity seam by separating the rival's temporary staging roof from its post-launch player attack target.
- Promoted the capability contract from wave/target AI to `game.rts.ai.strategic-planner` while retaining honest gaps for counter-pick memory, retreats, fog deception, and synchronized shared-world co-op.

Verification: syntax PASS for five runtime JavaScript files; deterministic systems/maps/factions/charters/tactical/rival coverage PASS 23/23; package PASS 45/45; HTTP PASS 4/4; relay PASS 1/1; JSON PASS 5/5. Live desktop proof covered opening forward expansion, 5.5-second staging, committed attack-target handoff, rotation into a Grand Clock assault, matching Commander/Quartermaster intelligence, and the fog-safe red tactical marker. Repeated still frames were used; portrait/physical-phone and rolling-video cadence remain unobserved. Capability comparison remains DEGRADED only for full synchronized shared-world authority.

## Bridgefront Logistics growth pass - 2026-07-28

- Promoted the 19-roof / 31-link bridge graph from a visual atlas into the authoritative macro movement network for player, ally, and rival formations.
- Added deterministic stable shortest-path planning, nearest-roof resolution, and safe same-roof/disconnected fallback behavior.
- Added map-aware route costs for Tuesday Chronogust links, Gargoyle hot contested roofs, and Witch Mall directional escalators.
- Added squad route state, consumed waypoints, bounded moving-target reroutes, reassembly cleanup, and local in-range engagement steering.
- Added Commander dotted mint route previews, waypoint diamonds, destination rings, hop copy, and selection-panel route detail.
- Published friendly route segments only; the relay now accepts a route only when both retained endpoints share a retained bridge link, clamps formation counts, and bounds the route list.
- Added Quartermaster dashed mint lane highlights, active-lane count, and legend without publishing rival routes or weakening fog.
- Fixed a live-discovered macro seam where **Select Army** overwrote `GRAND MARCH`, causing a selection action to change the strategic plan and new-squad inheritance.

Verification: syntax PASS for five runtime JavaScript files; deterministic systems/maps/factions/charters/tactical/rival/bridge coverage PASS 27/27; package PASS 50/50; HTTP PASS 4/4; relay PASS 1/1; total Node suite PASS 32/32; JSON PASS 5/5. Fresh v0.8 health and launcher probes reported bridge routing, authoritative graph, friendly route intel, and three map-aware cost families; the restarted relay reported no occupied Quartermaster, no host, and sequence 0. Live Commander proof showed a six-hop route decrease to one hop while formations advanced; live Quartermaster proof showed five active lanes decrease to one and one rendered `line.marching`. Repeated still frames were used, so exact rolling animation cadence remains UNKNOWN. Portrait/physical-phone, collision/congestion/navmesh, and synchronized shared-world authority remain unverified or intentionally absent.

## Grand Doctrines growth pass - 2026-07-28

- Added sixteen exclusive Grand Doctrines, exactly two per faction, as permanent one-choice macro constitutions rather than an age-up or worker-tech chore.
- Each branch specializes one existing core formation and changes at least one empire lever across recruitment, income, fighter cap, building durability, sight, or Essence power cadence/cost.
- Ratification retrofits existing faction squads and buildings while preserving health ratios, then applies to future recruitment, free musters, buildings, and powers.
- Added deterministic doctrine selection for rival and AI ally factions without adding siege compositions.
- Added the Commander Council tab, setup previews, `9` / `0` hotkeys, battlefield doctrine markers, specialized selection copy, and live recruit cards.
- Added bounded Quartermaster doctrine ratification, active/locked state, specialized recruit synchronization, dynamic formation counts/costs, and live Essence power prices.
- Fixed two live-discovered co-op seams: generic Quartermaster recruits after ratification and a duplicate baked-in formation-size label.

Live desktop proof covered both Clockwork branches and Moonwake two-seat ratification. Midnight Union retrofitted the starting force from 31 to 34 fighters and increased Scrap income from 2.7 to 2.9; Borrowed Tomorrow exposed Tomorrow Patrol at 54/44 and Watchmoon at 39/71. The Quartermaster ratified Black-Sail Logistics with an applied receipt; both seats locked the alternate and agreed on Crow's-Nest Cutters at 7 fighters and 54/38 plus Frontline Pirates at 44 Essence. Final release totals are recorded after the v0.9 manifest, package, HTTP, relay, and clean-runtime pass.

Final v0.9.0 release matrix: syntax PASS for five runtime JavaScript files; deterministic systems/maps/factions/doctrines/charters/tactical/rival/bridge coverage PASS 32/32; package PASS 55/55; HTTP PASS 4/4; relay PASS 1/1; total Node suite PASS 37/37; product JSON PASS 5/5. A fresh server reported `0.9.0-grand-doctrines`, 16 doctrines, two branches per faction, 16 core variants, Quartermaster doctrine control, deterministic rival doctrine selection, and synchronized specialized recruit cards; the restarted relay was empty with no occupied seat, no host, and sequence 0. Capability comparison remains DEGRADED only for synchronized shared-world human authority.

## Faction Wonderworks growth pass - 2026-07-28

- Added eight faction-exclusive Wonderworks, each with a unique name, silhouette, automated macro effect, cost, construction time, durability, and two-per-faction limit.
- Added Shift-Bell queue/construction pulses, Gentle Haunting Essence dividends, Moon-Tide scout musters, Walking Hedge healing, Bone Archive fighter restoration, Thousand Windows cap/vision, Plot Device free mobs, and Already Done training/cooldown acceleration.
- Made every Wonderwork inherit the active district charter and scale cadence or static output through mixed-charter wonderweb diversity, so spreading remains the correct strategic expression.
- Added a fifth Expand card, `B` hotkey, faction-colored styling, field-guide contract, construction completion effects, and eight canvas silhouettes without adding worker or siege chores.
- Let the rival's first forward-expansion scheme establish its own faction Wonderwork; applicable effects drive healing, musters, Essence audits, bigger Lantern waves, and faster plan cadence.
- Added a third bounded Quartermaster roof order, **Commission Wonderwork**, with explored/open-roof validation, shared-resource payment, named applied/rejected receipts, Commander signal, and tactical `wonderwork` ownership publication.

Verification: five runtime syntax checks PASS; deterministic/HTTP/relay suite **47/47 PASS**; package contract **62/62 PASS**. Fresh v0.11 health reported eight effects, eight silhouettes, a two-landmark limit, rival use, Quartermaster commissioning, and three targeted orders. Live two-seat proof returned `#1 APPLIED - Commission Wonderwork - Minute Market`; the Commander completed Shift-Bell Foundry, and the bounded post-match atlas retained player `a10` and enemy `a8` as Wonderworks. Commander and Quartermaster browser logs contained no warnings or errors.

## Living Topologies growth pass - 2026-07-28

- Replaced the shared jittered 31-link layout with six separately authored topology contracts: Clockface Spiral, Six-Level Switchback, Banquet Spine, Sleeping Ribcage, Department Constellation, and Escalator Atrium.
- Gave every map 19 strategically placed and individually named roofs, for 114 named landmarks across six 30-38-link networks.
- Routed formation movement, AI schemes, ally movement, map mechanics, route previews, minimap, fog, building anchors, and tactical publication through the selected graph.
- Added a graphical setup preview with topology name, link count, strategy copy, and actual node/link geometry before launch.
- Added a deterministic resilience gate: all six graphs remain connected after removal of any single bridge, preventing one compulsory bridge from deciding the whole macro map.
- Published the selected topology and bounded public roof names to the Quartermaster while retaining unexplored ownership, invisible-force, rival-route, and target fog boundaries.
- Upgraded rival telegraphs and targeted receipts from anonymous roof numbers to names such as `West Tooth` and `Tail Platform`.
- Fixed two live-discovered seams: older anomaly text ran together beneath the new preview, and a still-running pre-change relay stripped the topology label until restarted on the new sanitizer.

Verification: syntax PASS for five runtime JavaScript files; focused topology/mechanic/bridge suite PASS 12/12; deterministic systems/maps/topologies/factions/doctrines/charters/tactical/rival/bridge coverage PASS 36/36; package PASS 59/59; HTTP PASS 4/4; relay PASS 1/1; total Node suite PASS 41/41; product JSON PASS 5/5. Live desktop proof covered all six setup previews, a four-hop Escalator Atrium formation route, the distinct Department Constellation battlefield, and a fresh Sleeping Ribcage two-seat atlas with 19 nodes / 34 links. Quartermaster command #1 rallied Tail Platform with an applied named receipt, matching Commander feed event, and three highlighted active lanes. The capability comparator promotes `game.rts.map.unique-topology` to READY; overall remains DEGRADED only for synchronized shared-world human authority.

## Faction Rooflines + Briarway Gatehouse growth pass - 2026-07-28

- Added eight faction-owned architecture kits for every ordinary Borough, Moon Moot, Watchmoon, and Bridgehead while preserving the four common macro silhouettes and roles.
- Added Clockwork gear crowns, Boo paperwork domes, Moonwake rigging, Thorn briars, Graveyard bone braces, Tin Lantern windows, Mob patchwork, and Temporal echo frames.
- Converted only Thorn Court's ordinary Bridgehead presentation into Briarway Gatehouse at the unchanged ordinary cost, construction time, durability, and role key.
- Added a bounded eight-second Briar Mend pulse that repairs only damaged completed allied ordinary districts within 520 units, excludes itself/Grand Clocks/Wonderworks/enemies/unfinished districts, and scales through the existing mixed-charter bonus up to x1.45.
- Let the rival retain its Wonderwork-first expansion contract, then use Briarway Gatehouses for later Thorn forward districts; other factions retain ordinary Borough expansion until their own conversions are authored.
- Preserved the no-workers, no-routine-siege, spread-friendly charter economy and `hexbound.coop-command/v2` authority boundary.

Verification: five runtime syntax checks **PASS**; total deterministic/HTTP/relay suite **51/51 PASS**; package contract **66/66 PASS**. A fresh restarted server reported `0.12.0-faction-rooflines`, eight architecture kits, four ordinary roles, one conversion, live Briar Mend, rival conversion use, and unchanged browser-host/server-relay authority. Eight matched 1280x720 live build journeys proved the completed Borough rooflines. A separate real-pressure Tuesday skirmish produced `Briarway Gatehouse repaired 1 wonderweb district` and the visible `BRIAR MEND x1` pulse. Repeated stills and semantic polling were used; exact rolling-animation cadence remains UNKNOWN.

## Black-Sail Anchorage route growth pass - 2026-07-28

Release: `0.13.0-black-sail-routes`.

- Converted only Moonwake Corsairs' ordinary Moon Moot presentation into Black-Sail Anchorage at the unchanged ordinary cost, construction time, durability, and role key.
- Added automatic local route support: nearby allied formations already following a macro route move x1.16 faster, scaling through the capped mixed-charter wonderweb to x1.232.
- Multiple Anchorages do not stack; idle, enemy, distant, unfinished, and destroyed sources are excluded.
- Preserved Wonderwork-first rival expansion, then routed later Moonwake forward expansion through ordinary Anchorages.
- Added a sail-and-anchor silhouette, local aura, purple formation arcs, one source-level feed receipt, and a battlefield `SAIL LANE` multiplier without adding workers, a new micro command, direct building attacks, siege, or protocol changes.

Verification: five runtime syntax checks **PASS**; deterministic/HTTP/relay suite **53/53 PASS**; package contract **66/66 PASS**; product JSON **7/7 PASS**. Fresh restarted health and launcher reported `0.13.0-black-sail-routes`, two conversions, Black-Sail route support, Briar Mend, rival conversion use, browser-host simulation, server-relay transport, and `hexbound.coop-command/v2`. The live 1280x720 journey proved the ordinary conversion card, completed silhouette, one formation-level receipt, a real two-hop bridge route, purple route arcs, and `SAIL LANE x1.16`. The first live attempt exposed repeated per-squad feed receipts; source-level gating fixed the seam before promotion. Browser warning/error logs were empty. Repeated stills and semantic polling were used; exact rolling-animation cadence remains UNKNOWN.

## Spectral Census strategic-fog growth pass - 2026-07-28

Release: `0.14.0-spectral-census`.

- Converted only Boo Brigade's ordinary Watchmoon presentation into Spectral Census Bureau at the unchanged 50 Glow, 90 Scrap, 3.4-second construction time, 390 durability, and `C` role key.
- Added an automatic eleven-second audit that files one deterministic still-unexplored roof reachable within four bridge hops, briefly reveals a 185-unit circle for 4.5 seconds, and permanently records the filed cells in remembered fog.
- Let mixed nearby charters shorten the filing interval through the existing capped wonderweb while keeping Broom Patrols as the faster mobile scouting option.
- Added separate player and rival explored/visible maps. Rival schemes now derive ordinary targets and forward-expansion roofs from their own explored board; Grand Clocks remain public strategic objectives and the opening UI reports a genuinely unknown district as `FOG-HIDDEN FORWARD ROOF`.
- Added a file-aerial silhouette, `CENSUS` label, filing ring, stamped bridge trail, named target pulse, and one named receipt without adding workers, attacks, siege, a scouting command, or a co-op protocol change.
- Preserved Wonderwork-first rival expansion, followed by Boo Bureaus, Moonwake Anchorages, and Thorn Gatehouses only for their respective factions.

Verification: five runtime syntax checks **PASS**; deterministic/HTTP/relay suite **56/56 PASS**; package contract **66/66 PASS**; product JSON **7/7 PASS** after sealing. Fresh restarted health and launcher reported `0.14.0-spectral-census`, three conversions, four-hop Census, rival strategic fog, browser-host simulation, server-relay transport, and `hexbound.coop-command/v2`. The live 1280x720 journey proved the ordinary card and completed silhouette, then a centered baseline-active-settled sequence showed the dark frontier, `CENSUS FILED`, stamped bridge path, `FILED CLOCKHEART`, named receipt, and remembered claim access after the 4.5-second active reveal ended. The unattended Properly Serious first observation ended in defeat at 01:36, so the claim-driven proof was rerun on Mildly Inconvenient without changing the mechanic. Browser warning/error logs were empty. Repeated stills and semantic polling were used; exact rolling-animation cadence remains UNKNOWN.

## Faction Formations growth pass - 2026-07-28

Release: `0.15.0-faction-formations`.

- Added eight data-driven core-formation kits and four role contracts, producing 32 deterministic faction-role visual variants.
- Added faction standards, emblems, materials, headgear, and motif effects: `XII`, `FILE`, `MOON`, `CROWN`, `III`, `WIN`, `!`, and `T+1` identify armies at macro zoom.
- Gave Mobs wedge geometry, Hexbows firing ranks, Brooms loose diamonds, and Lanterns compact glowing walls while leaving each formation one squad-level logical unit.
- Kept signature regiments outside the core presentation surface so their existing specialized identity remains intact.
- Locked exact core members, costs, training, speed, range, damage, durability, and sight values in regression coverage; no balance, worker, siege, individual-micro, command, or protocol change ships in this pass.

Verification: five runtime syntax checks **PASS**; new formation suite **5/5 PASS**; deterministic/HTTP/relay suite **61/61 PASS**; package contract **69/69 PASS**; final product/evidence JSON **20/20 PASS**. Eight matched 1280x720 Mild Tuesday skirmishes disabled auto-scout, completed a Lantern formation, selected five squads, and captured one live proof frame per faction. Browser warning/error logs were empty. The current externally owned port-8816 listener served the v0.15 static assets, but its health metadata remains v0.14 because the environment rejected the exact verified restart and the Game Hub has no restart-only route. A fresh isolated HTTP test proves the v0.15 metadata contract. Repeated stills were used; exact rolling-animation cadence remains UNKNOWN.

## Thirteenth-Hour Union Hall growth pass - 2026-07-28

Release: `0.16.0-thirteenth-hour`.

- Converted only Clockwork Coven's ordinary Borough into Thirteenth-Hour Union Hall while preserving its `Z` key, 80 Glow, 75 Scrap, four-second construction, 560 durability, income role, and +80 cap.
- Added an automatic twelve-second bell that grants nearby living allied formations an exact four-second movement and attack-recovery window within 520 world units.
- Set base multipliers to x1.18 movement and x1.16 attack recovery; mixed nearby charters strengthen them through the existing capped x1.45 wonderweb to x1.261 and x1.232.
- Multiple Halls refresh the strongest active values instead of stacking; enemies, dead formations, distant formations, unfinished Halls, and destroyed Halls are excluded.
- Preserved Wonderwork-first rival expansion, followed by Union Halls for Clockwork. The Hall affects formation tempo while Shift-Bell Foundry retains its separate queue/construction role.
- Added a distinct `XIII` clock silhouette, thirteen-spoke Hall ring, orange formation rings and chevrons, live multipliers, feed receipt, and selected-army status without a worker, manual ability button, siege unit, stat rewrite, or co-op protocol change.

Verification: five runtime syntax checks **PASS**; focused district suite **11/11 PASS**; deterministic/HTTP/relay suite **63/63 PASS**; package contract **69/69 PASS**; product/evidence JSON **20/20 PASS** before new seal artifacts. Fresh isolated HTTP tests report `0.16.0-thirteenth-hour`, four conversions, exact 12/4/520 boundaries, x0.18/x0.16 bonuses, mixed-charter scaling, and non-stacking behavior. A 1280x720 Mild Tuesday live sequence retained settled baseline, active, and confirmed post-shift frames: the active state visibly showed the `XIII` Hall, four shifted squads, x1.18 markers, feed receipt, and selection receipt; the settled frame cleared squad markers and selection status. Browser warning/error logs were empty. The externally owned port-8816 listener serves current static v0.16 assets but still reports v0.14 in-memory metadata; fresh isolated server coverage proves the v0.16 contract. Repeated stills prove the bounded state transition; exact sub-frame cadence remains UNKNOWN.

## Foreground Spotlight growth pass - 2026-07-28

Release: `0.17.0-foreground-spotlight`.

- Converted only Once-Upon-a-Mob's ordinary Watchmoon into Foreground Spotlight while preserving its `C` key, 50 Glow, 90 Scrap, 3.4-second construction, 390 durability, huge-vision role, and no-attack contract.
- Added an automatic thirteen-second casting cue that selects the nearest currently visible enemy formation within 520 world units as the lead role for exactly five seconds.
- Nearby player and AI-allied formations deal x1.18 damage to that formation; mixed charters strengthen the value through the capped x1.45 wonderweb to x1.261.
- Buildings are excluded, and overlapping stages select the strongest active source rather than stacking. Dead or distant formations plus unfinished, destroyed, or expired sources grant no bonus.
- Preserved Wonderwork-first rival expansion, followed by Foreground Spotlights for Mob. Plot Device Factory retains its separate free-Mob production role.
- Added a three-lamp scaffold, `FOREGROUND` fascia, local stage ring, gold casting beam and target oval, `CAST: LEAD`, one feed receipt, and `LEAD ROLE` multiplier without workers, a manual paint-target ability, individual fighter control, routine siege, or a protocol change.

Verification before structural sealing: five runtime syntax checks **PASS**; focused district suite **13/13 PASS**; deterministic/HTTP/relay suite **65/65 PASS**. A 1280x720 Properly Serious Tuesday skirmish charged the ordinary Watchmoon price, completed the stage under Pumpkin Night Market, and produced a retained baseline-active-settled sequence. The active frame visibly shows `LEAD ROLE x1.18`, the gold beam, target oval, `CAST: LEAD`, and one feed receipt; the settled frame clears the beam and target marker after the exact five-second state window. Repeated stills prove the state transition; exact sub-frame animation cadence remains UNKNOWN because no rolling buffer was exposed.

## Every-Window Assembly growth pass - 2026-07-28

Release: `0.18.0-every-window-assembly`.

- Converted only Tin Lantern Republic's ordinary Borough into Every-Window Assembly while preserving its `Z` key, 80 Glow, 75 Scrap, four-second construction, 560 durability, income role, and +80 cap.
- Added an automatic threat-gated thirteen-second pulse: if a currently visible enemy formation is within 520, the completed living Assembly raises exactly five seconds of Civic Cover for nearby allied formations.
- Civic Cover reduces incoming formation damage by 14%; mixed charters strengthen the reduction through the capped x1.45 wonderweb to 20.3%.
- Buildings are excluded. Leaving range, source destruction, expiry, dead or invalid targets, and hostile formations remove or deny protection; overlapping Assemblies use the strongest eligible source rather than stacking.
- Preserved player/team-1 AI alliance support and Wonderwork-first rival parity, followed by ordinary Assemblies for Tin, without a worker, manual conversion button, individual fighter control, repair chore, routine siege, or protocol change.
- Added an expanded civic facade, lit windows, `ASSEMBLY` fascia, idle window ring, active gold source ring, local support arcs, polygon formation shields, `CIVIC COVER` reduction labels, and one source feed receipt.

Verification before structural sealing: five runtime syntax checks **PASS**; focused district suite **15/15 PASS**; full Node suite **67/67 PASS**; package contract **69/69 PASS**. Fresh isolated health and launcher coverage report v0.18, six conversions, exact 13/5/520 boundaries, 14% reduction, capped mixed-charter scaling, strongest-only non-stacking, building exclusion, AI-allied benefit, and rival conversion use. A 1280x720 Properly Serious Tuesday Tin skirmish produced a retained baseline-active-settled sequence: the active frame shows four `CIVIC COVER 14%` formation shields and the four-formation feed receipt, and the settled frame clears the temporary cover markers while the completed Assembly remains. Browser warning/error logs were empty. Repeated same-viewport stills prove the state transition; exact sub-frame animation cadence remains UNKNOWN because `visual.capture.ephemeral-rolling-buffer/v1` was unavailable.

## Last-Rites Exchange growth pass - 2026-07-28

Release: `0.19.0-last-rites-exchange`.

- Converted only Graveyard Shift's ordinary Borough into Last-Rites Exchange while preserving its `Z` key, 80 Glow, 75 Scrap, four-second construction, 560 durability, income role, and +80 cap.
- Added an automatic Wake Dividend: formation casualties within 520 award the source formation's side 55% extra Essence through the strongest eligible completed Exchange.
- Mixed nearby charters strengthen the dividend through the capped x1.45 wonderweb to 79.75%; overlapping Exchanges never stack, buildings never qualify, and zero-death or malformed events pay nothing.
- Routed normal combat and hazard casualties through one account-aware award path. Player dividends credit shared Essence; rival dividends credit `enemyEssence`, which the existing 60-Essence ghost audit can spend.
- Preserved Wonderwork-first rival expansion, followed by ordinary Exchanges for Graveyard, without a worker, corpse-harvest button, individual fighter control, routine siege, or protocol change.
- Added the bone-ledger and skull facade, `LAST RITES` fascia, receipt ring and slips, plus post-formation `WAKE DIVIDEND +55%` and exact `LAST RITES +0.6 ESS` plaques.

Verification before structural sealing: five runtime syntax checks **PASS**; focused district suite **18/18 PASS**; full Node suite **70/70 PASS**; package contract **69/69 PASS**; isolated HTTP suite **4/4 PASS**. Fresh health and launcher coverage report v0.19, seven conversions, 520 range, 55% base dividend, mixed-charter scaling, strongest-only non-stacking, building exclusion, player/rival account parity, and rival dividend spending. A 1280x720 Mild Tuesday Graveyard skirmish produced a retained baseline-active-settled sequence: the active frame visibly shows `WAKE DIVIDEND +55%`, `LAST RITES +0.6 ESS`, the source ring, and receipt slips; the settled frame clears temporary cues while the completed Exchange remains. Browser warning/error logs were empty. Repeated same-viewport stills prove the state transition; exact sub-frame animation cadence remains UNKNOWN because `visual.capture.ephemeral-rolling-buffer/v1` was unavailable. Three current-loop temporary directories remain after two exact cleanup attempts were policy-rejected; they are an explicit cleanup seam, not promotion evidence.
