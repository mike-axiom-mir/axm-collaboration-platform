# AXM BuddyFarm · large blank-world working test

BuddyFarm is game **011**: a local-first 1–3 player cooperative farm with one
server-owned world and one shared host camera.

## What works in this build

- A verified 12,288 × 8,192 substrate made from 96 aligned 1,024 × 1,024
  fully transparent PNG tiles.
- View-reach streaming: only the chunks around farm actors enter the live world
  packet or renderer.
- Shared fog-of-war exploration stored in the authoritative state and JSON
  export.
- A bounded full-world overview showing the 12 × 8 blank/fogged chunk grid
  without loading a full-size raster.
- The authored 40 × 28 starter farm preserved at its original coordinates as a
  separate BuddyFarm layer above the blank substrate.
- One shared farm state and camera for keyboard, phone, gamepad and optional AI
  seats.
- Two permanent input lanes:
  - **Action** for story and 200 ms hold-to-travel;
  - **Work** for contextual prepare, plant, water and harvest through one field
    kit, with no routine tool carousel.
- Deterministic 150 ms grid-step interpolation, four-direction character poses,
  synchronized visual/audible footfall cues and distinct work feedback.
- Farm → house → cellar → house → farm travel with visible targets and blocking
  approach surfaces aligned to the artwork.
- Shared seeds, crops, harvests and sparse growth-token rewards.

## Important blank-world boundary

The Tilburg neutral-world handoff was used only to confirm dimensions,
coordinate orientation, the 12 × 8 chunk grid and digest discipline. The
authored Tilburg city raster and its buildings, roads, sidewalks, water, rail
and parks are **not** imported into BuddyFarm.

`runtime/world/blank-world-verification.json` proves exact coverage and
transparent alpha. Grass, paths, fields, buildings and future terrain are
separate reversible game layers.

## Start

Use Game Hub, choose **AXM BuddyFarm**, ready one to three seats and start.
The first human uses WASD, E and F. Other human seats can use standard gamepads
or the dedicated phone controller.

Direct developer start:

```powershell
node runtime/server.js
```

Then open:

`http://127.0.0.1:8801/games/011/?room=AXM1&player=p1`

Phone controller:

`http://127.0.0.1:8801/controller.html?room=AXM1&player=p2`

AI work stays off by default. It starts only when seat 3 is explicitly an AI
seat and the runtime is launched with `BUDDYFARM_AI_ENABLED=1`.

Read `docs/NEXT_BUILDER_HANDOFF.md` and `KNOWN_LIMITS.md` before extending the
world.
