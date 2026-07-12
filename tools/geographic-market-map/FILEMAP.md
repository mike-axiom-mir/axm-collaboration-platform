# AXM Geographic Market Map — authoritative file map

**Status:** EXPERIMENTAL · polished review build · not canon

This is **one Workshop tool** through one Hub card and one interface. Its internals remain modular so source ingestion, normalization, diagnostics, pattern rules and presentation can be tested or replaced independently.

```text
tools/geographic-market-map/
├── index.html                 One visible polished workbench surface
├── market-ui.css              Responsive visual system and layout
├── market-app.js              UI state, review gates, rendering, watchlist and exports
├── market-core.js             Pure validation, normalization, aggregation, confidence and ranking
├── market-insights.js         Quality diagnostics, pattern candidates, source coverage and timelines
├── source-adapters.js         CSV/JSON parsing, source receipt hashing and import schema
├── market-dictionary.json     One shared dictionary: geographies, units, currencies, categories,
│                              source trust, source catalog, weights and thresholds
├── manifest.json              Workshop discovery contract
├── module.contract.json       AXM module boundary contract
├── selftest.js                Deterministic core + insight regression checks
├── FILEMAP.md                 This single authoritative file map
└── README.md                  Setup, schema, checks and honest limits
```

## Data flow

```text
selected CSV/JSON or manual observation
        ↓
source-adapters.js parses without mutation
        ↓
market-app.js preview gate shows accepted / rejected / duplicate rows
        ↓
explicit human commit
        ↓
market-core.js normalizes with market-dictionary.json
        ↓
AXM local storage keeps evidence + raw row + import receipt
        ↓
market-insights.js produces diagnostics and research candidates
        ↓
market-app.js renders map / comparison / Top 100 / Top 10 / watchlist
        ↓
explicit evidence, scoped report or watchlist export
```

## Source-of-truth hierarchy

1. Raw imported row retained on every normalized record.
2. Source ID, source type, observed date and optional URL remain attached.
3. `market-dictionary.json` owns shared identities, unit factors, source trust, thresholds and ranking weights.
4. `market-core.js` owns deterministic calculations.
5. `market-insights.js` owns visible diagnostic and candidate-pattern rules.
6. `market-app.js` coordinates interaction but does not redefine the calculation rules.
7. `index.html` and `market-ui.css` present the tool without becoming data authority.

## Current boundary

- Active geography: Netherlands, Croatia, EU.
- Planned geography: United States, China.
- Import adapters: built.
- Automated live-source adapters: catalogued, not built.
- EUR is native. Non-EUR comparison requires explicit row-level `fxRateToEur`.
- Top 100 means top 100 **inside imported evidence**, never universal popularity.
- Pattern cards are investigation prompts, never automatic forecasts.
- Watch entries require an invalidation condition.
- The human remains responsible for any trading interpretation or action.
