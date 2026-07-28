# AXM Style Fabric

**Version:** 0.5.0  
**Status:** WORKING / TEST  
**Canon:** No  
**Current AXM game integrations:** None  
**Signature:** Mike - Axiom/mir

## What this is

Style Fabric is the first standalone universal reskin organ for AXM.

It gives humans and machine users one shared way to:

- start from 25 editable built-in preskins in six families;
- choose one of 16 universal semantic game molds;
- grow a deterministic recipe from seed, mood, mold, and complexity;
- mix separate world, structures/props, vehicles/gear, items/projectiles,
  character, interface, and effect preskins;
- apply legacy, balanced, showcase, or reduced-motion performance caps;
- deterministically fuse any two preskins at a chosen percentage;
- create reusable visual styles;
- reskin a whole compatible game;
- reskin one character;
- inspect all 33 portable game surfaces in one Test Chamber;
- tune a single surface without changing the rest of the skin;
- evaluate a future-game adapter with structural checks and explicit runtime evidence;
- forge complementary, analogous, triadic, split-complementary, or monochrome palettes;
- choose from 32 bounded style words and 19 declarative pattern languages;
- adjust glow, radius, emissive, gloss, metallic, roughness, specular, clearcoat, sheen, glass, iridescence, grain, weathering, outlines, pulse, shimmer, pattern, geometry, and more;
- choose expanded silhouettes, heads, outfits, accessories, and proportions;
- bring in self-made PNG/JPEG/WebP art;
- preview real resolved presentation data;
- export and import shareable skin files;
- save immutable versions in a local browser library;
- let future games adopt the same small semantic adapter contract.

It does **not** silently modify the current AXM Workshop, Foundation, Game Hub, or games.

## Fast start on Windows

1. Extract the ZIP into a normal folder.
2. Make sure Node.js 20 or newer is installed.
3. Double-click `START_STYLE_FABRIC_WINDOWS.bat`.
4. Your local address appears in the black window:

   `http://127.0.0.1:8840/studio/`

5. Open that address in your browser.
6. Keep the black window open while using Style Fabric.
7. Press `Ctrl+C` in the black window to stop it.

Do not double-click `studio/index.html` directly. Browsers block its local modules and example contracts when opened as a raw file.

## Start from a terminal

```bash
npm start
```

Then open:

`http://127.0.0.1:8840/studio/`

No internet connection is required. The reference server listens on the same computer only by default.

## Beginner creation flow

1. Pick one of the 25 preskins or press **Surprise me**.
2. Optionally choose **Blend with** and set a deterministic fusion percentage.
3. Select a game mold. It defines presentation organs, not game rules.
4. Optionally grow a new recipe from the visible seed, mood, and complexity.
5. Optionally mix seven preskins across the complete game-skin organ set.
6. Choose a performance profile for old hardware, balanced play, showcase, or reduced motion.
7. Choose **Whole game**, **Character**, or **Reusable style**.
8. Edit style words, palette, character parts, materials, pattern, geometry, and motion.
9. Use the **Full Game Skin Test Chamber** to inspect all 33 surfaces, filter
   by organ, and optionally tune one surface in isolation.
10. Watch the live specimen and check the compatibility receipt:
   - Applied
   - Fallbacks
   - Protected
   - Unsupported
11. If you are preparing a real adapter, record the four runtime observations
    in the Adapter Conformance Lab. These are evidence prompts, not automatic
    certification.
12. Optionally add your own raster art.
13. Export a portable `.axmskin.json` file or save it to My Local Skins.

The description box reports unknown words instead of pretending it understood them.

## Built-in preskins

The package includes 25 actual portable preskin files under `examples/preskins/`
and a machine-readable `preskin-catalog.json`.

Families:

- **AXM Identity:** Balanced AXM, Axiom-heavy, Mir-heavy, Public-safe AXM, Experimental AXM.
- **Worlds:** Verdant Canopy, Cosmic Deep, Ember Foundry, Oceanic Glass, Paper Kingdom.
- **Arcade:** Neon Circuit, Pixel Sunset, Chrome Royale, Candy Burst.
- **Characters:** Comic Vanguard, Street-Tech Rogue, Ceremonial Star, Soft Hero.
- **Atmosphere:** Noir Signal, Frost Relay, Desert Signal, Watercolor Dream.
- **Clarity:** Accessible Night, Clean Day, Low-motion Focus.

