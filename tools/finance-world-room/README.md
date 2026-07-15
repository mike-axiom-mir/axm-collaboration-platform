# AXM Finance World Room

**Status:** `EXPERIMENTAL` · sandboxed · local-first · not financial advice

An explorable world room for sourced financial and economic observations over time. The first view is a movable flat Natural Earth map. Countries light up only when the selected layer has an exact observation for the selected year.

## Working now

- Natural Earth world geometry stored locally, rendered with a local D3 geographic projection.
- Drag, wheel/button zoom, country selection and country focus.
- Raw indicator layers and three transparent relative lenses.
- Exact-year map, country timeline and comparison table.
- Explicit World Bank Indicators API preview using World Development Indicators.
- Review-gated CSV/JSON import, receipts, source coverage and export.
- Human room notes that require an invalidation condition.
- No automatic network activity, missing-value estimation, carry-forward, forecasting or trading.

## Data flow

1. Choose an official World Bank indicator and year range, or a local file.
2. Fetch/parse into a preview. Nothing is saved yet.
3. Review accepted, rejected and duplicate counts.
4. Commit accepted rows to the local AXM store.
5. Explore exact years, then export the full evidence room when needed.

CSV schema:

```text
indicatorId,indicatorName,geography,countryName,period,value,unit,sourceId,sourceType,sourceUrl,retrievedAt,observationStatus,notes
```

`geography` is ISO3 and `period` is a four-digit year. `sourceId`, `sourceType` and `unit` are mandatory.

## Reusable future seam

The map is deliberately data-agnostic below the finance dictionary: geometry, projection, selection, time and evidence overlays can seed a later Physics World Room. Physics meanings and datasets must remain in their own module and contract.

## Sources and vendored libraries

- Natural Earth Admin 0 Countries, 1:110m. Natural Earth uses de facto boundaries by default; geometry is context, not a political claim.
- D3 Array 3.2.4 and D3 Geo 3.1.1, ISC license.
- World Bank Indicators API v2 / World Development Indicators. Network access happens only after the user presses **Fetch preview**.

## Checks

```bash
node tools/finance-world-room/selftest.js
node tools/finance-world-room/discovery-seam-review.js
npm test
```
