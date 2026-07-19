# Port v0.2.7 onto the newest local build

Use the focused port kit when Local Codex has bug fixes newer than the preserved v0.2.6 base.

## Safe order

1. Back up the newest local project.
2. Read `INTERACTABLE_ASSET_PORT_FILES.txt` before copying.
3. Copy all new asset, manifest, source-evidence, documentation and test files.
4. Merge—do not blindly overwrite—these existing code/data files:
   - `client/game/scenes/CityScene.js`
   - `client/game/rendering/entity-renderer.js`
   - `data/city-art.json`
   - `scripts/render-city-art-preview.js`
   - `tests/cli-lifecycle-smoke.js`
   - `tests/browser-smoke.test.js`
5. Preserve any newer local gameplay bug fixes around those seams.
6. Run `npm test`, `npm run test:cli`, `npm run art:preview` and `npm run test:browser`.
7. Inspect `docs/previews/courier-interactable-art-pass.png`, then test Courier Chaos on the real shared screen.

## Merge invariants

- Package visuals are selected only from `pkg.id` and `pkg.kind`.
- The renderer never mutates package ownership/status.
- `propOverlays` may use only `visual-only` or `reserved` until a host mechanic exists.
- The ATM, vending machine and safe must not accept ACTION in this port.
- No new prop changes collision or appears in server state.
- Keep the old Kenney package sprite as a decode fallback.
- Keep every URL local and relative.

If the newest local build has changed the renderer substantially, port the behavior and tests—not line-for-line formatting.

