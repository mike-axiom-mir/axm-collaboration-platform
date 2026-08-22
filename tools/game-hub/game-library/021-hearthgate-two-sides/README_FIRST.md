# Hearthgate: Two Sides — spot 021

Hearthgate is an original local one- or two-player survival defense game. Version 0.6 adds a readable six-minute authored siege before the endless survival game: all art remains code-drawn, all rules run offline, and the deterministic simulation stays separate from its hybrid WebGL/Canvas presentation.

## Start

From this folder:

```powershell
npm test
npm start
```

Open `http://127.0.0.1:8821/`, or launch spot 021 through Game Hub.

## Mike + Errol playtest quick start

1. In Game Hub, launch spot 021 with two human seats. Put the big screen and both phones on the same Wi-Fi.
2. Mike scans the P1/North controller QR and Errol scans P2/South. Rotate both phones sideways; the game title should say **2 controllers ready**.
3. Press **A/RT** on either phone to start **Two Wardens**. On the title, X explicitly starts solo and Y explicitly starts co-op. The QR pages are Xbox/Brawl-style: left stick moves, right stick aims and fires on release, and the center buttons handle the gate.
4. During setup, walk beside an empty plot, **hold RB**, point the left stick toward one of the four wheel choices, and release RB to build. Up is Forge/metal, right is Ballista/lane attack, down is Market/gold, and left is Ember/splash.
5. At an existing building, tap RB to upgrade it immediately. P1 owns north and P2 owns south. LT volleys, X upgrades tower damage, Y repairs/rebuilds, and LB fortifies the shared gate.
6. When a tower falls, call the side aloud. The bright countdown is the cheaper quick-rebuild window; Y rebuilds your own side immediately if your wallet has enough metal.
7. Call each 72-second Oath aloud. Teal Hexer rings reduce damage to nearby ordinary enemies; red Warlord rings accelerate their formation. Seal all five Oaths at 6:00, then decide how long to hold the endless vigil.

For the first run, do not optimize too hard. Notice whether the controller mapping is remembered without reopening Help, whether both players get meaningful spending choices, and whether the breach is exciting or merely confusing.

## Core loop

Enemies approach the two halves of one gate in straight formations. Each half has its own tower health and damage level. If a half falls, its attackers cross the threshold, spread along three inner paths, and deal double damage. A 10-second quick-rebuild opportunity makes the immediate decision cheaper than a late reconstruction.

- In co-op, P1/North and P2/South have separate gold, metal, income, kill rewards, and four owned plots each.
- Gold upgrades your side's tower damage; metal repairs your side and raises or upgrades your buildings.
- Shared-gate fortification is the exception: its displayed metal cost is split between both wallets.
- Forge and Moon Market pay only their owner's wallet, with their exact rate shown in the build card and HUD.
- Ballista Yard attacks its owner's lane; Ember Lab splash-burns breaches on its owner's side. Current and next-level output are shown before upgrading.
- Gilded Relicbacks appear periodically and drop large gold and metal rewards.
- Five named Oaths—Ember Muster, Twin Fang Rush, Iron Bell March, Gilded Eclipse, and Hearthbreaker Oath—change the enemy mix and open with authored formations every 72 seconds.
- Hexers ward nearby ordinary troops to 65% incoming damage. Warlords accelerate nearby troops by 18%; the final Oath opens with one commander on each lane.
- Each sealed Oath records a bounded run receipt and pays gold and metal to every active warden. At 6:00 the route becomes Endless Vigil without resetting the defense.
- Enemy health, damage, mix, and arrival speed still scale continuously. Fast Skitters and announced three-enemy surges create pressure between the authored formations.
- Co-op starts each player with 105 gold and 170 metal plus an eight-second setup phase.

The battlefield is now genuinely low-poly 3D: a depth-tested WebGL scene renders terrain, paths, gate, hearth, buildings, enemies, aura rings, wardens, and projectiles at 480×270 with sixteen quantized color steps per channel. A transparent 960×540 native-pixel Canvas remains the authoritative interaction and legibility layer, with a disclosed Canvas fallback if WebGL is unavailable.

## Controller default

The shared screen uses the standard browser Gamepad API and the AXM `axm-universal-xbox-brawl-v0.2.1` contract. The dedicated QR phone page mirrors that layout and relays both button edges and held RB state over the local Game Hub server. Controller/phone 1 drives Warden 1; controller/phone 2 drives Warden 2. Left stick moves and chooses build-wheel directions, right stick aims, and RT/A or releasing a committed right-stick aim fires. The wheel removes the old blueprint-cycling step.

Keyboard, mouse, and touch remain fallbacks. Press `H` in game for the complete compact control card.
