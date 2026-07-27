# AXM District Party — read this first

> **Installed AXM route:** Game Hub slot 008 runs this v0.2.7 package on
> managed port 8798 at `/games/008/`. The Hub supplies the selected seat map,
> runtime activity sensing, and a 30-minute no-input shutdown. The historical
> standalone wording below describes the source package, not the installed
> Hub boundary.

> **Integration repair:** the installed copy includes a narrowly scoped
> Windows shutdown route so deliberate lifecycle tests remove their PID marker
> instead of leaving a false "still running" file after browser keep-alive use.

**Version:** 0.2.7 curated interactable-asset pass  
**Build type:** **STANDALONE FOUNDATION-COMPATIBILITY HARNESS — NOT YET LAUNCHED BY THE REAL AXM GAME HUB**

**Important local-version note:** this portable update was implemented over the validated v0.2.6 asset-pass package preserved in this workspace. Mike reported that Local Codex has additional laptop bug fixes. Do not replace that newer local project blindly. Use `docs/INTERACTABLE_ASSET_PORT_GUIDE.md`, `docs/INTERACTABLE_ASSET_PORT_FILES.txt` and the focused v0.2.7 port kit to merge this layer into the latest local build.

AXM District Party is an original, local-first, top-down city game with two launcher formats. **Co-op Adventure** uses one Party A screen and one to four selected players. **District Dominion** uses any ready roster from 1v1 through 4v4—including unequal 2v3 or 4v1 teams—with one shared screen per party and both parties inside the same authoritative city world. Eight is capacity, not a required population.

There is no account, telemetry, advertising, cloud runtime, public server, remote AI or internet requirement during play. Phones send input intentions. The host owns movement, health, inventory, money, vehicles, projectiles, NPCs, justice, missions, scores and damage permission.

## What works

