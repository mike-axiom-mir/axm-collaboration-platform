# HEXBOUND: Rooftops of Neverafter

Status: **playable local alpha / macro RTS vertical slice / asymmetric two-human co-op**.

Start with `START_HEXBOUND.cmd`, or run:

```powershell
node runtime/server.js
```

Then open `http://127.0.0.1:8816/games/016/`.

For two-human co-op, the Commander selects **STRONG CO-OP** and opens the rooftop. The second player opens the glowing **QUARTERMASTER** link in the battle HUD, or goes directly to `http://127.0.0.1:8816/games/016/controller.html`.

## What is playable

- skirmish against a board-aware rival that expands, stages visible formations, commits to named macro schemes, and moves whole formations through the rooftop bridge network;
- strong co-op with a Commander browser, a separate human Quartermaster war table and command deck, and an AI field ally;
- Quartermaster recruitment—including the Commander's current faction signature—a live fog-respecting war table, shared rival-scheme warnings, roof-targeted rally, pirate drops, and Wonderwork commissioning, whole-army plans, auto-scout control, casualty-Essence support, applied/rejected receipts, and token reconnect;
- eight selectable factions with strategic modifiers, one unique signature regiment, one automatic macro passive, two exclusive Grand Doctrine branches, one ordinary-district architecture kit, and one core-formation presentation kit each;
- six selectable absurd battlefields with their own named 19-roof topology, 30-38 authored bridges, deterministic timed mechanics, readable countdowns, and map-specific canvas signals;
- box selection, contextual move/attack orders, edge pan, minimap movement, and zoom;
- fast recruitment where one logical unit is a visible squad of 5-13 fighters;
- a passive, expansion-driven Glow and Scrap economy with no workers to babysit;
- claim-anchor base building with four shared macro roles, eight faction roofline treatments, four district charters, mixed-charter wonderweb bonuses, and one automatic ordinary-district conversion for every faction—including Temporal deadline deferral—with no routine siege units;
- fog of war with remembered exploration plus optional auto-scouting;
- Essence awarded from every fighter casualty, friendly or hostile;
- anywhere-explored Ghost Pirate deployment, squad restoration, and a Grand Phantom Parade;
- win and loss states from destruction of a Grand Clock.

## Six living topologies

The battlefield selector now previews the actual network before launch. Every map owns 19 named strategic roofs, its own bridge arrangement, and multiple approach loops; none can be disconnected by removing one bridge.

- **Clockface Spiral:** an hour-ring, inner shortcut chain, and Clockheart flanking routes.
- **Six-Level Switchback:** three parking decks joined by alternating ramps around tow-shift danger.
- **Banquet Spine:** a fast table runner between upper and lower plate circuits.
- **Sleeping Ribcage:** one main rail with paired upper and lower ambush ribs.
- **Department Constellation:** three floating office clusters with several skybridge transfers.
- **Escalator Atrium:** three shopping levels stitched by directional diagonal escalators.

All 114 roof names carry into rival telegraphs and the Quartermaster's fog-safe atlas. A rally receipt says `Tail Platform`, for example, rather than making the second human translate an anonymous node number.

## Bridgefront logistics

Rooftop bridges are the authoritative macro movement network rather than decoration. A move, rally, raid, Grand March, scout order, ally push, or rival scheme resolves into a stable shortest connected route across the selected map's 19-roof / 30-38-link graph. The Commander sees mint dotted paths, waypoint diamonds, destination rings, and remaining hops; formations consume those hops without per-squad babysitting.

Three battlefields change route cost as well as crossing speed: Tuesday favors active Chronogust bridges, Gargoyle Garage makes hot contested roofs expensive, and Witch Mall rewards the currently aligned escalator direction. Same-roof orders and disconnected edge cases fall back safely to direct local movement. Local engagement steering and projectiles remain permissive once formations reach combat range; there is no collision reservation or terrain navmesh.

The Quartermaster receives the selected named topology plus only friendly active route segments on the Living War Table. Bright dashed lanes and an active-lane count make a mass push readable without publishing hidden rival routes or bypassing fog.

## Rival schemes

The rival no longer pours fixed waves at one target. It reads the current board, stages a difficulty-scaled formation, marks the intended roof, and then commits. The warning is deliberately fair: serious macro counterplay should come from choosing where to mass, not from guessing which hidden script fired.

- **The Great Glow Robbery:** raids a valuable Pumpkin or Junk economy district.
- **Cut the Wonderweb:** attacks the hub of a mixed-charter network.
- **Blind the Moon:** targets Watchmoons and Impossible Housing vision districts.
- **Very Final Tuesday:** commits a direct mass attack on the Grand Clock.
- **Annex the Punchline:** claims a forward roof, stages there, then attacks the nearest player district.

