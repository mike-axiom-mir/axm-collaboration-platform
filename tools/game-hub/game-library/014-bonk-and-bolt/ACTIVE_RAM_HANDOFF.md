# Bonk & Bolt — Active RAM Handoff

Updated: 2026-08-16 Europe/Amsterdam  
Status: `ACTIVE STEWARDSHIP / CURRENT UNSEALED TEST: LANTERN ROUTE EXPANSION + UNIVERSAL GAMEPAD READINESS / LATEST SEALED PASS: LICENSED HUMAN PRODUCTION-RIG BRIDGE`

This is the compact operational handoff for a fresh Codex task. It is a
`DERIVED_VIEW`, not hidden model reasoning and not a replacement for source,
tests, or durable evidence. If this file disagrees with executable code or fresh
verification, the code and fresh verification win.

## Active objective

Continue stewarding Bonk & Bolt toward the user's deliberately ambitious finished
game vision. The full objective is still active. Do not call the whole game
finished merely because a bounded pass is sealed.

The current unsealed package is `1.1.1-universal-gamepad-test`. Its content slice
remains `1.1.0-relay-test`: a sixth independent adventure, The Lantern That
Missed Curfew, and three ordered non-failing 3D route
rehearsals. Active course, checkpoint and clock survive reload; attempts,
completions, exits and personal bests persist. One story outcome widens route
gates 30%; the other suspends ordinary nuisance aggression during active runs.
Mile-0 becomes the sixth outcome-specific robot witness. This extends things to
do without lengthening the 24-hour clock or adding a currency/reward grind.

The `1.1.1` Steam-readiness overlay migrates P1 and P2 to
`axm-universal-xbox-brawl-v0.2.1`, preserves keyboard/mouse fallback, exposes
unsupported/unassigned/disconnect states, and has a labeled live browser
simulation receipt. Physical controller feel remains unrun and must not be
promoted from that simulation.

The latest sealed slice remains the licensed Human production-rig bridge. Its
Quaternius CC0 source, hash, license, animation mixer and procedural fallback are
unchanged by the route expansion.
The next task should read this handoff and `STEWARD_MEMORY.md`, take a new
shared-workspace snapshot, then continue one bounded high-value game-depth or
production-quality seam.

## User vision that must survive compaction

- A polished 3D cartoon open-world RPG with readable elevated movement and camera
  language similar in accessibility to Brawl Stars, not a flat painted game.
- Solo or two-player local co-op. Network co-op is not currently promised.
- Three classes, two races and separate Human/Toon starts.
- No conventional main quest. Side adventures begin small and separately, then
  naturally reveal the larger story.
- Comedy weapons and attacks; fights should be memorable and funny in victory or
  defeat, but still mechanically readable.
- Deep equipment choices, manipulation and drawbacks; uncommon meaningful drops,
  little junk and optional auto-salvage.
- No pressure economy built around temporary “next few hits” consumables. Meals
  may last around an hour and should change play or the world.
- Fishing and cooking must have authored long-term meaning, rivals, cook-offs,
  ecology and world consequences instead of repetition levels.
- Challenges must state the exact action, count and region. No secret puzzles,
  lucky discovery requirements or internet-guide dependence.
- Miniature robots begin neutral, have jobs and villages, can be commanded or
  hijacked, become late-game pets, can be downed and revived, and must matter to
  the world rather than existing only as collectibles.
- Resonance stones are world RNG earned naturally through long play. Bonding uses
  one stone; holding exactly two consumes both; holding three or more consumes
  only two. This deliberately discourages small hoards while rewarding large ones.
- Golden Ducks caught through fishing can revive players and fully rebuild bonded
  robots, while sometimes giving resources or special gifts.
- At 24 saved play-hours, an invader gradually enters. Humans and toons cannot win
  alone; the player restores robot identities and chooses specialist brains for a
  robot team. Winning truly wins but play continues. Losing leaves a persistently
  damaged world and an extremely difficult robot-led recovery campaign.

## Workspace ownership — do not blur the games

Owned lane:

`<AXM_WORKSHOP>\tools\game-hub\game-library\014-bonk-and-bolt`

