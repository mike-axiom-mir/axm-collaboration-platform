# City-map v0.2.3 port guide

This focused update is intended for an AXM District Party v0.2.2 Tilburg/open-interiors copy. The complete v0.2.3 package is safer when the target has no separate local bug fixes. Use the focused port kit when another local copy has changes that must be preserved.

## Runtime seam

1. Add `client/game/ui/city-map.js`.
2. Merge the `mapMode`, button binding and `M`/`Escape` handling in `client/game/scenes/CityScene.js`.
3. Add `#map-toggle` to `client/game/game.html` and its rules to `client/game/game.css`.
4. Keep `drawCityMap(...)` after the ordinary city render and off-screen indicators. The map is presentation-only and must not send controller input.
5. Keep actor and occupied-vehicle marker filtering party-scoped. Do not replace it with every actor from the state packet.

The implementation relies only on existing `data/map.json`, `data/city-art.json` and the authoritative world snapshot. It adds no dependency and does not change host simulation, map chunks, collision or transport.

## Verification

Run:

```sh
node --test tests/city-map-ui.test.js tests/city-art-pass.test.js tests/static-runtime-contract.test.js tests/server-smoke.test.js
npm test
npm run test:cli
npm run map:preview
```

`npm run test:browser` is the DOM-level check when a Playwright Chromium executable is installed. Do not report it as passed merely because the static and Canvas-preview checks pass.

## Merge caution

If the target copy changed `CityScene.js`, `game.html`, `game.css` or the smoke tests after v0.2.2, compare those files instead of overwriting them blindly. The standalone full ZIP remains the reference implementation.