Both human seats see the current name, phase, countdown, target, and counterplay. The Commander receives a large battlefield bracket; the Quartermaster gets the same bounded plan plus a red marker on the fog-safe war table when the target is an explored roof. No scheme introduces routine siege.

## Eight signature regiments

- **Clockwork Coven — Overtime Witchpack:** nearby construction runs 50% faster.
- **Boo Brigade — Audit Wraiths:** nearby casualties yield 50% more Essence.
- **Moonwake Corsairs — Deckfall Raiders:** muster from your completed district nearest the rival Clock.
- **Thorn Court — Briar Retinue:** automatically heals nearby friendly squads.
- **Graveyard Shift — Coffin Union Local 13:** reassembles once at 45% strength.
- **Tin Lantern Republic — Pocket Paladin Parade:** nearby squads march 12% faster.
- **Once-Upon-a-Mob — Plot-Twist Rioters:** damage rises as the cast gets smaller.
- **Office of Temporal Mischief — Deadline Dragoons:** meaningful move orders gain 60% speed for three seconds.

Each player starts with their signature regiment. Recruit it with `T` or the fifth Recruit card. In strong co-op, the Quartermaster's signature order automatically follows the Commander's selected faction and preserves the actual regiment name in its receipt.

## Eight faction formation hosts

The shared core roles no longer look like one generic army recolored eight ways. Eight faction kits combine with four role silhouettes for 32 deterministic battlefield variants: Clockwork cog caps and `XII` pickets, Boo file hoods and `FILE` standards, Moonwake tricorns and `MOON` pennants, Thorn crowns and `CROWN` gonfalons, Graveyard skull helms and `III` union flags, Lantern window helmets and `WIN` civic banners, Mob patch caps and ragged `!` standards, and Temporal hourglass visors with split `T+1` echoes.

Role readability remains common and immediate. Mischief Mobs press in wedges, Hexbow Choirs hold firing ranks, Broom Patrols ride loose diamonds, and Lantern Guards form compact glowing walls. These are rendering layouts on one squad-level logical unit, not individual-fighter controls or new balance objects. Signature regiments retain their existing specialized treatments.

## Grand Doctrines

Every faction now chooses one of two permanent macro constitutions with `9` or `0`. The choice immediately retrofits that faction's existing core formation, specializes future recruitment, and changes at least one empire lever such as income, building durability, fighter cap, or Essence power cost. There are no age-up chores and no hidden prerequisite tree: ratify once, then build the strategy around it.

- **Clockwork Coven:** Midnight Union / Borrowed Tomorrow.
- **Boo Brigade:** Universal Aftercare / Spectral Audit.
- **Moonwake Corsairs:** Letters of Marque / Black-Sail Logistics.
- **Thorn Court:** Hedge-Knight Tour / Open Banquet.
- **Graveyard Shift:** Closed-Casket Formation / Graveyard Collective.
- **Tin Lantern Republic:** Every Window a Fortress / Tiny Marches.
- **Once-Upon-a-Mob:** Everyone Is the Protagonist / Subplot Chorus.
- **Office of Temporal Mischief:** Preapproved Invasion / Deadline Extension.

The rival and AI field ally receive deterministic doctrine branches too. In strong co-op, either the Commander or Quartermaster can ratify the shared faction doctrine; both command decks then lock the alternate branch and synchronize the specialized formation names, sizes, costs, and Essence power prices.

## District charters

Choose one global charter plan for future claimed roofs; every new non-Clock building inherits it automatically, so expansion creates a build order without adding per-building busywork.

- **Pumpkin Night Market (`5`):** extra Glow income.
- **Junk Jamboree (`6`):** extra Scrap income.
- **Impossible Housing (`7`):** extra fighter cap and vision.
- **Volunteer Séance (`8`):** periodically musters a free Mischief Mob which inherits the current whole-army plan.

Completed allied districts within wonderweb range reward variety: each different nearby charter adds 15% to the charter effect, up to +45%. Colored sigils, rings, and mixed-charter links make the network readable on the battlefield. In strong co-op, either human can choose the plan for future roofs and both seats see the active charter.

## Faction rooflines and ordinary-district conversions

Ordinary Boroughs, Moon Moots, Watchmoons, and Bridgeheads still preserve the same four readable macro roles, but their roofs now identify the faction that built them before the player reads a label: Clockwork gears, Boo paperwork domes, Moonwake rigging, Thorn briars, Graveyard bone braces, Tin Lantern windows, Mob patchwork, and Temporal echo frames.