- Local launcher with 1–4 seat co-op and flexible 1–4 versus 1–4 District Dominion, named token-bound controller URLs and local QR generation.
- Original reusable Game Night twin-stick phone controls: floating left movement, independent right-stick aim, and release-to-fire with host-side input buffering.
- Persistent shared Party A and Party B receivers that occupy no seats and send no actor input.
- One shared camera and one city canvas. Gameplay is never split into four views.
- Tilburg city foundation measuring 12,288 × 8,192 pixels—96 times the old ground area—with 96 camera-local chunks. The host keeps one complete world while each party screen loads only nearby geometry.
- Cached procedural chunk art: ground texture, tiled pavement, road edges and markings, water waves, rail sleepers, varied roof masses and bounded park dressing.
- Sixteen curated user-supplied runtime images: four playable AXM identities, four stable civilian identities, a red sports presentation, a silver sedan, two clearly labelled non-interactive shopkeeper previews, and four Tilburg-style landmark overlays backed by existing host collision. Legacy Kenney actors/vehicles remain local fallbacks.
- Fourteen newly curated interactable-art candidates: five stable package variants plus a safe, vending machine, ATM, barrel, pallet, dumpster, bench, bollard and trash can. Courier/Supply package appearance is deterministically derived from the authoritative package ID; pickup, ownership, AI, delivery and scoring rules are unchanged.
- Twenty-eight new city placements dress the centre, Party House, Courier Yard, Piushaven, Reeshof, Spoorzone, Wandelbos and Moerenburg. Twenty-five are explicitly visual-only. The ATM, vending machine and Party House safe are labelled **RESERVED** because their transactions/storage mechanics are not implemented.
- Eight original landmark ground motifs, thirteen co-op district seals and eight crosswalk/wayfinder details provide readable local identity without changing collision.
- A persistent compact minimap with schematic arterial, waterway, chunk, landmark, mission, venue, territory, camera and party context. Press the visible **FULL MAP** button or `M` to expand it; `Escape` closes the full map. Press `D` for chunk/cache and simulation diagnostics.
- Four small corner status cards only: HP, shield, total ammo and each player's personal fund. One central total shows the party fund.
- Six equipment locations (`melee`, `ranged`, adjacent `ammo`, `shoes`, `body`, `hat`) plus 12 bag slots; auto-equip and compatible stored-ammo replacement are host-tested.
- Walkable Party House start, 100 base HP, 1 starting shield, 1 HP/s normal regeneration, 10 HP/s house regeneration and no default shield recharge.
- A visible Party House **GROUP SAVE COMPUTER** with nine local slots. Each occupied slot locks its original seat count and exact seat slots. Connected human/Foundation-adapter seats retain control when loading; missing saved seats become the existing built-in Host AI only for that restored run.
- Group saves keep each seat's money and inventory/equipment/ammo plus shared funds and rival progress. They intentionally omit player names, profiles, controller tokens, location, injury and transient mission/combat state. Loading always returns the restored roster safely to the Party House.
- Two additional empty, enterable city-centre shells: one compact unit and one large future-venue hall. Both have real floors, doorways and host collision; no casino or activity logic has been installed yet.
- Mission board in the Party House. One player selects, a 10-second countdown runs, and the whole party teleports into the same mission.
- Supply Sweep, Hold the Relay, Courier Chaos and voluntary Call the Heat activities, each with four data-driven Tilburg locations. A host-owned shuffled route deck uses every location before reshuffling and prevents immediate repeats.
- Route-specific play: Supply Sweep changes crate geometry and may add up to two low-damage lookouts; Relay changes enemy approaches; Courier changes dispatch and active drop zones; Call the Heat changes surrounding escape geometry.
- Active dispatch/drop zones and the selected location appear on the shared HUD, main canvas, minimap and full map. Inactive courier drops are rejected by the authoritative host.
- Whole-party return to the house after success/failure. Results remain indefinitely as a break screen until a player deliberately chooses Continue, Replay or Mission List.
- Two host-owned balances: every actor starts with a `DC 100,00` personal fund. Co-op treasuries start at `DC 0,00`; District Dominion treasuries start at `DC 50,00`. Successful co-op mission rewards split **40% personal / 60% to that actor's party**, with Party A and Party B isolated.
- Twenty-four mapped civilian spawn records across twelve routes; sessions deliberately activate a bounded subset, with deterministic 20–50 HP and no gore.
- Three visible Neon Rival roles: Rusher (10 HP/2 damage), Skirmisher (10 HP/2 damage), Blocker (20 HP/3 damage).
- Forgiving harm/recency justice heat with decay, bounded justice responders and an intentional chaos mission. It is not a kill-count/star system.
- Eight co-op vehicle spawns and six competitive vehicle spawns. Each car has one driver and three passengers; passengers aim with the stick and can fire while the driver steers and can fire forward.
- Cars have 50 HP. Destruction ejects occupants and applies 80 damage; a full-health player with the default shield survives at 21 HP. Wrecks respawn after 30 seconds.
- Host-created 5-damage pulse projectiles, low hostile damage, visible hostile windups, short hit grace, safe zones and per-party friendly-fire enforcement.
- Dynamic multi-actor camera, party tether warnings, hard-range outward movement protection, AI party actors and civilian routing.
- **District Dominion · up to 4v4:** only ready seats become actors. Mirrored west/east staging posts, thirteen capturable districts, a 600-second timer, 360-point target, one point per uncontested district per second, and persistent win/loss results work at asymmetric team sizes.
- Each competitive party begins with `DC 50,00` group funds. Press **ACTION** at your own command post to spend `DC 25,00` on two host-controlled crew NPCs; each party is capped at four active crew. Held districts generate small group-fund income.
- Empty seats stay empty by default. One explicit **Fill unused seats with Host AI** option can create substitutes, but it begins OFF.
- Foundation `adapter` seats receive no phone QR. They get a token-bound semantic control binding and a filtered observation representing only what their party screen/HUD exposes. Built-in `ai` seats remain a separate optional host state machine.
- Party A and Party B each receive a four-corner HUD for only their four seats, while the city itself remains one unsplit world. Two laptops can therefore show opposite party cameras without creating separate simulations.

