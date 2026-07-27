# Known limits

Status: **WORKING TEST · LARGE BLANK WORLD**, not a finished game.

- The 12,288 × 8,192 substrate is intentionally blank and transparent. Outside
  the authored 40 × 28 starter district, the current visible/walkable layer is
  only BuddyFarm's procedural meadow foundation. There are no authored rivers,
  roads, biomes, buildings or activities yet.
- The Tilburg city raster and its semantic buildings, roads, sidewalks, water,
  rail and parks are deliberately absent. “Clean city raster” must never be
  treated as equivalent to “blank transparent substrate.”
- Fog-of-war exploration survives browser refresh and is included in JSON
  export while the managed runtime remains alive. Runtime-shutdown persistence,
  save import and the cross-device shared-save bridge do not exist yet.
- The full map is a bounded 12 × 8 chunk overview. It does not load a
  12,288 × 8,192 full-resolution raster.
- World collision outside the starter district currently has only outer bounds;
  later terrain modules must add their own explicit walkability and collision.
- Character art is an original procedural first pass, not final art. Walk
  interpolation, four directions, footfall contact/dust and a quiet procedural
  local footstep are implemented; final animation and audio approval remain a
  human playtest decision.
- The browser automation verified keyboard movement, one phone-controller move,
  a 390 × 844 controller layout, and the rendered desktop journey. It could not
  physically hold a keyboard/gamepad/phone button for 200 ms, so the exact live
  hold routes remain physical QA even though the shared client timing code and
  authoritative 199/200 ms boundary are deterministic-tested.
- Bluetooth/USB gamepad routing remains hardware-unverified. Deterministic tests
  cover keyboard + one pad (`P2`) and two pads (`P1`, `P2`) without silently
  assigning an AI seat.
- Physical two-phone QA is still pending. The simulated phone viewport has no
  horizontal/vertical overflow and all controls remain visible.
- AI work is off by default. Seat 3 exists only when explicitly present in the
  roster; autonomous work additionally requires `BUDDYFARM_AI_ENABLED=1`.
- The cellar is a usable bounded room but still has no storage or crafting.
- There are no NPCs, dialogue, fishing, combat, animals, shops or equipment
  upgrades.
- Rewards remain deliberately sparse: no random loot table or filler inventory
  has been added.
- A crop still needs two watered mornings; balance remains placeholder tuning.
- No Stardew Valley code, art, maps, mods, names or balance data are present.

## External steward findings

The 2026-07-24 Workshop-wide stress run left one stable red check outside this
game lane: the global HTML syntax test does not yet compile Evidence Desk's
external-only scripts. Studio's discovery review failed during a concurrent
edit but passed after its owner updated the test. World Tile Foundry's mutating
generator selftest was intentionally not run while that shared source was owned
by another active builder. A concurrent steward also stopped load escalation at
RED memory pressure, so another heavy duplicate root suite must wait for
resource recovery. None of these is a BuddyFarm runtime failure.