The user has three or more builders working on separate games. Never edit slots
015, 016, 017, 018 or any other game while stewarding 014. Do not change shared
registries or manifests unless the user explicitly expands scope and ownership is
re-checked. There is no repository-level Git state available here and no relevant
`AGENTS.md` was found in the lane ancestry.

The final shared-workspace snapshot scanned 2,286 files and observed 263 active
files. Foreign activity was present in slots 012, 013, 015, 016 and 017; six
active foreign shared seams were present in slots 012, 015 and 017. None
overlapped slot 014. No foreign file, game, manifest or shared registry was
edited, and all writes remained in the sole owned lane.

## Current shipped architecture

- Launcher: `START_BONK_AND_BOLT.cmd` → `START_BONK_AND_BOLT.ps1`.
- Local runtime: Three.js/WebGL game served by `runtime/server.js`.
- Canonical route: `http://127.0.0.1:8814/games/014/`.
- Port 8814 is currently clean; no runtime was intentionally left running.
- Save: browser-local, normalized by deterministic helpers in `runtime/systems.js`.
- `runtime/game-data.js`: authored world, quests, encounters, recipes, enemies,
  equipment and progression data.
- `runtime/systems.js`: deterministic save-state and domain logic.
- `runtime/motion-system.js`: engine-independent class action profiles, phase
  sampling and reduced-motion pose contracts.
- `runtime/coop-camera.js`: engine-independent midpoint, zoom, distance-state and
  symmetric movement-boundary contracts.
- `runtime/hero-rig-contract.js`: relocatable asset metadata, integrity contract,
  semantic clip resolution and class action mapping.
- `runtime/vendor/GLTFLoader.js` plus `BufferGeometryUtils.js`: local Three.js
  r160-compatible GLB loading path.
- `runtime/assets/characters/quaternius/animated-men/`: licensed Human GLB and
  adjacent provenance note.
- `runtime/app.js`: scene construction, interaction, combat, HUD, quest advancement,
  QA routes and runtime loop.
- `runtime/index.html` and `runtime/styles.css`: game UI and presentation.

Useful call sites:

- Quest targets: `progressQuests(type, id, amount)`.
- Cooking resolution: `finishCooking()`.
- Enemy flow: `damageEnemy()` and `defeatEnemy()`.
- Interaction and proximity: `interact()` and `updateNearby()`.
- World actors: `populateWorld()` and `updateNpcLife()`.
- Objective display: `renderQuestHud()`.

## Major systems already present and sealed

- Explorable elevated-camera 3D cartoon valley with Human, Toon and robot towns.
- Three classes, two races, separate starts and solo/local two-player controls.
- Shared-screen co-op with bounded midpoint framing, a visible distance/tether
  covenant and no teleport, timer, damage, currency or reward penalty.
- Comedy enemy contracts, species-specific attacks, defeat jokes and village life.
- Thirteen authored equipment designs with two executable branches, live drawbacks,
  retuning costs, Human Second Opinion, dual-branch drops and auto-salvage.
- Five nuisance-specific drop origins with immutable item provenance, explicit
  gold return markers, named robot-built installations and persistent world rules
  that survive later salvage.
- Four recipes with distinct Chop/Stir/Plate cook-off rounds, named rivals, finite
  permanent kitchen lessons, personal records and long world-changing meals.
- Active fishing, persistent pond ecology, daily baskets, Golden Ducks and robot
  revival.
- Six neutral/bondable miniature robots with distinct terms, health, world jobs,
  executable specialties, partner combat and enemy hijacking.
- Six authored story decisions with persistent rendered world consequences.
- Three replayable route rehearsals with saved active state, completions and bests.
- Four authored comedy encounters: passport hearing, spotlight Hecklecrab encore,
  readable identity-thief chase and the three-clearing weather relay; river
  progression separately requires a cook-off win.
- Named cross-town recovery helpers after real authored-fight losses. Help is free,
  optional, non-stacking, untimed, survives repeated losses and has no reward penalty.
- Six named post-adventure public witnesses with outcome-specific reports, exact
  map markers/challenge wording and named participation in the 24th-Hour robot team.
- Gradual 23rd-hour omen, robot-only finale damage, persistent ruined-world loss,
  bonded-robot resistance and a playable won world.

## Latest sealed slice — Origin Reclamation Parade