See `TEST_REPORT.md` for commands actually run and `KNOWN_LIMITS.md` for explicit non-passes.

## Start on Windows

1. Keep the complete `AXM_DISTRICT_PARTY_TILBURG_LOCAL_v0_2_7_INTERACTABLE_PASS` folder together.
2. Install Node.js 20 or newer if `node --version` does not work.
3. Double-click `START_LOCAL_CITY.bat`.
4. If Windows Firewall asks, allow Node on **Private networks only**. Do not enable Public networks.
5. Open `http://127.0.0.1:8795/` if the launcher does not open automatically.
6. Keep the command window open while playing.

The packaged runtime already includes its small local dependency. No public tunnel and no runtime download are required.

## Start on Linux or macOS

From the project directory:

```sh
./START_LOCAL_CITY.sh
```

Then open `http://127.0.0.1:8795/`.

## Shared screen and phones

Party A persistent receiver:

`http://127.0.0.1:8795/party-screen.html?party=party_a`

Party B persistent receiver:

`http://127.0.0.1:8795/party-screen.html?party=party_b`

Start a session in the launcher, then use each named human card. A phone-ready QR is shown only when the host detects a private IPv4 address. All phones and the display must be on the same trusted private Wi-Fi/LAN. `127.0.0.1` works only on the host computer.

Built-in Host AI and Foundation adapter seats receive no fake phone QR. The join board labels them separately so a connected platform AI is never presented as a host substitute.

## First test flow

1. Start a four-seat session and open the Party A screen.
2. On each phone, move the left thumb in a circle, then strafe with the left stick while aiming elsewhere with the right stick.
3. Release and tap the right stick to test firing; confirm one phone never moves or fires another player's actor.
4. Move to the purple **MISSION BOARD** inside the Party House and press **ACTION**.
5. Use left-stick up/down to choose a mission, then press **ACTION**.
6. Read the selected location and twist during the 10-second countdown. The selecting player can press **ACTION** to cancel.
7. Complete or fail the activity. The party returns together to the house.
8. Leave results open for a break; choose Replay to draw a different location, or Continue/Mission List when ready.
9. Back at the Party House, walk to the cyan **GROUP SAVE** computer and press **ACTION**. Use up/down for slots 1–9, left for Save, right for Load, and press **ACTION** twice to confirm. **INVENTORY** closes the computer.

Suggested first activities:

- **Supply Sweep:** collect six supplies. Gross per actor `DC 15,00` → personal `DC 6,00`, party `DC 9,00`.
- **Hold the Relay:** protect a 30-HP relay through three scaled waves. Gross `DC 25,00` → personal `DC 10,00`, party `DC 15,00` per actor.
- **Courier Chaos:** collect and deliver eight packages across the larger city. Gross `DC 20,00` → personal `DC 8,00`, party `DC 12,00` per actor.
- **Call the Heat:** deliberately trigger a 90-second pursuit. No cash reward.

## Mission replayability

- Each of the four activities currently has four Tilburg layouts: 16 playable setups in total.
- The local host shuffles one route deck per activity, uses every layout before reshuffling and prevents an immediate repeat between decks.
- Replay keeps the existing untimed results break, then draws the next location during a fresh ten-second countdown.
- The shared screen names the location and its honest twist. Courier routes replace static depot/drop map markers with only that run's active dispatch and drops.
- All eight actor positions, packages, relay anchors and mission rivals are checked against host collision and moved only to a bounded nearby safe point when necessary.
- This changes setup and route choice, not hidden difficulty. See `docs/MISSION_REPLAYABILITY.md` for the data contract and exact limits.

## District Dominion multiplayer test flow

