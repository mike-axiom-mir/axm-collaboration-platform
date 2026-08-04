# Build receipt

- Artifact: `014-bonk-and-bolt`
- Version: `1.0.0-first-edition`
- Lane: only `tools/game-hub/game-library/014-bonk-and-bolt/`
- Shared seams changed: none
- Runtime: local Three.js/WebGL game, local HTTP server, browser-local save
- Isolated launch: slot `014`, port `8814`, path `/games/014/`

## Verification

- Hero motion test: PASS, 8 tests covering all three classes and all three
  actions, ordered anticipation/impact/recovery/settlement, distinct class
  signatures, Panzer slam, Pun-Slinger fan, Gear Shepherd sweep, reduced-motion
  base-pose preservation and safe fallback identifiers.
- Co-op camera test: PASS, 10 tests covering solo framing, honest player
  midpoint, explicit distance states, bounded camera scale, unchanged movement
  inside the soft edge, outward-only damping, the 36m hard edge, immediate inward
  control, useful along-edge control, player symmetry and dodge containment.
- Hero rig contract test: PASS, 7 tests covering the valid relative CC0 Human
  asset, intentional code-native Toon path, exact binary size/hash and adjacent
  provenance, exporter-prefix-neutral semantic clip resolution, complete
  three-class action binding, safe unknown identifiers and explicit incomplete
  clip sets.
- Systems test: PASS, 236 checks including classes/races, executable equipment
  effects and drawbacks, free/paid branch retuning, escalating workshop costs,
  dual-branch drops, salvage discounts, 75-minute meal gear, exact stone
  consumption, per-pet health and downing, six distinct miniature specialties,
  pet selection and Golden Duck recovery, persistent pond ecology, daily
  baskets, recipe-gated hybrid drops, explicit challenges, saved-state
  round-trip, five permanent story-decision contracts and effects, legacy-choice
  compatibility, continuous omen boundaries, 24th-hour invasion, persistent
  ruin stages, post-resistance scar preservation, five distinct ordinary-enemy
  behavior contracts, thirteen authored citizens, saved one-time town favors,
  finite rival-cooking progression with persistent personal records, four
  authored adventure-encounter contracts, quest wiring, retry-safe attempt and
  first-win ledgers, encounter-record save round-trips, five evolving robot
  witness reports, repeat-safe report versions, explicit five-region challenge
  progress, public-memory save round-trips, authored-fight losses, optional
  cross-town recovery offers, non-stacking free assists, assisted-loss
  persistence, assisted wins, recovery-ledger save round-trips, a two-report
  equipment-council unlock, four executable robot arguments, free reversible
  application, exact doubled/bypassed/dual-branch effects, argument save
  round-trips, five authored nuisance origins, immutable item provenance, kept-only
  echo creation, duplicate suppression, free permanent settlement, five distinct
  world-rule changes, post-salvage persistence and origin-ledger save round-trips.
- Package self-test: PASS, 118 checks including local-only dependencies, required
  files, equipment-to-combat connections, ecology/cooking connections and
  activity sanctuary coverage, partner follow/combat, enemy neutral-robot
  command, all six miniature action branches, persistent story-memory rendering,
  the Golden Duck/story/event QA routes, bonded resistance, persistent pet
  damage, species-specific comedy combat, village routines, night lighting,
  three distinct cook-off rounds, visible rival scoring, authored adventure
  landmarks and movement rules, the spotlight damage gate, the story-only
  `cookwin` gate, encounter QA routes, chase fairness, and removal of the
  obsolete village-team retry, physical witness shifts, map report markers,
  outcome-specific dialogue, named-witness deployment in the 24th Hour, physical
  recovery helpers, distinct assist mechanics, co-op shared-knockout handling,
  projectile cleanup, a reload-safe recovery verification route, the physical
  Civic Contradiction Bench, its four named speakers, modal and map wiring, and
  a deterministic reload-safe council route, five named origin installations,
  physical return interactions, exact map and inventory guidance, five live
  nuisance-rule connections, a reload-safe origin-echo route, a guarded
  three-clearing forecast transition, a focused weather-rule route, the pure
  motion contract, version-1 semantic rig bindings, shared action sampling,
  reduced-motion suppression, the focused attack-language route, the pure co-op
  camera covenant, symmetric player wiring, visible tether/HUD feedback and the
  focused co-op-camera route, the relocatable CC0 hero-rig contract, local
  revision-matched GLB loader dependencies, animation-mixer semantics,
  deterministic production/fallback routes and static reduced-motion behavior.
- HTTP test: PASS, 4 checks for health, canonical route, static asset and
  traversal guard.
