# AXM Geographic Market Map v0.1

A local-first evidence workbench for mapping prices, materials, availability and popularity by geography. It starts with the Netherlands, Croatia and an EU comparison layer.

## What works in v0.1

- Import CSV or JSON observations.
- Add a single observation manually.
- Preserve raw source rows and import receipts.
- Hash imported files in supported browsers.
- Normalize common mass, volume, length, area, energy and item units.
- Refuse silent non-EUR comparison unless an explicit FX rate is supplied.
- Compare Netherlands, Croatia and EU observations by item and month.
- Calculate transparent source-bounded Top 100 and category Top 10 rankings.
- Calculate a visible confidence score from source type, freshness, sample size and price consistency.
- Save locally through the AXM Foundation and export evidence/report JSON.

## CSV columns

```text
itemId,itemName,category,geography,observedAt,price,currency,unit,quantity,seller,availability,sourceId,sourceType,sourceUrl,marketplaceActivity,searchInterest,sellerGrowth,tradeMovement,pricePressure,notes
```

Required fields:

```text
itemId itemName category geography observedAt price currency unit sourceId sourceType
```

Popularity signals are optional values from 0 to 100. Ranking weights are stored visibly in `market-dictionary.json`.

## Run checks

From the Workshop root:

```bash
node tools/geographic-market-map/selftest.js
node verify.js
node tests/html-script-syntax-test.js
```

## Honest limits

- No live retailer, marketplace, commodity, trade or search API is connected yet.
- The synthetic demo is only for interface testing and receives the lowest trust weight.
- Imported evidence can still be wrong; source identity and user review remain necessary.
- Store-level inventory coverage depends on future retailer/marketplace feeds.
- USA and China are planned expansion scopes, not current coverage.
- Browser rendering and click behavior remain UNRUN until recorded on a real Workshop preview.
- Passing deterministic checks does not make the module WORKING or CANON.
