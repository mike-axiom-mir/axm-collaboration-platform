# v0.3.0 Streetscape Foundation Port Guide

Use the focused kit when the laptop copy contains gameplay bug fixes newer than this complete reference build.

1. Back up the newest local AXM District Party project.
2. Compare `client/game/rendering/entity-renderer.js` before replacing it; merge newer gameplay-renderer edits if present.
3. Copy `data/city-art.json` and `tests/city-art-pass.test.js`.
4. Run `node --test tests/city-art-pass.test.js`.
5. Run `npm test`, then `npm run test:cli`.
6. Run `npm run art:preview` and inspect the overview, centre, Party House and a landmark.
7. Reproduce a real exterior gameplay view at a declared viewport, capture before/after evidence at the same scale, and keep human visual approval pending until a person reviews it.
8. Do not copy `data/map.json`, `data/tilburg-source-index.json`, `data/map-chunks/` or `scripts/compact-tilburg-map.js`; v0.3.0 does not require map-data replacement.

The expected city-art focused result is 5/5. The complete suite count can be higher on a newer laptop build.
