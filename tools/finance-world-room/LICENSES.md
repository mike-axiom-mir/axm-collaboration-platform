# Third-party materials

- `vendor/d3-array.min.js` — D3 Array v3.2.4, copyright 2010–2023 Mike Bostock, ISC license.
- `vendor/d3-geo.min.js` — D3 Geo v3.1.1, copyright 2010–2023 Mike Bostock, ISC license.
- `assets/world-countries-110m.geojson` — Natural Earth 1:110m Admin 0 Countries. Natural Earth data is in the public domain. The vendored snapshot comes from the Natural Earth vector repository.

The World Bank adapter does not vendor financial observations. It retrieves a preview from the public Indicators API only after an explicit user action and retains the request URL with every accepted row.
