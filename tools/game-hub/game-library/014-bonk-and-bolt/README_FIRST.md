# Bonk & Bolt: The 24th Hour

Status: **FIRST EDITION · PLAYABLE · MIKE'S TASTE REVIEW REQUIRED**

Bonk & Bolt is a separate slot-014 game. It is a real-time full-3D open-world
comedy RPG with a high three-quarter action-brawler camera. It never modifies or
imports the code of Toonfall, Circuitseed, or another builder's game.

## Start

Double-click `START_BONK_AND_BOLT.cmd`, or run:

```powershell
node tools/game-hub/game-library/014-bonk-and-bolt/runtime/server.js
```

Open `http://127.0.0.1:8814/games/014/`.

Port 8814 is intentionally isolated from the other builders' active game
servers.

The runtime is completely local. Three.js r160 and all art are stored inside the
game package. There are no accounts, prompts, generation filters, online calls,
daily timers, advertisements, or away-progress pressure in the game.

## Controls

- Player 1: `WASD` move, mouse aim, click or `Space` attack, `Q` class special,
  `R` miniature special, `Shift` dodge, `E` interact.
- Player 2: arrow keys move, `/` attack, `,` special, `.` dodge. A standard
  gamepad can control Player 2 with left stick and the first three face buttons.
- Menus: `I` equipment, `P` miniature workshop, `J` adventures and clear
  challenges, `M` map, `Esc` pause or close.

## The game in this edition

- Two races with separate starting towns: Human in Kettlewick and Toon in
  Doodledean.
- Three classes: Panzer, Pun Slinger, and Gear Shepherd.
- Human heroes now use a local Quaternius CC0 skinned GLB with 31 joints and 11
  authored clips. Idle, walk, class attack, special and dodge roles are bound by
  semantic names, the source/hash/license are recorded in `ASSET_PROVENANCE.md`,
  and the original Human automatically remains playable if the asset contract
  cannot load. Toon identity remains deliberately code-native in this rung.
- Solo or two-human same-device co-op with one shared brawler-style camera. The
  camera frames the honest player midpoint, widens only to a tested maximum and
  names `TOGETHER`, `SHARED VIEW WIDENING` or `REGROUP` in the P2 card. A visible
  ground tether appears outside the comfort band; outward movement eases and
  stops at the 36m shared-screen edge while inward and along-edge control remain.
- Six named regions across a 320 × 320 world with villages, roads, river,
  forest, fishing locations, a cook-off plaza, inhabitants, enemy ecologies,
  visible quest markers, robot work sites, and map-wide special-stone spawns.
- Five ordinary enemy species now fight like different comedy problems instead
  of palette swaps: heckling slows, flying forms, mood puddles, screw dashes and
  a tax goose that steals bolts, flees, then refunds everything when defeated.
  Every species has a readable tell and its own persistent sight-gag aftermath.
- Thirteen named Human, Toon and robot residents keep day, night and danger
  routines across all four settlements. Each carries a small, plainly stated
  town favor with one useful reward; favors save once completed, while residents
  remain present to check on afterward.
- Five independent adventure chains. Each begins like a side quest, becomes its
  own story, and ends in a permanent decision whose exact mechanic is visible
  before choosing. Every outcome builds a different interactive 3D memory in
  its region, remains named in the journal and map, and can change cooking,
  fishing, movement, enemies, companions or finale specialists. No main quest
  is labeled in the interface.
- Their middle chapters are authored comedy set pieces rather than generic kill
  errands: protect a passport hearing from five self-stamping forms, defeat six
  Hecklecrabs inside a visible spotlight, chase four identity-plate thieves
  through a looping gear garden, and clear six Mood Clouds in three visibly
  ordered forecast circles. The river adventure advances only when Gossip
  Chowder beats its named cook-off rival; a loss still makes a meal but cannot
  silently complete the story.
- Losing any authored fight saves that defeat and invites one named robot from a
  different town to offer free, optional help until victory. Chime-2 pre-files a
  hearing form, Nib-7 widens the encore spotlight, Dock-3 lengthens the
  thieves' visible rest stops, and Lux-11 slows forecast-cloud drift. Help costs no currency, has no timer or reward
  penalty, cannot stack, and survives another loss; local co-op gets one shared
  knockout rebound before the same recovery rules apply.
