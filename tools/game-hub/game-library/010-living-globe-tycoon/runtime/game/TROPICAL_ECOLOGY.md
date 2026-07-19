# Tropical food web — v0.8 system retained in v0.10

`FICTIONAL GAMEPLAY ECOLOGY · BOUNDED GUILDS · NOT A FIELD CENSUS`

v0.8 makes the island read as a tropical living place without turning the casual game into a biology spreadsheet. The HUD reports wildlife signs, the Palace shows one food-web pulse, and the detailed habitat section explains the values underneath.

## Living cast

The strategic layer now follows 11 functional guilds. Eight have dedicated local procedural visuals; the original walkable birds, fish, hares, foxes and fireflies remain present as the older visible layer.

| Guild | Where it lives | What it does underneath | Visible behavior |
|---|---|---|---|
| Butterflies and native bees | meadow, farms, woodland | pollination and farm fruiting | day forage and wing beats |
| Wetland frogs | reed edge | insect control and water-quality signal | rain/twilight hopping |
| Island geckos | warm woodland, rocks, settlement edges | insect control; prey for introduced predators | day basking and short scuttles |
| Insect-eating bats | woodland roosts and dark settlement routes | night insect control | night-only looping flight |
| Canopy parrots and fruit doves | woodland canopy and meadow edges | seed dispersal and delayed woodland recovery | bright day flights around groves |
| Herons and other wading birds | wetland edge | fish predation linking lake and shore | slow shoreline patrols |
| Shoreline land crabs | wetland and damp woodland | litter recycling and nursery-water buffering | sideways shore movement, especially in rain/twilight |
| Island iguanas | sunny highland, woodland and meadow | browsing plus seed movement | slow day walks and basking pauses |
| Island herbivores | woodland and meadow | grazing, seed movement and predator prey | represented by the legacy hare seam |
| Introduced mesopredators | settlements, roads and meadow | pressure on native ground life | represented by the legacy fox seam |
| Freshwater fish | lake and wetland nursery | aquatic food web and wading-bird prey | represented by the living lake fish |

## Causal web

```text
flowers + farm margins ──→ pollinators ───────────────→ fruiting / farm yield
warm edges + insects ────→ geckos ─┐
wetland + insects ───────→ frogs ──┼───────────────→ lower pest pressure
dark roost routes ───────→ bats ───┘

connected woodland ──────→ canopy birds ─┐
sunny mixed habitat ─────→ iguanas ──────┴────────→ seed dispersal
seed dispersal ────────────────────────────────────→ later woodland quality

wetland + leaf litter ───→ land crabs ─────────────→ shoreline recycling
shoreline recycling + wetland habitat ─────────────→ water quality
water quality ───────────→ frogs + fish + land crabs

roads + settlement access ─→ introduced predators ─→ ground-guild decline
native ground prey ────────────────────────────────→ predator capacity
```

The loop is deliberately not flat:

- animal populations move toward habitat-derived carrying capacities only on an explicit strategic quarter;
- roads reduce connectivity, while reviewed ecological buffers restore it;
- canopy seed dispersal helps woodland quality on the following recalculation rather than instantly creating trees;
- geckos, frogs and bats contribute different weights to natural insect control;
- land-crab abundance adds a bounded wetland water-quality buffer;
- iguanas help seed movement but contribute browsing pressure when crowded;
- introduced predators gain capacity from roads, settlement access and available ground prey, then suppress native ground guilds;
- food production reads pollination, pest pressure, natural control, seed dispersal and excess browsing together.

All values are clamped. Populations cannot grow without bound, locally absent guilds can recolonize only at declared intervals, and deterministic seeded variation replaces untracked randomness.

## Tropical weather

The strategic climate now stays warm while rainfall moves among `WET`, `DRY` and `TRADE_WIND` quarters. Calendar quarter names remain for game pacing, but temperature and rainfall follow a compact warm-island wet/dry rhythm. This is a game abstraction, not a location forecast or climate model.

## Save migration

v0.7 strategic saves use `axm.living-world.strategic-state/v0.4`. On first v0.8 load they migrate once to v0.5:

- the four new guild baselines are fitted to current habitat capacity;
- the migration increments revision so pending proposals become stale safely;
- one `STRATEGIC_V0_5_TROPICAL_WEB_MIGRATION` receipt records exactly what was added;
- no past sightings, births, deaths or ecological history are invented.

The v0.10 outer browser save is isolated at `AXM_LIVING_GLOBE_STEWARD_VNEXT_V10` and `axm.living-globe.local-save/v11`. Older save keys are read-only fallbacks.

## Honest limit

This is now varied enough to feel like a small tropical game ecosystem, but it is not a complete tropical biodiversity simulation. Reef fish, corals, pelagic animals, snakes, primates, disease vectors, soil microbes and detailed plant species remain intentionally outside v0.10. They should be added only when they create a useful decision or visible relationship rather than as decorative population noise.
