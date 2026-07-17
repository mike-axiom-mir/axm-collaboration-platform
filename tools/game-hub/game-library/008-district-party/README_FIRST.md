# AXM District Party — read this first

> **Installed AXM route:** Game Hub slot 008 runs this package on managed port
> 8798 at `/games/008/`. Port 8795 below remains the untouched standalone
> development route. The package is now a visible `PUBLIC TEST`; the historical
> standalone wording below describes its source harness, not its current Hub
> installation status.

**Version:** 0.1.7 local prototype  
**Build type:** **STANDALONE FOUNDATION-COMPATIBILITY HARNESS — NOT YET LAUNCHED BY THE REAL AXM GAME HUB**

AXM District Party is an original, local-first, top-down city game with two launcher formats. **Co-op Adventure** uses one Party A screen and one to four selected players. **District Dominion** uses any ready roster from 1v1 through 4v4—including unequal 2v3 or 4v1 teams—with one shared screen per party and both parties inside the same authoritative city world. Eight is capacity, not a required population.

There is no account, telemetry, advertising, cloud runtime, public server, remote AI or internet requirement during play. Phones send input intentions. The host owns movement, health, inventory, money, vehicles, projectiles, NPCs, justice, missions, scores and damage permission.

## What works

- Local launcher with 1–4 seat co-op and flexible 1–4 versus 1–4 District Dominion, named token-bound controller URLs and local QR generation.
- Original reusable Game Night twin-stick phone controls: floating left movement, independent right-stick aim, and release-to-fire with host-side input buffering.
- Persistent shared Party A and Party B receivers that occupy no seats and send no actor input.
- One shared camera and one city canvas. Gameplay is never split into four views.
- Four small corner status cards only: HP, shield, total ammo and each player's personal fund. One central total shows the party fund.
- Six equipment locations (`melee`, `ranged`, adjacent `ammo`, `shoes`, `body`, `hat`) plus 12 bag slots; auto-equip and compatible stored-ammo replacement are host-tested.
- Walkable Party House start, 100 base HP, 1 starting shield, 1 HP/s normal regeneration, 10 HP/s house regeneration and no default shield recharge.
- Mission board in the Party House. One player selects, a 10-second countdown runs, and the whole party teleports into the same mission.
- Supply Sweep, Hold the Relay, Courier Chaos and voluntary Call the Heat activities.
- Whole-party return to the house after success/failure. Results remain indefinitely as a break screen until a player deliberately chooses Continue, Replay or Mission List.
- Two host-owned balances: every actor starts with a `DC 100,00` personal fund. Co-op treasuries start at `DC 0,00`; District Dominion treasuries start at `DC 50,00`. Successful co-op mission rewards split **40% personal / 60% to that actor's party**, with Party A and Party B isolated.
- Eight civilians with deterministic 20–50 HP and no gore.
- Three visible Neon Rival roles: Rusher (10 HP/2 damage), Skirmisher (10 HP/2 damage), Blocker (20 HP/3 damage).
- Forgiving harm/recency justice heat with decay, bounded justice responders and an intentional chaos mission. It is not a kill-count/star system.
- Two enterable cars with one driver and three passengers. Passengers aim with the stick and can fire; the driver steers and can fire forward.
- Cars have 50 HP. Destruction ejects occupants and applies 80 damage; a full-health player with the default shield survives at 21 HP. Wrecks respawn after 30 seconds.
- Host-created 5-damage pulse projectiles, low hostile damage, visible hostile windups, short hit grace, safe zones and per-party friendly-fire enforcement.
- Dynamic multi-actor camera, party tether warnings, hard-range outward movement protection, AI party actors and civilian routing.
- **District Dominion · up to 4v4:** only ready seats become actors. Mirrored west/east staging posts, five capturable districts, a 300-second timer, 180-point target, one point per uncontested district per second, and persistent win/loss results work at asymmetric team sizes.
- Each competitive party begins with `DC 50,00` group funds. Press **ACTION** at your own command post to spend `DC 25,00` on two host-controlled crew NPCs; each party is capped at four active crew. Held districts generate small group-fund income.
- Empty seats stay empty by default. One explicit **Fill unused seats with Host AI** option can create substitutes, but it begins OFF.
- Foundation `adapter` seats receive no phone QR. They get a token-bound semantic control binding and a filtered observation representing only what their party screen/HUD exposes. Built-in `ai` seats remain a separate optional host state machine.
- Party A and Party B each receive a four-corner HUD for only their four seats, while the city itself remains one unsplit world. Two laptops can therefore show opposite party cameras without creating separate simulations.

See `TEST_REPORT.md` for commands actually run and `KNOWN_LIMITS.md` for explicit non-passes.

## Start on Windows

1. Keep the complete `AXM_DISTRICT_PARTY_LOCAL_v0_1` folder together.
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
6. Wait for the 10-second group countdown. The selecting player can press **ACTION** to cancel.
7. Complete or fail the activity. The party returns together to the house.
8. Leave results open for a break, or choose Continue, Replay or Mission List when ready.

Suggested first activities:

- **Supply Sweep:** collect six supplies. Gross per actor `DC 15,00` → personal `DC 6,00`, party `DC 9,00`.
- **Hold the Relay:** protect a 30-HP relay through three scaled waves. Gross `DC 25,00` → personal `DC 10,00`, party `DC 15,00` per actor.
- **Courier Chaos:** collect and deliver five packages. Gross `DC 20,00` → personal `DC 8,00`, party `DC 12,00` per actor.
- **Call the Heat:** deliberately trigger a 90-second pursuit. No cash reward.