- Shipping-port smoke: PASS on isolated port `8814`; health identified only
  `014-bonk-and-bolt` and the game route returned HTTP 200.
- Double-click launcher syntax: PASS; it waits for that exact health identity
  before opening the browser and stops only the server process it created.
- Focused Game Hub package verifier: PASS with zero errors and zero warnings.
- Evidence verification: PASS for 51 JSON files after the production-rig hash
  manifest, plus the 15-line sealed production-rig session segment.
- Live desktop browser: PASS for title/setup, Human and Toon starts, 3D movement,
  attack cooldown, panels, map, quest selection, pause behavior, save/continue,
  local Player 2 movement, forced finale, persistent win and post-win play.
- Fresh post-win reload: PASS with a live WebGL canvas and zero new browser
  warnings or errors.
- Stewardship live pass: PASS for visible fish monuments, once-per-day ecology
  baskets, pond-specific catches, all four recipe consequence descriptions,
  active-meal HUD state and Pet Whisper's reveal-without-free-bond behavior.
- Interaction safety retest: PASS at pond, cook-off and miniature robot; health
  remained 100 through five-second observations and the final browser log was
  empty.
- Equipment workshop live pass: PASS at 1280x720. Human Second Opinion switched
  Springpan branches for zero bolts; the next switch spent 11 and raised the
  following price to 14. Both active mechanic and live drawback stayed visible.
- Retuned combat live pass: PASS. Five bounded attacks after selecting the
  breakfast branch produced a visible `BREAKFAST!` world effect; the inventory
  closed cleanly, health remained 100 and the browser log stayed empty.
- Miniature partner live pass: PASS at 1280x720. The workshop displayed all six
  jobs, requirements, health states and specialties; selecting Siren Sue placed
  it beside the hero and Civic Siren entered cooldown after commanding neutral
  robots. Moss Boss then began downed at 0/68 with Ranger Audit locked; a live
  Golden Duck catch rebuilt it to 68/68 and restored the action. The corrected
  workshop close glyph rendered cleanly and the final browser log was empty.
- Story-consequence live pass: PASS at 1280x720. The River Is on Strike showed
  both branch mechanics before commitment. Choosing the robot ferry lane built
  an interactive miniature ferry procession, updated the region HUD, journal
  and map, and exposed its exact 45% river-speed consequence through the REVIEW
  interaction. A normal non-QA reload reconstructed the same memory. The first
  pass exposed one post-choice enemy hit; memory sites joined the activity
  sanctuary and the exact path was retested for more than five seconds at 100
  health. The final browser log was empty.
- World-event stewardship pass: PASS at 1280x720. Repeated screenshots from the
  same central-meadow camera showed omen stages 1, 3 and 4 at 8%, 52% and 88%:
  violet structures grew from a subtle distant needle to an intrusive world
  presence while daylight and fog shifted continuously.
- Persistent-loss live pass: PASS. Ruin stage 3 rendered the rally beacon,
  central rubble and violet damage at 62% overrun. A normal non-QA reload kept
  the damaged world at 63% and preserved Sprig-0's resistance damage at 48/58.
  The old village-team retry was absent.
- Bonded-resistance live pass: PASS. The result prompt named 5/5 living bonded
  robots; rallying spawned those five colored miniatures, disabled the beacon
  during combat and displayed `player attacks deal zero direct damage` plus
  visitor integrity and surviving-robot count. The robots reduced the staged
  visitor from 95% to 5%, won, and returned to a playable won world with ruin
  scars retained. No sub-frame animation timing was inferred from screenshots.
- Comedy-combat and village-life live pass: PASS at 1280x720. Repeated combat
  samples showed a flying paperwork form, open-mic heckling, a purple mood
  puddle, the fleeing tax goose and species-specific defeat aftermath including
  the mood-cloud rainbow. A bounded goose restitution route began at 2 bolts,
  defeated the goose and visibly returned the HUD to 4 with `REFUND WITH
  FEATHERS!`. Kettlewick displayed Human, Toon and robot residents together;
  Auntie Whistle's explicit favor changed from HELP to CHECK ON, paid one
  Sunberry and survived an ordinary reload. The 22:00 route visibly dimmed the
  world, lit the street lamps and brought residents home under `OFF DUTY` status.
  Animation claims use separated visual samples, not sub-frame timing.
