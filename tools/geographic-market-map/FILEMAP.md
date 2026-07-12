# AXM Geographic Market Map — authoritative file map

**Status:** EXPERIMENTAL · not canon · browser click test unrun

This is **one Workshop tool** presented through one card and one interface. The implementation remains modular underneath so source ingestion, normalization, ranking and presentation can be tested or replaced independently.

```text
tools/geographic-market-map/
├── index.html                 Human interface, local state, evidence views and exports
├── market-core.js             Pure validation, normalization, aggregation, confidence and ranking logic
├── source-adapters.js         CSV/JSON parsing, source receipt hashing and import schema generation
├── market-dictionary.json     One shared domain dictionary for geography, units, currencies, categories,
│                              source trust, popularity weights and starter item identities
├── manifest.json              Required Workshop discovery contract
├── module.contract.json       Required AXM module boundary contract
├── selftest.js                Deterministic logic checks; no network required
├── FILEMAP.md                 This single authoritative file map
└── README.md                  Human setup, schema and honest limits
```

## Data flow

```text
selected CSV/JSON or manual observation
        ↓
source-adapters.js parses without mutation
        ↓
market-core.js validates + normalizes with market-dictionary.json
        ↓
user-gated append into AXM local storage
        ↓
aggregates / geographic comparison / Top 100 / category Top 10
        ↓
explicit evidence JSON or scoped report JSON export
```

## Source-of-truth hierarchy

1. Raw imported row retained on each normalized record.
2. Source ID, source type, observed date and optional URL remain attached.
3. `market-dictionary.json` owns unit factors, active geographies, trust weights and ranking weights.
4. `market-core.js` owns deterministic calculations.
5. `index.html` may display calculations but does not redefine them.

## v0.1 boundary

- Active scope: Netherlands, Croatia and EU comparison.
- Planned only: United States and China.
- Import adapters are built; live external API connectors are not.
- EUR is native. Non-EUR comparison requires an explicit row-level `fxRateToEur`.
- Top 100 means top 100 **inside imported evidence**, never universal popularity.
- The tool provides evidence and patterns, not financial advice or automatic trading actions.