- After each decisive chapter, one named village robot leaves its ordinary route
  to file a public report at the relevant civic site. The report updates after
  the permanent choice, unheard versions are marked on the map, all five form an
  exact five-region challenge, and every heard witness physically carries that
  adventure memory into the village robot team at the 24th Hour.
- Every challenge states the exact action, count, and region. There are no
  secret puzzle steps or internet-dependent locations.
- Thirteen non-average equipment designs. Each found item rolls one of two
  executable branches and always exposes its live drawback. The workshop can
  retune branches with escalating bolt costs; Humans get one free Second
  Opinion per item, and one fabled branch can make future drops carry both
  effects. Drops are uncommon; auto-salvage can remove unkept oddities but
  refuses fabled gear.
- The first kept equipment from each nuisance species remembers its exact source,
  region and authored encounter. A gold map marker leads to one named robot-built
  installation whose free settlement changes that nuisance's world rule forever;
  the memory survives later salvage, while auto-salvaged finds create no false
  journey or collectible debt.
- Once two origin installations are settled, The Museum That Refused to Stay Put
  begins a slow daytime circuit around the central meadow and parks under a
  stronger lantern at night. The single cart grows to five centered,
  origin-shaped exhibits, carries one moving public safe space and remains
  revisitable through a current-route map marker. Arbiter-0 names every robot
  steward and consequence; there is no reward, repeat chore, item cost or
  currency payout.
- After any two named public robot reports, the physical Civic Contradiction
  Bench in Boltborough opens for every kept item. Dock-3, Nib-7, Chime-2 and
  Lux-11 offer four permanent-until-revisited gear arguments: original factory
  wiring, no-power/no-drawback bypass, doubled upside and drawback, or both
  branches with reduced power and a doubled drawback. Changing an argument is
  always free, consumes nothing, has no timer or reward penalty, and the bench
  remains clearly marked on the world map.
- Four interactive cook-off recipes with separate Chop, Stir and Plate rounds,
  live player-versus-rival scoring and three named comedy opponents. Each rival
  awards one permanent round-specific kitchen lesson on its first defeat, so
  the ladder ends instead of becoming an endless cooking level. Meal quality
  determines duration while every result still changes robot terms, quest
  previews, robot work speed or hybrid equipment availability; there are no
  short-hit combat potions.
- Active fishing with timing skill, useful species, pond restoration, recipes,
  and rare Golden Ducks. Released species persist as visible pond monuments,
  determine that pond's catch ecology, and produce one sustainable ingredient
  basket per world day. Golden Ducks restore a resource or gift, revive players,
  and fully rebuild every downed bonded miniature.
- Six initially neutral miniature robots with distinct wants, saved health,
  world jobs and executable specialties: gardening ingredients, ferry combat,
  equipment baking, neutral-robot command, rare-drop auditing and salvage
  rebates. One selected partner follows and fights beside the player; pets can
  be downed, enemies can temporarily hijack unbonded neutrals, and Golden Ducks
  restore bonded robots. A special stone reveals a nearby robot's terms.
  Bonding consumes one stone when one is held, both stones when exactly two are
  held, and two stones when three or more are held.
- An actual saved-world clock. Omens begin after 23 saved play-hours and unfold
  continuously across the final hour: violet structures enter the 3D world,
  daylight shifts and four named warning stages become visible before the
  unknown visitor arrives at hour 24. The player cannot damage it directly.
  Specialist village robots fight it while players expose and protect.
- A loss is a persistent playable world state, not a retry screen. The original
  village battle team stays dead, inhabited regions acquire five saved ruin
  stages and the invasion advances only during play. A meadow beacon can rally
  only the player's living bonded miniatures; their saved health and distinct
  specialties determine the almost-impossible resistance. Failed attempts can
  down those pets, Golden Ducks rebuild them, and a later robot victory records
  a real ending while leaving the world's scars visible.

## Save truth

The world saves to browser localStorage under `bonk-and-bolt-save-v1` every five
seconds and on visibility change/exit. Offline play-time does not advance the
world. The Game Hub server owns the managed launch session; real-time gameplay
and the save are browser-local in this edition.

See `KNOWN_LIMITS.md` for the honest production boundary and
`CAPABILITY_GAPS.md` for the exact tools that would lift the next quality tier.