- Rival cook-off live pass: PASS at 1280x720. The Sizzlebank menu named Mayor
  Marmalade, showed the exact score to beat and explained that the three lessons
  are finite permanent upgrades. Separate Chop, Stir and Plate states displayed
  different instructions, track treatments and live player/rival scores. The
  observed run resolved 53–48, activated Pet Whisper for 45 world minutes and
  awarded the permanent 8%-wider Chop lesson. After an ordinary non-QA reload,
  the HUD retained the meal, the menu advanced to The Wok Goblin, and the saved
  lesson plus recipe personal best 53 remained visible. Timing quality is based
  on bounded inputs and separated frames; no sub-frame cadence is claimed.
- Authored-adventure live pass: PASS with bounded coverage at 1280x720. The
  passport hearing progressed through five visible forms and opened its
  permanent choice. The Heckle Encore placed six crabs on a purple-lit stage,
  stated that offstage hits do not count, completed 6/6 and opened its choice.
  The identity chase's first live pass exposed an unreadably fast orbit; after
  fixing its loop cadence and adding a visible mechanical-breath pause, the
  final retest showed six readable laps over the comparable observation and
  immediately registered 1/4 with the final fairness tuning. Full 4/4 completion
  on that exact final tuning is not claimed; its completion contract and save
  path are covered by deterministic tests.
- Story cook gate live pass: PASS in both directions. Deliberate 0-48 and 45-48
  Gossip Chowder losses left The River Is on Strike at its cook-off stage. A
  bounded 70-48 win displayed `COOK-OFF WON`, advanced immediately, and opened
  the permanent river choice. The final browser warning/error log was empty.
- Village-memory aftermath live pass: PASS at 1280x720. The first observation
  exposed Nib-7 intersecting a Kettlewick roof; all four witness stations received
  an obstacle-aware spacing pass before acceptance. The corrected Nib-7 stood on
  open ground beside the Citizen Cafe memory with an explicit HEAR report action.
  Hearing the report displayed its outcome-specific dialogue, advanced the
  visible challenge to 1/4 and changed the action to REVISIT. An ordinary reload
  preserved REVISIT; the map removed Nib-7's heard marker while retaining named
  markers for Dock-3, Chime-2 and Lux-11. The challenge panel named all four towns,
  exact action, count, marker type and 24th-Hour reward. A bounded finale route
  then deployed ten village robots and explicitly reported that all four named
  witnesses carried their adventure choices into that team. Final browser logs
  contained zero warnings and zero errors. Repeated screenshots were used; no
  sub-frame motion timing is claimed.
- Cross-town encounter-recovery live pass: PASS at 1280x720. An actual hostile
  passport form defeated the 7-HP hero, removed the five encounter actors and
  produced the saved `DECLARED LEGALLY FLATTENED` result with Chime-2 physically
  beside the respawn. An ordinary reload retained `ASK CHIME-2 FOR FREE
  CROSS-TOWN HELP`. Accepting cost no bolts and visibly granted Applause Delay;
  the retry began at 1/5 and identified the assist as free until victory. A
  second real assisted loss retained the assist. The first pass exposed a QA
  restaging marker bug, ambient-enemy interference and an enemy-projectile
  cleanup race; all three were corrected and the complete bounded path was
  rerun on a fresh tab with an empty browser log. Repeated screenshots were
  used; no sub-frame timing is claimed.
- Equipment-contradiction live pass: PASS at 1280x720. The Civic Contradiction
  Bench stood on open Boltborough ground as a golden gear platform with
  Arbiter-0 and four colored call-in terminals. Its action explicitly offered
  free permanent gear arguments. The first modal observation exposed inherited
  QA report state as an unclear `4 / 2`; the bounded route was versioned and
  restaged to exactly two reports, and the copy now states `REPORTS HEARD: 2 ·
  REQUIRED: 2`. The modal named Dock-3, Nib-7, Chime-2 and Lux-11 and explained
  all four consequences plus the absence of bolts, consumables, timers and
  reward penalties. Applying Chime-2's Heckler Overclock changed Springpan
  Supreme from base power 8 to effective power 10 and visibly wired both its
  active mechanic and drawback twice while the HUD stayed at 20 bolts. An
  ordinary reload restored that exact argument and effective power. The map
  retained a visible `FREE GEAR COUNCIL` marker, and the final browser log was
  exactly empty. Repeated screenshots were used; no sub-frame timing is claimed.
