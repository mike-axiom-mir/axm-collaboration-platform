# AXM Geographic Market Map — Polished Review Build

**Status:** `EXPERIMENTAL` · not canon · not promoted

A local-first evidence workbench for mapping prices, materials, availability and popularity patterns by geography. The current active scope is the Netherlands, Croatia and an EU comparison layer. USA and China remain planned expansion scopes.

## What this build adds

- Polished responsive dashboard and geographic price surface.
- Review-gated CSV/JSON import: preview first, commit second.
- Transparent source-bounded Top 100 and Top 10 rankings.
- Pattern Desk with visible rules for:
  - geographic price gaps,
  - demand versus constrained availability,
  - multi-signal alignment,
  - month-over-month comparable price movement.
- Accuracy Lab with:
  - official/fresh/comparable coverage,
  - stale, synthetic, unknown-unit, unknown-source and missing-FX diagnostics,
  - outlier warnings,
  - source-type coverage.
- Human watchlist with mandatory invalidation conditions.
- Geographic bar comparison and monthly timeline.
- Source-ready catalog for Eurostat, CBS StatLine, Croatian DZS, UN Comtrade and World Bank commodity benchmarks.
- Full evidence, scoped report and watchlist exports.

## Important distinction

The source catalog describes reviewed future adapter targets. It does **not** claim that automated live fetching is already built.

The only import-ready route in this checkpoint is reviewed CSV/JSON or manual observation entry.

## CSV columns

```text
itemId,itemName,category,geography,observedAt,price,currency,unit,quantity,seller,availability,sourceId,sourceType,sourceUrl,marketplaceActivity,searchInterest,sellerGrowth,tradeMovement,pricePressure,notes
```

Required fields:

```text
itemId itemName category geography observedAt price currency unit sourceId sourceType
```

Popularity signals are optional values from 0 to 100. Ranking weights, source trust weights, quality thresholds and pattern thresholds remain visible in `market-dictionary.json`.

## One tool, modular underneath

- `index.html` is the single visible workbench surface.
- `market-ui.css` owns responsive presentation.
- `market-app.js` owns interaction, review gates, watchlist state and exports.
- `market-core.js` owns deterministic normalization, aggregation and ranking.
- `market-insights.js` owns diagnostic quality checks, pattern candidates, source coverage and timelines.
- `source-adapters.js` owns CSV/JSON parsing and import receipts.
- `market-dictionary.json` is the single shared market dictionary.
- `FILEMAP.md` is the single authoritative tool map.

## Checks

From the Workshop root:

```bash
node tools/geographic-market-map/selftest.js
node verify.js
node tests/html-script-syntax-test.js
npm test
```

## Honest limits

- No live retailer, marketplace, commodity, trade or search API adapter is active yet.
- Source trust weights are routing aids, not guarantees that an individual row is correct.
- The Quality Signal measures completeness and internal checkability, not truth.
- Pattern cards are research candidates, not forecasts.
- The tool does not issue buy/sell instructions or execute trades.
- Store-level stock coverage depends on future retailer and marketplace agreements/feeds.
- Browser rendering, import clicks and exports still require a recorded real Workshop browser test after this code update.
- Passing deterministic tests does not promote the module to `WORKING` or `CANON`.
