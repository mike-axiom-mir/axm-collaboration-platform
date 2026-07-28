# Architecture

AXM Style Fabric is a separate organ. It does not require existing games to already support skins and it does not overwrite the Foundation.

## Adoption model

Every adopting game provides one small `game-skin-contract.json`. The contract names semantic presentation slots such as:

- `world.sky`, `world.terrain`, and `world.lighting`
- `structure.building` and `prop.interactive`
- `vehicle.body`, `equipment.weapon`, and `item.pickup`
- `character.player.body`, `character.player.detail`, and `character.player.face`
- `ui.panel`, `ui.hud`, `ui.marker`, and `ui.cursor`
- `fx.primary`, `fx.impact`, and `fx.ambient`

A skin binds its materials, tokens, and optional assets to those meanings. A game-specific adapter decides how each meaning maps into CSS variables, Canvas drawing, sprites, shaders, engine materials, or another renderer.

```mermaid
flowchart TD
    A["Human or machine intent"] --> B["Deterministic recipe compiler"]
    B --> C["Portable skin pack"]
    C --> D["Admission: shape, assets, integrity"]
    G["Game skin contract"] --> E["Slot resolver"]
    D --> E
    E --> R["Resolved-presentation validation"]
    R --> F["Game-owned adapter"]
    F --> H["Exact prepared proposal or preview"]
    H --> I["Receipt and rollback token"]
```

## Six separations

1. **Intent is not a skin.** Intent is compiled into a complete, inspectable pack.
2. **A skin is not a game adapter.** Packs stay portable; games own mappings.
3. **Preview is not apply.** A preview needs no game mutation.
4. **Proposal is not approval.** Machine users can compile and propose; apply requires an explicit approval packet.
5. **Presentation is not authority.** The contract rejects authoritative gameplay fields.
6. **Sharing is not trust.** Imported packs enter validation/quarantine before use.

## Admission and safe-data boundary

`admitSkinPack()` is the shared decision for untrusted portable data. It
combines strict pack validation, embedded-raster verification, and declared
integrity policy. Resolution consumes the admitted data and then validates the
final resolved presentation again against the exact game contract and
`ZERO_AUTHORITATIVE_WRITES`.

Stable-data and instance operations inspect own data properties only.
Inherited values, accessors, cycles, non-finite numbers, and dangerous
`__proto__`, `prototype`, or `constructor` path segments are rejected before
canonicalization, hashing, merging, flattening, lookup, or override.

## Runtime transaction boundary

`SkinRuntime.prepare()` captures a validated clone of the adapter contract and
stores the exact prepared proposal privately. Preview and apply accept only
that digest-bound proposal. Any forged field, mutation, adapter-contract
change, replay, or concurrent reuse is rejected before the adapter is called.

An approval packet still requires an explicit visible actor. Successful apply
is single-use and produces a rollback receipt; rollback remains a separate
approved operation.

## Test and conformance separation

The Test Chamber resolves the current portable pack against a selected semantic
mold and displays all 33 authored surfaces, including game-owned fallbacks. Its
per-surface overrides remain presentation-only pack data.

`assessGameAdapterConformance()` is a separate read-only report. Six checks
inspect contract structure; four checks accept declared observations from the
target runtime. The report is not a game adapter, does not execute a renderer,
and always reports `automaticWrites: 0`.

## Layering

Full game skins can be composed from seven isolated organs:

1. world and atmosphere;
2. structures and props;
3. vehicles and equipment;
4. items and projectiles;
5. character regions;
6. effects;
7. interface.

Game fallback remains underneath all seven, and accessibility/local adjustments
can remain above them. Later layers override only declared presentation values.
Every override is listed in the resolution receipt. Source packs remain
unchanged.

Accessibility merges conservatively: the strongest minimum contrast wins and
safety booleans can be enabled but not weakened. Composition lineage records
source pack integrity and embedded-asset hashes when supplied.

## Mold Foundry and exact generation

Built-in molds and custom review molds use the same known semantic slot
library. `forgeSkinMold()` accepts an explicit slot list. `growSkinMold()` adds
or removes explicitly named slots or organs. Both validate before returning a
draft-review receipt with zero automatic game writes.

Recipe generation is exact to the chosen mold. A targeted mold no longer
produces a hidden 33-surface pack: bindings, materials, blueprints, and
capabilities that are not required by the selected semantic slots are omitted.

## Treatment Forge

A semantic game mold answers where presentation can bind. A treatment mold
answers how selected surfaces are visually constructed. The contracts stay
separate so a treatment cannot expand a game's adapter surface.

For one treatment mold, seed, target set, and performance profile,
`generateTreatmentDirections()` returns exactly three distinct deterministic,
unselected drafts. A chosen draft can be composed into explicitly matching pack
bindings with target-isolated materials.

Each enhanced material retains flat legacy fields and may add a bounded
`effectStack` plus a semantic `lightingRig` for `world.lighting`. Profiles cap
layer count, effect cost, glow, bloom, haze, light intensity, and motion.
Treatment composition is pack-data editing: it is not a runtime apply, save,
publication, promotion, or CANON action.

## Preskin composition

Built-in preskins sit before compilation, not after resolution:

`preskin or fusion → editable intent → deterministic compiler → ordinary skin pack`

This keeps presets transparent and reusable by humans, machine users, the
visual studio, and future character-design tools. Fusion never mutates the
source catalog. It records both source IDs and the blend amount.

## Graceful capability fallback

A material describes semantic properties such as metallic, roughness, glow, paper grain, outline, or iridescence. A game contract declares what its renderer supports. Unsupported properties are omitted with warnings; they never become gameplay writes.

## Future character-design route

The same system can grow from “character skin” into “character design” by adding animation-safe semantic regions, pose/expression sets, equipment anchors, silhouette constraints, and asset variants. Identity, statistics, abilities, collision bodies, and gameplay behavior remain separate contracts.