## District Dominion multiplayer test flow

1. In the launcher, choose **District Dominion · 1–4 vs 1–4**. P1 and P5 are the only ready seats in the local fallback by default.
2. Ready only the people or connected Foundation AI actually joining. Leave unused seats unchecked. Choose Human, Host AI or Foundation adapter independently for every ready seat.
3. To deliberately test a full bot-populated match, enable **Fill unused seats with Host AI**. It is never enabled automatically.
4. Open Party A on one laptop/display and Party B on a second. For a solo test, both may be browser windows on one computer.
5. Human seats use their named controller links. Adapter seats are bound by the Foundation integration contract; built-in Host AI needs no phone.
6. Move into a glowing district circle and hold it. Equal opposing presence pauses capture; greater presence pushes the meter toward that party.
7. Uncontested owned districts add score. The first party to 180 wins; otherwise the higher score after five minutes wins.
8. At your colored west/east command post, press **ACTION** to buy a two-NPC crew squad from that party's group fund. A party with human or adapter control never auto-spends; a deliberately all-Host-AI party may hire its opening squad.
9. Cars remain enterable, carry four party members and allow passengers to aim/fire. Cross-party combat is ON; same-party damage is OFF by default.
10. Results remain visible until the host uses **Restart local session** or **End and return to lobby**.

This mode has passed sparse 1v1, asymmetric 2v3 and full eight-seat host simulations plus API smoke tests. Eight physical phones, eight people and two physical laptops remain **UNTESTED**.

## Controls

Phone/controller page:

- **Left floating stick:** move/strafe on foot; steer plus throttle/reverse while driving; move up/down through mission and results choices.
- **Right floating stick:** aim independently while on foot or riding as a passenger; release to fire. A quick tap fires along the actor's last host-owned facing.
- **Driver right stick:** release to fire the car driver's sidearm forward; vehicle steering always remains on the left stick.
- **ACTION:** mission-board choose/cancel, collect/deliver, enter/exit a car, or hire a crew at your competitive command post.
- **FIRE:** forward-fire accessibility fallback; passengers may shoot.
- **DASH:** sprint or accelerate.
- **BRAKE:** brake/reverse.
- **INVENTORY:** open only that player's quarter overlay.
- **PREV/NEXT/USE:** navigate and equip/unequip host-owned inventory entries.

The sticks start wherever each thumb lands, capture separate touch pointers, use a 14% anti-drift dead zone and send intentions at 20 Hz. The host still owns cooldowns, ammunition, projectiles, hits and damage. See `docs/CONTROLLER_SYSTEM.md` and `data/controller-profile.json` for the reusable contract.

Keyboard on a controller page: WASD moves, arrows aim, Space fires, `E` acts, Shift dashes/accelerates, Ctrl brakes, `I` opens inventory, `[`/`]` navigate and Enter equips. Press `D` on the shared screen only to toggle the read-only debug overlay.

## Shared screen and inventory

The city is always one shared view. Only the compact statistics use corners:

- P1 top-left; P2 top-right; P3 bottom-left; P4 bottom-right.
- HP/shield, loaded/total ammo and personal funds appear in each card; the central mission HUD shows the requested party treasury.
- An open inventory temporarily occupies only its owner's quarter; it does not create an independent gameplay viewport.
- Party B seats 5–8 reuse the four relative corners on the active Party B screen in District Dominion; `party=all` stacks both parties by relative corner.

The built-in provisional pulse sidearm displays **∞** because real weapons/ammo items are intentionally deferred. Synthetic inventory tests prove finite ammo use and automatic loading from the 12-slot bag.

## Health, combat and vehicles

- Players start at 100/100 HP and 1/1 shield.
- Free HP regeneration always stops at 100, even if later equipment raises maximum HP.
- Shield does not regenerate by default.
- Player pulse: 5 damage, host-created projectile.
- Party A and Party B friendly fire default OFF; cross-party damage defaults ON; self-damage defaults OFF.
- Ally car damage defaults blocked. Vehicle-impact damage remains disabled.
- Cars: 50 HP, four occupants, 80 explosion damage, 30-second host respawn.

Change party-friendly-fire settings in the launcher before starting. The host centrally enforces them; a phone cannot assert a hit or bypass a party rule.

## Stop, restart and privacy

- **Restart local session at base** creates a fresh in-memory world.
- **End and return to lobby** returns the persistent party screen to waiting.
- Press `Ctrl+C` in the host terminal to stop.
- Windows also includes `STOP_LOCAL_CITY.bat`; Linux/macOS includes `STOP_LOCAL_CITY.sh`.

All session state, personal funds, party treasuries and inventories are memory-only and disappear when the host process stops. No profile or rival-campaign save is written yet.

## Source boundary

PR 13 of `mike-axiom-mir/axm-collaboration-platform` was inspected read-only at commit `33a87549259d8b4a7ce4753ee1fab49e0ee8091d`. This project is a separate non-Git directory. No branch, commit, push or PR change was performed.

The map is structured JSON, not Tiled-authored. Runtime art is curated from Kenney's CC0 RPG Urban Pack. Official archives, included licenses, exact paths, transforms and hashes remain in the package.

Automated browser rendering is **UNRUN** because Playwright's Chromium executable is absent. Physical phone QR join, four/eight simultaneous phones, two physical displays, Windows execution and private-LAN reachability are **UNTESTED** here.