- Origin-echo live pass: PASS at 1280x720. A rare Hat of Too Many Committees
  recorded Hostile Paperwork, Kettlewick and Emergency Passport Hearing
  provenance; its inventory card named Nib-7's gold Duplicate Stamp Garden
  return marker, zero cost and zero item consumption. The physical open-ground
  installation changed from `SETTLE` to `REVISIT`, kept the visible bolt count at
  20, and stated the permanent 25%-slower hostile-form rule. Manual salvage paid
  the advertised 7 bolts, removed the item, and left the world installation
  active. Continuing through the ordinary canonical `/games/014/` route retained
  the empty inventory, 27 bolts and `persistent world change · no item required`.
  Browser warnings and errors were exactly empty. Separated screenshots prove
  visible states; the unavailable rolling-frame hand leaves sub-frame cadence
  explicitly unclaimed.

- Forecast-adventure live pass: PASS at 1280x720. Tomorrow's Weather Is Missing
  placed six Mood Clouds as exactly two inside each of three visible circles.
  The corrected replay advanced 0/6, 2/6, 4/6 and 6/6 while lighting one circle
  at a time. The first replay exposed same-attack progression spillover; a
  0.45-second transition gate now prevents an area attack from cascading into a
  newly active circle, and a full replay proved the correction. The permanent
  choice explicitly offered either 1.1-second public puddle warnings or
  10-second rainbow shelters without currency, consumables, reward penalties or
  hidden correctness. Choosing the warning lattice produced a visible gold ring
  before a later damp state; canonical reload retained `MEMORY: WARNINGS ON`.
  Raincheck-4 carries the resulting report into Wobblewoods and the five-report
  challenge now derives completion from its current 5-report amount. Browser
  warnings and errors were exactly empty. Separated screenshots prove visible
  states; the exact 1.1-second duration is deterministic evidence, not a
  screenshot-timing claim.

- Cartoon-attack-language live pass: PASS at 1280x720. The Human Panzer produced
  a gold pan-slam arc, the Human Pun-Slinger produced a teal recoil/fan pose with
  seven bread projectiles, and the Human Gear Shepherd produced a violet
  conductor command sweep. Local Toon P2 was moved clear of P1; slash input put
  only P2 into an impact pose and both actors later reported `settled`. With
  Reduced motion checked, attack reported `reduced-cue`, retained the base hero
  stance and displayed a compact gold cue before settling. Browser warning and
  error logs were exactly empty. Exact phase ordering and durations are covered
  by the pure deterministic motion test, not inferred from screenshots.

- Co-op-camera-covenant live pass: PASS at 1280x720. The initial shipping camera
  was first driven to roughly 50m separation: both heroes remained technically
  visible only through an extreme pullback, became very small and received no
  regroup explanation. The corrected focused route then showed `TOGETHER · 8m`
  with ordinary framing and no tether, `SHARED VIEW WIDENING · 27m` with both
  heroes readable and a gold ground tether, and `REGROUP · OUTWARD EDGE HELD ·
  34m` with a coral HUD/tether warning. In direct runtime state, 320 outward key
  presses converged at 35.99m with movement scale 0.001 and camera height 34.48;
  eight inward presses immediately reduced separation by 2.11m and restored
  scale 1.000. The canonical solo route hid the P2 card and exposed no co-op
  camera dataset. Browser warnings and errors were exactly empty. Separated
  screenshots prove visible states; no sub-frame movement timing is claimed.

- Origin-reclamation-parade live pass: PASS at 1280x720. The two-origin route
  showed one centered moving cart with two authored exhibits and an explicit
  `2 PUBLIC MEMORIES` safe-route prompt. Arbiter-0 named Nib-7, Chime-2, both
  installations and both regions; the toast explicitly said no reward, no
  repeat chore and no currency, while bolts remained 20. The five-origin route
  grew the same cart to five visible colored exhibits with zero inventory cards
  and named Moss Boss, Lux-11 and Dock-3 as well. The night route reported
  `parked`, count 5 and exact position `(-6.000, 30.000)` under stronger light.
  A query-free canonical reload restored that same five-memory parked state with
  empty inventory. The map showed one `MOVING MUSEUM` current-route marker.
  Browser warning and error logs were exactly empty. Separated screenshots prove
  visible day/night and growth states; route cadence is deterministic evidence,
  not a screenshot-timing claim.

- Licensed Human production-rig live pass: PASS at 1280x720. The focused route
  rendered the Quaternius Human and directly reported `production`,
  `human-casual-a`, `CC0-1.0`, 31 bones and `idle`. One bounded W input reported
  `walk`. Pan Slap reported `slash` and `attack:slash` while the visible Human
  entered the authored strike with the existing class pan/cue; a separated
  later state returned to `idle`. With the visible Reduced motion preference
  enabled, Pan Slap reported `reduced-static` and kept the gold action cue; the
  setting was restored. The deterministic no-request failure route reported
  `fallback`, `procedural`, `original-code` and
  `qa-forced-safe-fallback`, visibly retained the original Human and completed
  Pan Slap. Browser warning/error logs were empty, browser tabs were finalized
  and port 8814 was clean. Clip roles and settlement are direct state and
  deterministic evidence; no sub-frame cadence is inferred from screenshots.