Clockwork Coven converts its ordinary Borough into the **Thirteenth-Hour Union Hall** (`Z`) at the unchanged 80 Glow, 75 Scrap, 4-second construction time, 560 durability, income role, and +80 cap. Every twelve seconds it rings a four-second shift change for living allied formations within 520 world units. Affected squads move x1.18 faster and recover attacks x1.16 faster; mixed nearby charters strengthen those multipliers through the existing capped wonderweb to x1.261 and x1.232. Multiple Halls refresh the best active shift instead of stacking. The Hall is formation-tempo infrastructure; the separate Shift-Bell Foundry still advances queues and construction. Rival Clockwork expansion uses Union Halls only after its Wonderwork allowance.

The Boo Brigade converts its ordinary Watchmoon into the **Spectral Census Bureau** (`C`) at the unchanged 50 Glow, 90 Scrap, 3.4-second construction time, and 390 durability. Every eleven seconds it automatically files one still-unexplored roof reachable within four bridge hops. The report briefly reveals a 185-unit frontier circle for 4.5 seconds, permanently adds those cells to remembered fog, and renders the filing path as stamped paperwork. Mixed nearby charters shorten the interval through the existing capped wonderweb. Broom Patrols remain the faster roaming scout; the Bureau adds slow, local strategic knowledge rather than global omniscience or a new command.

Moonwake Corsairs convert their ordinary Moon Moot into the **Black-Sail Anchorage** (`X`) at the normal price, construction time, and durability. A completed Anchorage automatically opens a sail lane for nearby allied formations that are already following a macro route, multiplying their movement by x1.16. Mixed nearby charters strengthen the route bonus through the existing wonderweb cap, up to x1.232, and multiple Anchorages never stack on the same formation. The lane switches off for idle, enemy, distant, unfinished, or destroyed sources. Rival Moonwake expansion uses the same conversion after its Wonderwork allowance, so forward pirate infrastructure changes real route tempo without worker chores or a new movement command.

Thorn Court goes one step further. Its ordinary Bridgehead is presented as the **Briarway Gatehouse** (`V`) at the normal Bridgehead price, construction time, and durability. Every eight seconds a completed Gatehouse repairs damaged nearby allied ordinary districts within 520 world units. Mixed nearby charters strengthen that automatic pulse up to the existing +45% wonderweb cap. It never targets Grand Clocks, Wonderworks, unfinished districts, enemies, or itself, so it rewards a spread-friendly support web without creating a worker repair chore or siege escalation. Rival Thorn expansion uses the same conversion after its Wonderwork allowance is established.

Once-Upon-a-Mob converts its ordinary Watchmoon into the **Foreground Spotlight** (`C`) at the unchanged 50 Glow, 90 Scrap, 3.4-second construction time, 390 durability, huge-vision role, and no-attack contract. Every thirteen seconds it automatically casts the nearest visible enemy formation within 520 world units as the lead role for five seconds. Nearby player and AI-allied formations deal x1.18 damage to that formation; mixed nearby charters strengthen the bonus through the capped wonderweb to x1.261. Buildings are never cast, overlapping Spotlights keep only the strongest eligible bonus, and distant formations or destroyed stages contribute nothing. Rival Mob expansion uses Spotlights only after its Plot Device Factory allowance, so the conversion coordinates local focus fire without a target-paint button, individual-unit micro, or routine siege.

Tin Lantern Republic converts its ordinary Borough into the **Every-Window Assembly** (`Z`) at the unchanged 80 Glow, 75 Scrap, four-second construction time, 560 durability, income role, and +80 cap. Every thirteen seconds, a completed Assembly that can currently see an enemy formation within 520 raises five seconds of Civic Cover for nearby player and AI-allied formations. Cover reduces incoming formation damage by 14%; mixed nearby charters strengthen the reduction through the capped wonderweb to 20.3%. Buildings are never protected, overlapping Assemblies keep only the strongest eligible reduction, and moving outside the local shelter, destroying the source, or reaching expiry removes the protection. Rival Tin uses Assemblies only after its Wonderwork allowance, adding spread-friendly formation resilience without a worker, repair command, routine siege, or protocol change.