1. In the launcher, choose **District Dominion · 1–4 vs 1–4**. P1 and P5 are the only ready seats in the local fallback by default.
2. Ready only the people or connected Foundation AI actually joining. Leave unused seats unchecked. Choose Human, Host AI or Foundation adapter independently for every ready seat.
3. To deliberately test a full bot-populated match, enable **Fill unused seats with Host AI**. It is never enabled automatically.
4. Open Party A on one laptop/display and Party B on a second. For a solo test, both may be browser windows on one computer.
5. Human seats use their named controller links. Adapter seats are bound by the Foundation integration contract; built-in Host AI needs no phone.
6. Move into a glowing district circle and hold it. Equal opposing presence pauses capture; greater presence pushes the meter toward that party.
7. Uncontested owned districts add score. The first party to 360 wins; otherwise the higher score after ten minutes wins.
8. At your colored west/east command post, press **ACTION** to buy a two-NPC crew squad from that party's group fund. A party with human or adapter control never auto-spends; a deliberately all-Host-AI party may hire its opening squad.
9. Cars remain enterable, carry four party members and allow passengers to aim/fire. Cross-party combat is ON; same-party damage is OFF by default.
10. Results remain visible until the host uses **Restart local session** or **End and return to lobby**.

This mode has passed sparse 1v1, asymmetric 2v3 and full eight-seat host simulations plus API smoke tests. Eight physical phones, eight people and two physical laptops remain **UNTESTED**.

## Controls

Phone/controller page:

- **Left floating stick:** move/strafe on foot; steer plus throttle/reverse while driving; move up/down through mission and results choices.
- **Right floating stick:** aim independently while on foot or riding as a passenger; release to fire. A quick tap fires along the actor's last host-owned facing.
- **Driver right stick:** release to fire the car driver's sidearm forward; vehicle steering always remains on the left stick.
- **ACTION:** mission-board choose/cancel, collect/deliver, enter/exit a car, operate the Party House save computer, or hire a crew at your competitive command post.
- **FIRE:** forward-fire accessibility fallback; passengers may shoot.
- **DASH:** sprint or accelerate.
- **BRAKE:** brake/reverse.
- **INVENTORY:** open only that player's quarter overlay; while controlling the group-save computer it acts as Close/Back.
- **PREV/NEXT/USE:** navigate and equip/unequip host-owned inventory entries.

The sticks start wherever each thumb lands, capture separate touch pointers, use a 14% anti-drift dead zone and send intentions at 20 Hz. The host still owns cooldowns, ammunition, projectiles, hits and damage. See `docs/CONTROLLER_SYSTEM.md` and `data/controller-profile.json` for the reusable contract.

Keyboard on a controller page: WASD moves, arrows aim, Space fires, `E` acts, Shift dashes/accelerates, Ctrl brakes, `I` opens inventory, `[`/`]` navigate and Enter equips. On the shared screen, `D` toggles the read-only debug overlay; `M` or the visible button opens/closes the full city map, and `Escape` returns to the minimap.

## Shared screen and inventory

The city is always one shared view. Only the compact statistics use corners:

- P1 top-left; P2 top-right; P3 bottom-left; P4 bottom-right.
- HP/shield, loaded/total ammo and personal funds appear in each card; the central mission HUD shows the requested party treasury.
- An open inventory temporarily occupies only its owner's quarter; it does not create an independent gameplay viewport.
- Party B seats 5–8 reuse the four relative corners on the active Party B screen in District Dominion; `party=all` stacks both parties by relative corner.

The built-in provisional pulse sidearm displays **∞** because real weapons/ammo items are intentionally deferred. Synthetic inventory tests prove finite ammo use and automatic loading from the 12-slot bag.

## Minimap and full city map

- The minimap remains visible during ordinary play and follows the authoritative shared camera with a white viewport box.
- The full map shows district names, Party House, the group-save computer, empty venue shells, mission locations, territory ownership, vehicles and living members of the displayed party.
- Party A and Party B actor markers remain party-scoped. The map does not reveal hidden off-screen opponents or host AI intentions.
- Opening the map does not pause the multiplayer world and does not fetch all 96 gameplay chunks.
- Waypoints, route planning, named streets and shop markers remain deferred. See `docs/CITY_MAP_UI.md`.

## Health, combat and vehicles

