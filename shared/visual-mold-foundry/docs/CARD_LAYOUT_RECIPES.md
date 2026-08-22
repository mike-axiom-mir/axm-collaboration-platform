# CARD LAYOUT RECIPES — v0.5

## Purpose

A card mold must be more than a renamed copy. v0.5 gives each of the **24 card molds** a distinct governed layout recipe. Canvas, HTML, and SVG exporters share the same recipe identity, while each renderer may use the most suitable native construction.

## Recipe families

### Marketing, explanation, and visual logs

- `editorial-split`
- `service-stage`
- `feature-grid`
- `case-study-proof`
- `event-beacon`
- `collaboration-call`
- `public-brief`
- `milestone-ledger`

### Software UI

- `dashboard-panel`
- `settings-stack`
- `onboarding-flow`
- `command-console`
- `alert-recovery`
- `metric-pulse`
- `activity-timeline`
- `profile-network`

### Game UI and marketing

- `game-signal`
- `mission-brief`
- `character-dossier`
- `loot-inspect`
- `quest-ledger`
- `boss-warning`
- `world-event`
- `hud-status`

## Contract

A card mold declares its recipe in `renderer_options.layout`. Validation rejects unknown recipe IDs. The renderer registry must contain the same recipe before a mold can pass the structural checks.

## Export behavior

- Canvas uses the full visual recipe.
- HTML records the recipe as `data-layout` and uses the matching self-contained visual structure.
- SVG includes a recipe-specific motif so exports do not collapse into one generic card.

The exports are semantically aligned, but exact pixel identity across Canvas, HTML, SVG, and downstream engines is not claimed.

## Adding another recipe

1. Add the recipe ID to `CARD_LAYOUTS` in `app/js/renderers.js`.
2. Implement its Canvas composition.
3. Add its SVG/HTML motif in `app/js/exporters.js`.
4. Assign the recipe to a sparse mold manifest.
5. Add a preview and starter preset.
6. Rebuild the registry bundle.
7. Run the full test suite.
