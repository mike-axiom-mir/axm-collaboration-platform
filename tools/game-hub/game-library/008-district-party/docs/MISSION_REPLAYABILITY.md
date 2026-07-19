# Mission route decks

Status: **IMPLEMENTED IN v0.2.5 · 4 MISSIONS × 4 LOCATIONS · 16 TOTAL LAYOUTS**

## Player-facing rule

Choose a mission at the Party House exactly as before. During the ten-second countdown the host draws a location from that mission's route deck. The selected location and its short gameplay twist appear on the shared screen. Choosing **Replay mission** draws another location instead of repeating the same setup immediately.

The current deck contains:

| Mission | Locations | Meaningful variation |
| --- | ---: | --- |
| Supply Sweep | 4 | Different crate geometry; zero to two low-damage rival lookouts |
| Hold the Relay | 4 | Different relay sites, approach directions and wave role ordering |
| Courier Chaos | 4 | Different dispatch points and different active delivery-zone sets |
| Call the Heat | 4 | Different city districts and surrounding road/building geometry |

This remains a casual game. Base rewards, low damage, mission timers and simple controls are unchanged.

## Host-owned selection

`data/mission-layouts.json` is the map-specific layout contract. The host builds one shuffled deck per mission mode. It consumes every configured layout once before reshuffling and prevents the first layout of a new deck from matching the previous run.

Phones never choose coordinates, spawn crates, activate delivery zones or select enemy approaches. They still send only semantic movement/action/attack intentions. `world.missionDirector` and its deck order are host-only and are excluded from party-screen state.

The public mission state exposes only what players should understand:

- layout id and name;
- route position within the configured set;
- one honest twist description;
- active dispatch and delivery markers;
- ordinary mission progress.

## Collision and eight-seat safety

Every configured layout is tested with eight selected actors. Mission teleport formation, packages, relay anchors and mission rivals use the same authoritative collision map as normal movement. If a preferred point is blocked, the host searches a bounded nearby ring for an open point instead of placing an actor or objective inside a building.

## Mode-specific behavior

### Supply Sweep

Each layout supplies its own six-crate offsets. Some layouts add one or two ordinary Neon Rival roles. The guards obey normal health, attack cooldown, collision and damage rules; defeating them is not required to collect the supplies.

### Hold the Relay

Each layout supplies enemy approach offsets and a small role order for each of the three waves. Enemy count scaling remains based on active Party A seats and stays bounded.

### Courier Chaos

Each layout creates a temporary visible dispatch zone, eight host-owned packages and a subset of active delivery zones. Inactive static delivery locations cannot accept a package. The main canvas, minimap and full map show the active route instead of stale depot markers. Host AI couriers choose only active drop zones.

### Call the Heat

The forgiving justice rules are unchanged. Only the starting district—and therefore the nearby escape geometry—changes.

## Future city import seam

A later emerged city or living-globe export can provide another `mission-layouts.json` using the same narrow fields: stable id, label, open start coordinate, twist, and optional mode-specific offsets/zone ids. Gameplay code does not need Tilburg coordinates embedded in the mission director.

## Explicit non-features

- No difficulty tiers yet.
- No procedural street generation.
- No hidden adaptive difficulty.
- No profile-based route weighting.
- No new mission rewards or rare equipment.
- No guarantee that a physical human group has played every location yet.