- Players start at 100/100 HP and 1/1 shield.
- Free HP regeneration always stops at 100, even if later equipment raises maximum HP.
- Shield does not regenerate by default.
- Player pulse: 5 damage, host-created projectile.
- Party A and Party B friendly fire default OFF; cross-party damage defaults ON; self-damage defaults OFF.
- Ally car damage defaults blocked. Vehicle-impact damage remains disabled.
- Cars: 50 HP, four occupants, 80 explosion damage, 30-second host respawn.

Change party-friendly-fire settings in the launcher before starting. The host centrally enforces them; a phone cannot assert a hit or bypass a party rule.

## Nine fixed-roster group saves

- Saves are slot-based group progress, not user profiles. There are exactly nine slots for now.
- A new save records the current authoritative actor roster. A four-seat save always remains a four-seat save; overwrite from a different roster is rejected. Use another empty slot for another group size.
- Before loading, connect every human or Foundation adapter intended for that run. Any saved seat without a currently connected external controller becomes **Group AI** and receives no phone QR or controller token.
- A connected seat outside the selected save's original roster blocks loading instead of silently dropping that player.
- The party screen opens one shared computer overlay; it does not split the city into player screens. The authoritative city pauses while the computer is open.
- Every Save or Load requires two ACTION presses. Empty/corrupt loads are rejected. Corrupt files may be repaired by saving over that slot with a valid matching/new roster.
- Files live under `local-data/group-saves/`. The host uses nine fixed filenames, a 256 KiB limit, validation, a SHA-256 integrity envelope and an atomic local write.
- Save files contain no display names, accounts, passwords, phone addresses, host/seat tokens or telemetry.

See `docs/GROUP_SAVES.md` for the exact rules and `data/group-save-schema.json` for the machine-readable shape.

## Stop, restart and privacy

- **Restart local session at base** creates a fresh in-memory world.
- **End and return to lobby** returns the persistent party screen to waiting.
- Press `Ctrl+C` in the host terminal to stop.
- Windows also includes `STOP_LOCAL_CITY.bat`; Linux/macOS includes `STOP_LOCAL_CITY.sh`.

Ordinary live positions, health, shield, vehicles, projectiles, mission timers and controller associations remain session-only. Personal funds, inventories/equipment/ammo, party funds and rival progress persist only after a player deliberately uses the Party House group-save computer. There are no profiles, accounts or automatic cloud writes.

## Source boundary

PR 13 of `mike-axiom-mir/axm-collaboration-platform` was inspected read-only at commit `33a87549259d8b4a7ce4753ee1fab49e0ee8091d`. This project is a separate non-Git directory. No branch, commit, push or PR change was performed.

The map is generated chunked JSON, not Tiled-authored. Its ground placement is derived from the official PDOK BGT OGC API under CC0 and then stylized onto the game grid; it is not a navigation map. No Google map tiles or labels were copied. Kenney's CC0 RPG Urban Pack remains the licensed fallback/small-prop family. v0.2.6 contains the first user-supplied AI-assisted AXM/Tilburg batch; v0.2.7 preserves the complete 158-PNG interactable alpha archive but loads only 14 inspected candidates. Neither user batch is labelled CC0. The interactable pack currently uses the working `AXM-RESPONSIBLE-USE-ASSET-DRAFT-0.1`, which is **NOT LEGALLY REVIEWED** and is not an open-source license. See `ASSET_PROVENANCE.md`, `assets/USER_GENERATED_ASSET_MANIFEST.json` and `assets/INTERACTABLE_ASSET_MANIFEST.json`.

Eleven PNGs in `docs/previews/` were generated from and visually checked against the actual Canvas renderer: nine city/art views plus compact and full map UI views. The new Courier Yard preview exercises real package selection, carried-package art and city props. Eight retained QA contact sheets cover the original and interactable-art intake. Automated browser rendering remains **UNRUN** unless `TEST_REPORT.md` records otherwise. Physical phone QR join, four/eight simultaneous phones, two physical displays, Windows execution and private-LAN reachability are **UNTESTED** here.