Graveyard Shift converts its ordinary Borough into the **Last-Rites Exchange** (`Z`) at the unchanged 80 Glow, 75 Scrap, four-second construction time, 560 durability, income role, and +80 cap. Whenever a nearby formation takes casualties within 520, the strongest eligible completed Exchange pays that formation's side a Wake Dividend equal to 55% of the ordinary casualty Essence. Mixed nearby charters strengthen the dividend through the capped wonderweb to 79.75%. Buildings never qualify, overlapping Exchanges never stack, and rival Graveyard credits the same dividend to its own Essence account and can spend it through the existing 60-Essence ghost audit. The conversion makes casualties locally productive without a worker, corpse-harvest button, routine siege, or protocol change.

Office of Temporal Mischief converts its ordinary Watchmoon into the **Department of Later** (`C`) at the unchanged 50 Glow, 90 Scrap, 3.4-second construction time, 390 durability, huge-vision role, and no-attack contract. Every fourteen seconds it automatically files the nearest currently visible enemy formation within 520 for three seconds of deadline deferral: movement and attack recovery pause, but the formation keeps its route, target, and macro order for when the filing expires. Mixed nearby charters lengthen the deferral through the capped wonderweb to 4.35 seconds. Buildings, allies, dead or distant formations, and formations already filed by another office are excluded. Rival Temporal expansion remains Wonderwork-first and uses the same office afterward, adding local enemy-tempo control without a new command, individual-unit micro, worker, routine siege, or duplicate of the Office of Already Done's recruitment and power-cooldown role.

## Living War Table

The Quartermaster receives a normalized tactical atlas of all 19 named roofs and the selected map's bridge graph. Explored roofs reveal remembered ownership; only currently visible rival formations appear, and only friendly active route links are highlighted, so the second human shares real intelligence without bypassing fog of war.

- **Rally Beacon:** tap any explored roof to redirect the entire Commander army there. Newly trained and automatically mustered squads inherit that rally until another macro plan replaces it.
- **Rooftop Pirates:** select the pirate mode and tap any explored roof to spend the shared Essence and open the rift at that exact location.
- **Battlefield signals:** the Commander sees a large mint rally or violet pirate marker with the Quartermaster event in the battle feed.
- **Match-scoped receipts:** late commands are rejected when an outcome lands instead of leaking into the next battle.

## Co-op authority boundary

The Commander browser owns the battle simulation. The local Node server owns a bounded, versioned semantic-command relay (`hexbound.coop-command/v2`). The Quartermaster sends high-level and roof-targeted orders, can commission the faction Wonderwork on an explored open roof, ratify the one-time Grand Doctrine, and receives synchronized specialized recruits and Essence power costs; the Commander applies commands and returns match-scoped receipts. Fog-safe tactical intel, map-anomaly state, the active charter, and the active doctrine are published to both seats. This is genuine second-human cooperation, but it is not a second synchronized world-rendering client or an authoritative multiplayer simulation server.

## Living battlefield rules

- **Rooftops at the End of Tuesday:** Chronogust bridges accelerate crossing squads by 65%.
- **Gargoyle Parking Garage:** contested claim roofs wake stone attendants that slow and chip every nearby army.
- **The King's Very Long Dining Table:** Banquet Bells give finished Boroughs 65% more Glow and Scrap income.
- **Subway Inside a Sleeping Dragon:** Dragon Breath temporarily reveals every army through the fog.
- **Cloud Nine Budget Annex:** periodic memo windfalls pay Glow and Scrap for every finished player district.
- **Midnight Mall of the Last Witch:** eastbound and westbound escalator shifts accelerate matching bridge pushes by 55%.

Each mechanic has a calm/warning/active clock and visible battlefield treatment. They reward staging, timing, expansion, and scouting rather than adding worker chores.

## Controls

- Left click / drag: select squads.
- Right click: move or focus-attack.
- Mouse wheel: zoom. Screen edges / arrow keys: pan.
- `Q-R`: recruit core squads; `T`: recruit the faction signature; `9` / `0`: ratify a Grand Doctrine; `Z-V`: plan an ordinary building (`Z` is Thirteenth-Hour Union Hall for Clockwork, Every-Window Assembly for Tin, or Last-Rites Exchange for Graveyard; `C` is Spectral Census Bureau for Boo or Foreground Spotlight for Mob; `X` is Black-Sail Anchorage for Moonwake; `V` is Briarway Gatehouse for Thorn); `B`: plan the faction Wonderwork; `5-8`: choose the charter for future roofs; `F-H`: Essence powers.
- `1`: select the army; `2`: guard; `3`: raid; `4`: grand march.
- `A`: toggle auto-scout. `F1` or pause button: field guide.

The design deliberately treats squad loss as normal attrition. Individual fighters visibly leave formations, but the player's strategic object remains the squad.