`originParadeStatus()` and `originParadeRoute()` are pure systems contracts used
directly by the renderer:

- Two resolved origin echoes unlock one moving public museum. Merely finding an
  origin does not count, and the derived contract never mutates progression.
- The same single cart centers two to five origin-shaped modules in authored
  definition order. It reads the settled world ledger, so salvaging every source
  item cannot erase the later consequence.
- The cart follows a calm bounded dry-meadow loop by day and parks at exact
  `(-6, 30)` under a stronger lantern at night.
- Arbiter-0 names every represented steward, installation and region. The
  interaction grants no reward, repeat chore, currency, item cost or timer.
- Its twelve-meter moving sanctuary suspends ordinary enemy aggression and the
  world map exposes one current-route `MOVING MUSEUM` marker.

Live 1280x720 observations covered centered two-module day, five-module day,
five-module night, map-marker and interaction states. A query-free canonical
reload restored the parked five-memory museum with empty inventory and 20
unchanged bolts. Browser warning/error logs were `[]`. Exact route and parking
behavior comes from deterministic tests and direct runtime datasets, not
screenshot timing. QA route:
`?testSteward=origin-parade&testOrigins=0|1|2|5&testNight=1`.

## Previous sealed slice — Co-op Camera Covenant

The original shared camera always included both players by growing its offset
with separation. Live baseline interaction proved that at roughly 50m it made
both heroes very small and provided no reason or regroup guidance. The corrected
contract is pure browser/Node code and is used directly by the renderer:

- `TOGETHER` through 22m, with ordinary shared framing and no ground tether.
- `SHARED VIEW WIDENING` from 22m to 31m; outward movement begins easing only
  after 26m and a gold ground tether makes the shared relationship visible.
- `REGROUP · OUTWARD EDGE HELD` from 31m; at 36m further radial separation stops,
  but inward movement remains unchanged and tangential input follows the edge.
- Camera scale uses at most the 36m framed distance. Both players are symmetric;
  neither is teleported, damaged, charged, timed or assigned ownership priority.
- Solo retains the existing 22/28/26 elevated-camera offset and no co-op card or
  co-op diagnostics.

Live 1280x720 observations covered 8m, 27m and 34m staged states. In direct live
state, 320 outward key presses converged at 35.99m with movement scale 0.001 and
camera height 34.48. Eight inward presses immediately reduced separation by
2.11m with scale restored to 1.000. Browser warning/error logs were `[]`. Exact
movement and boundary behavior comes from deterministic tests and runtime state,
not screenshot timing. QA route:
`?testSteward=coop-camera&testSpread=close|wide|regroup`.

## Previous sealed slice — Cartoon Attack Language

`runtime/motion-system.js` is a pure browser/Node contract. It declares bounded
anticipation, impact, recovery and settled phases for attack, special and dodge,
then returns named root/body/head/arm/weapon/action-cue poses. The renderer uses
that tested sampler directly rather than maintaining an unrelated visual path.

- Panzer crouches, raises the spring pan and lands a heavy gold slam arc.
- Pun-Slinger leans into recoil and produces a teal bread-fan sweep.
- Gear Shepherd winds up like a conductor and answers with a violet command arc.
- Local P2 uses the same contract independently of P1.
- Reduced motion disables locomotion bounce and pose travel while preserving a
  compact static class-colored action cue.

Every hero publishes a version-1 semantic binding for root, body, head, left arm,
right arm, legs, weapon and action cue. Future provenance-recorded skeletal rigs
can replace the current procedural parts without rewriting combat. Damage,
cooldowns, projectile creation and hit timing remain unchanged.

Live 1280x720 observations covered Panzer attack, Pun-Slinger special, Gear
Shepherd special, separated P2 attack and reduced-motion attack. The observed
semantic phases returned to `settled`; browser warning/error logs were `[]`.
Exact phase duration and ordering come from deterministic tests, not screenshot
timing. QA route: `?testSteward=attack-language&testClass=<class>&testCoop=1`.

## Previous sealed slice — Tomorrow's Weather Is Missing

The fifth independent side adventure begins at Professor Drizzlewick's brass
forecast umbrella beside Raincheck-4 in Wobblewoods. It reveals that the forest
recorded the violet wrong-light before the 24th Hour instead of adding another
generic reward errand.

