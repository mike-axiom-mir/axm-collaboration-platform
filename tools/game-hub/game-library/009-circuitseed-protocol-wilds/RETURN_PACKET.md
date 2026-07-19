# Return packet — next local Circuitseed pass

## Current truth

- Build: `v0.2.0-local-alpha-candidate-directors-cut`
- Label: **ALPHA CANDIDATE / WORKING**
- Slot/port: `009` / `8799`
- Active source: `tools/game-hub/game-library/009-circuitseed-protocol-wilds/`
- Automated game command: PASS, including 49 tests and actual Hub result return
- DOM boot/action smoke: PASS for the real client/server without rendered pixel claims
- Shared-controls and Workshop regression gates: PASS
- Rendered eyes-loop: UNRUN
- GitHub writes: none

Do not promote this package to `LOCAL ALPHA TEST` until the rendered desktop and phone checklist is actually looked at and repaired where necessary.

## Launch

From the game folder:

```sh
./START_CIRCUITSEED_VIA_GAME_HUB.sh
```

Windows:

`START_CIRCUITSEED_VIA_GAME_HUB.bat`

Open the exact printed address, normally `http://127.0.0.1:8799/games/009/`.

## Verify before editing

```sh
npm test
```

Then, from the Workshop root:

```sh
node verify.js
```

The Workshop root has no `npm test` script. Do not invent a pass for it.

## First eyes-loop

Capture and inspect, at minimum:

1. desktop animated title and accessibility controls;
2. profile create, portable export/import, and conflict message;
3. New Journey followed by end/relaunch/Continue of the same world;
4. Lumen Yard, Relayborn Route, Threadwild, Corewild, and Rootsignal visuals, textures, minimap, proximity cues, and region-entry cards;
5. starter selection and returning-profile reconnection;
6. Corewild and Rootsignal tactical panels;
7. signal-site Scan → Connect feedback in each region, including a refused pre-scan Connect;
8. at least two Memory Echo discovery cards, the ten-slot journal, inventory descriptions, and one Field Request claim;
9. the 30-entry Field Codex, roster totals, design-specific emblems/forms, and active-companion switching;
10. one complete Confluence evolution, both preserved parents, inherited actions, and the specialist signature cue;
11. Circuitkin focus-branch cards and friendly simulations;
12. material shelf, locked/ready recipes, craft/business/shop/order feedback;
13. party screen with uneven and additional-seat roles plus archive/request counters;
14. phone controller in portrait and landscape;
15. disconnect/reconnect presentation;
16. save/end, result return, Hub lobby state, and stopped port 8799.

Keep screenshots local. Record exact viewport/device, route, and failure. Repair and rerun `npm test` after every material change.

## Persistence and recovery

Authoritative runtime state lives in the ignored game-local `local-data/` folder:

- `profiles/` — participant-owned portable identity/history;
- `worlds/` — host-owned world consequences and snapshots;
- `ledgers/` — per-session append-only evidence.

Do not merge these stores. Do not resolve profile conflicts by overwriting the current copy. Incompatible schema versions intentionally refuse to load.

## Integration rollback

The pre-Circuitseed Game Hub server is preserved at:

`backups/circuitseed-20260715/tools/game-hub/game-hub-server.js.before-circuitseed`

Do not restore it casually: doing so removes the managed runtime/result-return extension required by slot 009. Compare first and preserve later local changes.

## Boundaries to preserve

- GitHub remains read-only unless Mike explicitly starts a separate publication task.
- Do not claim Living Globe or Mirror live integration.
- Connected AI receives only its bound semantic observation and uses the ordinary intention gate.
- No default AI, hidden player, remote runtime asset, CDN, external AI, central economy, or public market.
- Circuitkin are connected through trust/repair/help, never capture.
- Confluence evolution must preserve both parent individuals and remain an explicit player choice; do not turn it into destructive fusion or silent auto-evolution.

## Best next work

The next value is visual and human-play evidence, not more hidden architecture. Tune layout, readability, controller comfort, route pacing, encounter balance, audio, and chapter duration from the actual local eyes-loop while keeping every current automated assertion green.