Preskins are foundations, not locked themes. Selecting one writes its choices
into the same visible human/machine intent. Fusion records both source IDs and
the exact blend amount in provenance.

## What “universal” honestly means

The core pack and recipe are engine-neutral. A future game adopts the system by declaring visual slots such as:

- `world.sky`, `world.terrain`, `world.water`, and `world.lighting`
- `structure.building`, `structure.interior`, and `prop.interactive`
- `vehicle.body`, `equipment.weapon`, `item.pickup`, and `projectile.primary`
- `character.player.body`, `character.player.face`, and cast regions
- `fx.primary`, `fx.impact`, and `fx.ambient`
- `ui.panel`, `ui.hud`, `ui.menu`, `ui.marker`, `ui.cursor`, and `ui.icon`

The game then maps those meanings into its own CSS, Canvas, sprite, shader, Unity, Godot, custom engine, or other presentation layer.

A style can only use capabilities a game actually exposes. A 2D game does not become true 3D just because a skin asks for it. Unsupported properties fall back and appear in the receipt.

## Truth boundary

Skins can change presentation. They cannot change:

- damage, health, score, economy, or rules;
- physics, collision, hitboxes, or movement;
- input, networking, permissions, saves, or authoritative simulation;
- game fairness or protected gameplay cues;
- executable code.

Machine users use the same visible contracts as humans. They can compile and propose a skin; approved application remains a separate operation.

## Share format

The portable v1 contract remains one JSON file:

`name.axmskin.json`

It can contain:

- canonical style recipe;
- semantic materials and bindings;
- character appearance blueprint;
- creator/license/remix declarations;
- deterministic seed and source intent;
- optional embedded raster assets;
- SHA-256 integrity receipt.

The single-file format deliberately avoids unsafe archive extraction in this first version.

## Full-game surfaces, molds, and starter kits

The 33 semantic surfaces are grouped into seven independent organs: World &
Atmosphere, Structures & Props, Vehicles & Equipment, Items & Projectiles,
Character Regions, Effects, and Interface. Sixteen molds cover small targeted
adoption through Full Game Skin. They produce ordinary v1 game contracts, so
the existing resolver and future adapters stay compatible.

`examples/mold-kits/` contains 20 deterministic portable starter skins and
16 generated example game contracts. `mold-kit-catalog.json` indexes them.
Molds never silently guess a game's internal names: nonstandard slots require
an explicit recorded binding map.

## Test Chamber and first-adoption harness

The Studio now renders one functional material sample for every portable
surface. Each card distinguishes a connected game slot from a pack-authored
surface that would currently retain the game fallback. The inspector exposes
only properties supported by that semantic slot and records isolated edits in
pack provenance.

The Adapter Conformance Lab checks contract shape, unique and known roles,
property vocabulary, fallback declarations, and protected cues. A structurally
valid contract remains `CONTRACT_READY_RUNTIME_PENDING` until a human or test
harness records isolated preview, fallback, rollback, and resolution-receipt
observations. No existing game is inspected or modified by this lab.

## Future AXM intake

Recommended route:

`Creative Studio Asset Mode → Asset Vault → Style Fabric → preview/export TEST pack → game adapter → explicit approval → apply receipt`

Read these next:

- `BODY_CARD.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/AI_NATIVE.md`
- `docs/PRESKINS_AND_FUSION.md`
- `docs/MOLDS_LAYERS_AND_GROWTH.md`
- `docs/GAME_SKIN_SURFACES.md`
- `docs/SECURITY_MODEL.md`
- `docs/ADOPTION_LEVELS.md`
- `KNOWN_LIMITS.md`
- `TEST_REPORT.md`
- `ACTION_REPORT.md`

## Developer commands

```bash
npm test
npm run verify
npm run preskins:build
npm run molds:build
npm run example:compile
npm run example:validate
node bin/axm-skin.mjs --help
```

The package has no third-party runtime dependencies.