The Three-Clearing Forecast is a physical open-ground arena with six Mood Clouds:
exactly two inside each of three visible circles. Only the current gold clearing
counts. Progress at 2/6 and 4/6 announces and lights the next circle. Live play
found that one area attack could initially recalculate the active circle during
its own target sweep; a 0.45-second transition gate now prevents that cascade.
The complete corrected sequence was replayed from 0/6 to 6/6.

The permanent saved-world choice is fully explicit:

- Public Forecast Lattice: every Mood Cloud puddle displays a 1.1-second gold
  warning before damage.
- Rainbow Shelters: defeated Mood Clouds leave a 10-second dry shelter that
  blocks mood-puddle damage.

Neither branch costs bolts, consumes an item, reduces rewards, starts a pressure
timer or hides a correct answer. Raincheck-4 becomes a public village witness.
After a loss, Lux-11's free Patient Weather Lamps slow relay-cloud drift to 62%
until victory. The named report challenge now requires six exact witness regions
and recomputes completion from progress against its current amount, preventing a
legacy 4-of-5 save from displaying false completion.

Live 1280x720 proof covered the exact start action, all three gold-circle states,
the anti-cascade correction, both choice consequences, a visible gold warning
ring, a later `FEELINGS: DAMP` state and canonical reload persistence as
`MEMORY: WARNINGS ON`. Browser warning/error logs were `[]`. The exact 1.1-second
value is deterministic evidence; screenshots are not used to claim sub-frame
timing.

QA routes: `?testSteward=encounter-forecast` isolates the real relay, and
`?testSteward=forecast-rule` preserves the selected branch while staging one real
Mood Cloud for bounded consequence observation. Neither weakens shipping rules.

## Previous sealed slice — Origin Echoes

Every ordinary nuisance species now owns one authored equipment origin. A kept
drop stores the nuisance, region and optional authored encounter on the item. The
first kept item from an origin creates exactly one saved return journey; automatic
salvage creates none and later same-origin finds do not create repeat chores.

Gold map markers lead to five physical robot-built sites:

1. Nib-7 — Duplicate Stamp Garden: hostile forms travel 25% slower.
2. Chime-2 — Heckle Delay Bell: open-mic telegraphs last 0.35 seconds longer.
3. Moss Boss — Public Rainbow Drain: mood puddles deal one less damage per tick.
4. Lux-11 — Identity Thread Lantern: Loose Screws cannot hijack neutral robots.
5. Dock-3 — One-Bolt Refund Roost: Tax Goose steals at most one bolt.

Settlement costs zero bolts, consumes nothing and has no timer or reward penalty.
Once resolved, the world installation and executable rule survive even if the
item is salvaged later. This prevents inventory-hostage pressure while giving an
uncommon find an authored later consequence.

QA route: `?testSteward=origin-echo`. It stages one rare Hat of Too Many
Committees from the Emergency Passport Hearing beside Nib-7's Kettlewick site.
A version marker preserves settlement and later salvage through reload.

Live proof showed Hostile Paperwork, Kettlewick and Lunch Hearing provenance,
the gold origin marker and physical stamp installation. Settlement changed
`SETTLE` to `REVISIT` at 20 bolts. Manual salvage paid 7 bolts and removed the
item; continuing through canonical `/games/014/` kept the empty inventory, 27
bolts and the physical `persistent world change · no item required` interaction.
Final browser warnings and errors were exactly `[]`.

## Previous sealed slice — Civic Contradiction Bench

A physical golden-gear council platform now sits on open Boltborough ground with
Arbiter-0 and four colored call-in terminals. It is always shown on the map and
unlocks after any two named public robot reports.

Any kept item stores one persistent argument:

1. Dock-3 — Factory Wiring: selected branch, original power, one drawback pass.
2. Nib-7 — Quiet Bypass: selected branch stays, raw power becomes zero, drawback
   is completely disconnected.
3. Chime-2 — Heckler Overclock: selected branch applies twice, raw power gains 2,
   and the drawback applies twice.
4. Lux-11 — Contradiction Harness: both branches, raw power loses 2 with a floor
   of zero, and the drawback applies twice.

