# Asset provenance

BuddyFarm v0.2.0 contains no downloaded or extracted game assets.

The grass, house, soil, crops, furniture, cellar, signs, player placeholders
and interface are drawn deterministically by the local JavaScript/CSS source in
this game folder. They were authored for AXM BuddyFarm and may be replaced
through later approved modular asset contracts.

The deterministic motion math in `runtime/farm-motion.js` was adapted from the
locally authored AXM Farm Kit intake at `C:\axm workshop\exports\farm-kit`.
It contributes motion values only; no third-party images, audio or game data
were copied into BuddyFarm. The fit and contract boundary are recorded in
`docs/FARM_KIT_FIT_RECEIPT.md`.

`runtime/world/chunks/` contains 96 locally generated 1,024 x 1,024 RGBA PNG
tiles. Every pixel has alpha zero and RGB zero. They reuse only the verified
12,288 x 8,192 dimensions, north-west coordinate orientation and 12 x 8 chunk
grid from the neutral world-source contract. They do not contain the Tilburg
city raster or any city buildings, roads, sidewalks, water, rail or parks.
`runtime/world/blank-world-verification.json` records exact coverage and
digests. Grass, the starter farm and future terrain remain separate BuddyFarm
game layers above that reversible blank substrate.

This package does not contain Stardew Valley code, textures, sounds, names,
maps, characters or user mods.
