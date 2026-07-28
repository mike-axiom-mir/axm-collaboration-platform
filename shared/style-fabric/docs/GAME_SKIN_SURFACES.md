# Full game-skin surface catalog

Status: **WORKING / TEST**

Style Fabric is the umbrella system. Character Forge is the focused character
designer inside it. A Full Game Skin may style any presentation surface that a
game deliberately exposes through the same adapter contract.

## Seven organs, 33 semantic surfaces

1. **World & atmosphere (8):** sky, background, terrain, general surface,
   water, weather, lighting, and post-effects.
2. **Structures & props (4):** buildings, interiors, environmental props, and
   interactive props.
3. **Vehicles & equipment (4):** vehicle body/detail, weapons, and tools.
4. **Items & projectiles (3):** pickups, objectives, and primary projectiles.
5. **Character regions (5):** player body/detail/face, enemy body, and NPC body.
6. **Effects (3):** primary, impact, and ambient effects.
7. **Interface (6):** panels, HUD, menus, markers, cursor, and icons.

The machine-readable source of truth is `SLOT_LIBRARY` in
`src/core/molds.mjs`. `listGameSurfaceSlots()` and
`listGameSurfaceCategories()` return safe clones for tools and adapters.

## Honest universality

A skin pack can author all 33 meanings now. A game still has to declare which
ones it supports and map those meanings into its renderer. Style Fabric does
not inspect or rewrite an unprepared game. Unsupported surfaces retain the
game's fallback and appear in compatibility and coverage receipts.

The `full-presentation` mold keeps its historical ID for compatibility; its
display name is now **Full Game Skin** and it declares all 33 surfaces.

## Coverage reports

`gameSurfaceCoverage(pack, gameContract?)` reports connected and missing
surfaces by organ. It is inspection only and always reports
`automaticWrites: 0`. `assessMoldCompatibility` remains the more detailed
property-level negotiation for a selected mold.

## Test Chamber

The Studio displays all 33 surfaces as functional material samples. Filters
isolate each organ, search locates a semantic slot, and status markers separate
pack-authored surfaces from slots connected by the active game mold. The
per-surface inspector changes only the selected material and records the edited
properties in provenance. A reset restores that surface's baseline.

The adjacent Adapter Conformance Lab checks declared contract structure and
collects four explicit runtime observations. It never treats a checkbox as
automatic engine certification and never writes to a game.

## Safety boundary

These slots describe appearance only. Protected readability, identity, team,
objective, status, interaction, pointer, and reduced-motion cues stay declared
by the game contract. No surface grants access to rules, simulation, input,
networking, saves, executable code, or promotion state.