Arguments are permanent until revisited but always free and reversible. They use
no bolts, consumables or timers and never penalize rewards. Inventory and paper
doll expose effective/base power, doubled/bypassed mechanics and the named robot.

QA route: `?testSteward=gear-council`. It stages exactly two heard reports, two
kept items, 20 bolts and an invulnerable solo Human Panzer beside the bench. A
version marker prevents ordinary reload from overwriting the selected argument.

Live proof applied Heckler Overclock to Springpan Supreme: base power 8 became
effective power 10, both BONK radius and the squeak drawback displayed `WIRED
TWICE`, and bolts remained 20. Returning to title and continuing preserved the
argument and power. The map displayed `FREE GEAR COUNCIL`; final browser logs were
exactly `[]`.

## Latest sealed licensed Human production-rig bridge

- `runtime/hero-rig-contract.js` declares one relative Human asset path, exact
  CC0 source/license/hash metadata, expected 31-joint/11-clip structure and
  exporter-neutral semantic clip suffixes.
- `runtime/app.js` keeps the primitive visible while loading, validates the
  skinned mesh, joints, required roles and bounds, then normalizes the licensed
  model to the existing three-meter hero scale. Human idle/walk and class
  actions use `THREE.AnimationMixer`; code-native weapons, cues and the tested
  motion sampler retain class identity.
- Any contract or load failure leaves the original Human playable. The focused
  `&testRigFail=1` route forces that fallback without making a failed request,
  so clean-log failure recovery is deterministic.
- Reduced motion stops all production actions at `reduced-static` and retains
  the existing static high-contrast cue. Toon remains code-native rather than
  being visually homogenized by the Human asset.
- Live 1280x720 proof reported production / human-casual-a / CC0-1.0 / 31 bones
  at idle, a bounded W input reported walk, Pan Slap reported slash plus
  attack:slash and a separated later state returned to idle. Reduced motion
  reported reduced-static. Forced fallback reported procedural / original-code
  and visibly completed Pan Slap. Final browser warning/error logs were empty.

## Current unsealed TEST verification

- JavaScript syntax checks: PASS.
- Hero motion test: `8/8 PASS`.
- Co-op camera test: `10/10 PASS`.
- Hero rig contract test: `7/7 PASS`.
- Systems test: `PASS 253`.
- Package self-test: `PASS 126`.
- HTTP smoke: `4/4 PASS`.
- Focused package verifier: `0 errors / 1 pre-existing gamepad-profile migration warning`.
- Live 1280×720 WebGL: Meadow route completed by visible keyboard input; saved
  best exposed in the three-course board; Two-Town checkpoint 2 and hero position
  survived two reloads; active map marker and reduced-motion static frames checked.
- Latest sealed evidence JSON and production-rig hash manifest remain unchanged.
- Required Workshop gates: `10/10 PASS` at the final snapshot. The first run
  briefly saw a foreign `challenge-arena` lifecycle failure; its owner repaired
  it concurrently and both affected gates were rerun at `0 FAIL`.
- Browser tabs were finalized and isolated port `19814` was cleaned.

Primary receipts:

- `BUILD_RECEIPT.md`
- `STEWARD_MEMORY.md`
- `evidence/production-rig-pass.json`
- `evidence/production-rig-hashes.json`
- `evidence/capability-gap-report.json`
- `evidence/shared-workspace-production-rig-final.json`
- `evidence/session-memory/session-2026-07-28-production-rig-handoff.jsonl`
- `evidence/session-memory/session-2026-07-28-production-rig-handoff.seal.json`

The handoff segment seal is valid: 15 event lines, 15 valid JSON lines, zero
invalid lines, SHA-256
`8552159202b4dfb075c6b2b8dc9a594ddca674b135d7b54d850603c6339db8cb`.

## Live corrections worth remembering

- The first forecast completion allowed one Breakfast Avalanche to recalculate
  the active clearing during its own target sweep and jump from 3/6 to complete.
  `forecastGate` now pauses damage acceptance for 0.45 seconds at the 2/6 and
  4/6 transitions. The full three-clearing route was replayed after this fix.
- The first equipment-council QA pass inherited four old reports and showed an
  unclear `4 / 2`. The route was versioned to stage exactly two reports once, and
  copy now separates `REPORTS HEARD` from `REQUIRED`.
