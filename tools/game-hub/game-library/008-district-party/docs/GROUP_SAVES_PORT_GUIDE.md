# Group-save v0.2.4 port guide

## Why this is a focused merge

This implementation was built on the preserved AXM District Party v0.2.3 package in the ChatGPT workspace. Mike reported that Local Codex has a newer laptop build containing additional bug fixes and state-save work. Therefore the complete v0.2.4 folder is a runnable reference, not permission to overwrite that newer source.

Use the focused port kit and merge deliberately into the newest local project. Keep a backup first.

## New files

- `server/group-save-store.js`
- `server/group-save-system.js`
- `data/group-save-schema.json`
- `local-data/README.md`
- `docs/GROUP_SAVES.md`
- `tests/group-save-store.test.js`
- `tests/group-save-server.test.js`
- `tests/group-save-ui.test.js`

## Existing files with integration edits

- `server/session-manager.js`
- `server/world-state.js`
- `server/world-loop.js`
- `server/player-system.js`
- `server/display-state.js`
- `server/server.js`
- `client/game/game.html`
- `client/game/game.css`
- `client/game/scenes/CityScene.js`
- `client/game/rendering/entity-renderer.js`
- `client/game/ui/hud.js`
- `client/game/ui/city-map.js`
- `client/controller/controller.js`
- `client/controller/controller.html`
- `client/launcher/launcher.js`
- `data/map.json`
- version/manifests and tests listed in `docs/GROUP_SAVES_PORT_FILES.txt`

Do not copy these modified files wholesale over Local Codex's newer files. Compare the marked group-save imports, state fields, methods, route, rendering call and UI block.

## Existing persistence adapter

If the newest local project already has a reliable state store, keep it. Port the fixed-roster rules and in-game computer onto that storage service instead of creating two competing save systems. The required invariants are:

1. exactly nine visible group save slots;
2. save slot owns its original exact seat roster;
3. per-seat progress is keyed by slot, not display name or account;
4. connected saved external seats retain authority;
5. only missing saved seats become Host AI;
6. connected seats outside the save block load;
7. AI-filled seats receive no QR/token and old phone authority is invalidated;
8. save/load contents are constructed and applied only by the host;
9. transient position/combat/session secrets are not restored;
10. the group returns to the base after load.

The included `GroupSaveStore` may be used directly when the current local state store does not already provide atomic validated files.

## Merge order

1. Add the three new server/data modules.
2. Add `save_terminals` to the structured map and normalize it in `world-state.js`.
3. Initialize the catalog and computer state when each world is created.
4. Merge the fixed-roster load operation into the current session manager, preserving current session IDs and connected seat tokens.
5. Process pending operations after authoritative ticks.
6. Put the save-computer interaction ahead of mission/vehicle fallback only when the actor is within terminal range.
7. Add only the public save summary to display state.
8. Merge the shared overlay, controller labels and code-drawn terminal.
9. Run the tests below and then run the latest local project's full suite.

## Required validation after port

```sh
npm test
npm run test:cli
npm run test:browser
```

The browser command may remain **UNRUN** when Chromium is unavailable, but it must not be reported as passed.

Manual local checks:

1. Save a two-human game into slot 1.
2. End/restart the Node host.
3. Start only Player 1, connect that controller, open the Party House computer and load slot 1.
4. Verify Player 1 retains control and money/inventory while Player 2 is visibly `Group AI 2`.
5. Verify the old Player 2 controller link cannot control that AI.
6. Save again into slot 1 and verify it remains a two-seat save.
7. Attempt to overwrite slot 1 from a three-seat roster and verify the host rejects it.
8. Use a different empty slot for the three-seat group.

Physical phones remain honest **UNTESTED** until that device run occurs.