The forced finale was run through a localhost-only `?testFinale=1` route. That
route shortens only the verification boss health; normal play retains the full
600-health finale and the genuine 24 saved-hour threshold.

The stewardship routes `?testSteward=pond`, `?testSteward=cook`,
`?testSteward=pet`, `?testSteward=gear`, `?testSteward=companions` and
`?testSteward=duck` only stage local, deterministic observation positions,
ingredients, equipment or pet state. The cook route also clears only its local
rival ladder so a first-win lesson can be observed repeatably. `?testSteward=story` stages The River Is
on Strike at its final decision so both persistent outcomes can be inspected.
`?testSteward=combat`, `combat-refund`, `village` and `village-night` stage the
five ordinary combat mechanics, tax-goose restitution and town schedules.
`?testSteward=omen-early`, `omen-mid`, `omen-late` and `ruin` stage saved clock
and destruction states for repeatable visual comparison; only the ruin route
shortens the resistance visitor's health.
`?testSteward=encounter-lunch`, `encounter-shadow`, `encounter-brain`,
`encounter-forecast` and `encounter-river` isolate the corresponding story
chapter for bounded live
verification. The fight routes make the staged hero invulnerable and remove
unrelated actors; they do not change the shipping encounters.
`?testSteward=forecast-rule` preserves the saved forecast choice and stages one
real Mood Cloud beside an invulnerable hero for bounded warning/shelter
observation; it does not shorten or rewrite ordinary enemy rules.
`?testSteward=aftermath` stages the five completed story outcomes while preserving
the report ledger across reloads. `?testSteward=aftermath-finale&testFinale=1`
hears all five reports and shortens only the verification visitor so the named
witness handoff can be observed without changing shipping progression.
`?testSteward=recovery-loss` isolates the passport hearing, stages low health,
removes only unrelated roaming enemies and preserves the real loss, offer and
assist ledgers across ordinary reloads. Its forms retain shipping damage and
behavior.
`?testSteward=gear-council` stages exactly two heard public reports, two kept
items, 20 bolts and an invulnerable solo Human Panzer beside the physical bench.
Its one-time version marker prevents later reloads from overwriting the selected
argument; it does not alter the shipping unlock, item rules or council costs.
`?testSteward=origin-echo` stages one rare kept item from the authored Emergency
Passport Hearing beside Nib-7's physical Kettlewick installation. Its one-time
version marker preserves settlement and later salvage through reload; it does
not alter shipping drop odds, auto-salvage rules, equipment volume or world-rule
effects.
`?testSteward=origin-parade&testOrigins=0|1|2|5&testNight=1` stages only a
bounded resolved-origin ledger, empty inventory, an invulnerable solo Human
Panzer and the ordinary world clock beside the derived parade route. It does not
grant items, modify drop odds, change shipping unlock requirements or add any
reward. Removing the query proves ordinary save continuity.
`?testSteward=attack-language&testClass=panzer|pun-slinger|gear-shepherd`
stages an invulnerable hero on open meadow ground with unrelated enemies removed.
`&testCoop=1` adds the ordinary local Toon Pun-Slinger seat. The route changes no
damage, cooldown, projectile, reward or shipping progression rule.
`?testSteward=coop-camera&testSpread=close|wide|regroup` stages the ordinary Human
Panzer and local Toon Pun-Slinger at 8m, 27m or 34m on enemy-free meadow ground.
It does not change the shipping 22m comfort, 26m soft, 31m regroup or 36m hard
distance contract, nor any combat, save, reward, economy or progression rule.
`?testSteward=production-rig&testClass=panzer|pun-slinger|gear-shepherd` stages an
invulnerable solo Human on enemy-free meadow ground and clears only the focused
route's resolved-origin ledger so the moving museum cannot obscure the rig.
`&testRigFail=1` skips the GLB request and deterministically exercises the
shipping primitive fallback. These switches alter no combat, animation timing,
asset path, progression, reward, economy or ordinary load-failure rule.
They do not weaken shipping progression, rewards or enemies.

## Concurrent-work note

Other builders changed separate game packages while this game was built. A
workspace-wide verifier encountered another builder's incomplete slot during
that moving window. Bonk & Bolt's focused verifier and tests remained clean; no
foreign files or shared registries were edited to conceal that external state.