- Previous passes found and corrected a robot intersecting a Kettlewick roof,
  identity thieves moving too quickly to read, activity-area enemy damage, an
  encounter QA normalization leak, ambient interference and projectile cleanup
  after same-frame encounter loss. Do not remove those guards casually.
- The first route QA hook reset the active course on every reload. It now stages
  only an empty ledger, writes `qaRouteTrialVersion`, and preserves real active
  checkpoint, clock, records and hero position on later reloads.
- The first route map frame stacked the new board and Mile-0 report over the
  central world memory. Dedicated vertical offsets keep all three labels readable.

## Honest capability gaps

- One licensed Human skeletal rig is integrated and the normalized capability
  report now marks production-character-quality `READY`. Cast breadth remains a
  major quality gap: bespoke Human sculpting, Toon/robot rigs, facial animation,
  grip correction, costumes and LODs still need Blender-capable authorship.
- Network co-op is absent; local shared-screen co-op is the current contract.
- Audio is synthesized/degraded rather than production-library quality.
- One large-valley visual-scale path remains degraded.
- Literal 24-hour soak and physical gamepad verification remain unproven.
- `visual.capture.ephemeral-rolling-buffer/v1` is unavailable; repeated screenshots
  prove visible states but do not justify sub-frame cadence claims.

Blender is free but remains unavailable in this tool lane. The user expected to
make room on a 5 TB drive and later move large asset libraries there. They also
mentioned three asset pages that still need linking. The current GLB is an honest
production-source bridge, not final Bonk & Bolt cast art. Preserve package-local
relative paths so moving the package to the large drive will not break it.

## Recommended continuation queue

1. Re-read this file, `STEWARD_MEMORY.md`, `BUILD_RECEIPT.md`, relevant evidence,
   and the exact source seam before editing. Take a fresh shared-workspace snapshot.
2. If another provenance-ready production source is available, prioritize one
   bounded Toon or miniature-robot rig bridge, or improve Human weapon grip/socket
   alignment without creating a parallel combat-motion authority.
3. Human-play the full Two-Town Nightline and Vale Companion Tour on the target
   controller; tune route landmarks only from that evidence, not to chase the par.
4. Extend the five origin echoes only when a new source can change a genuinely
   different world rule; never add repeat chores, collectible volume or generic
   reward mail.
5. When Blender is ready, prioritize bespoke Human/Toon/robot silhouettes,
   facial animation, grip sockets, costume variants and LODs. Record licenses and
   provenance, keep runtime paths relocatable, and retain the tested fallback.
6. For every slice: deterministic tests first, focused verifier, then repeated
   live visual interaction. Source checks alone do not prove a game works.
7. Never claim sub-frame timing from screenshots; the browser has no rolling
   frame buffer. Finalize browser tabs and clean temporary ports after verification.

## Exact commands for a fresh checkpoint

Run from the owned lane:

```powershell
node --test tests/coop-camera.test.js tests/hero-motion.test.js tests/hero-rig-contract.test.js
node tests/systems.test.js
node tests/package-selftest.js
node --test tests/server-http.test.js
node -e "const v=require('C:/axm workshop/tools/game-hub/game-package-verifier.js'); const r=v.verifyGameDir(process.cwd()); console.log(r); if(r.errors.length||(r.warnings||[]).length) process.exit(1)"
```

## Curation receipt

```text
session_id: bonk-bolt-production-rig-handoff-2026-07-28
sealed_segment: evidence/session-memory/session-2026-07-28-production-rig-handoff.jsonl
seal_digest: 8552159202b4dfb075c6b2b8dc9a594ddca674b135d7b54d850603c6339db8cb
durable_events_preserved: 15 compact ordered events
telemetry_aggregation: only decisive verdicts, visible state transitions and workspace boundaries retained
temporary_material_deleted: none created in the lane; browser screenshots were transient and no rolling buffer existed
explicit_retention_exceptions: canonical game source, saves and user sources untouched
derived_views_updated: ACTIVE_RAM_HANDOFF.md and STEWARD_MEMORY.md
unclassified_items and review deadline: none
authority used: explicit user request to continue autonomous Bonk & Bolt stewardship and preserve active handoff memory
```
