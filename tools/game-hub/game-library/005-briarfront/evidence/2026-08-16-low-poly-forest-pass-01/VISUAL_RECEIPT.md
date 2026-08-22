# Briarfront low-poly forest pass 01

Status: `WORKING` visual increment on an `EXPERIMENTAL` game. This is not `CANON` and does not promote the game.

## Lane

- Lane-owned source: `runtime/briarfront-client.html`
- Lane-owned evidence: this directory
- Shared seams touched by the visual change: none
- Preserved foreign or pre-existing changes: `README.md`, `game.manifest.json`, `runtime/briarfront-server.cjs`, `runtime/grafthold-source.html`, and every path outside this game

## Audit steps

1. Baseline shared display — `WORKING`, with visible polish risks. The active Three.js canvas rendered at 1280×720 and the Canvas2D fallback was hidden. The arena read as two flat ground rectangles, a uniform river strip, two slab bridges, small actors, and sparse depth cues. Evidence: `01-before-shared-screen.png`.
2. Improved shared display — `WORKING`. The same route and viewport rendered faceted forest-floor patches, shoreline stones and reeds, animated water marks, plank bridges, boundary stones, outlined health jars, and stronger player/mob silhouettes. Evidence: `03-after-shared-final.png`.
3. Repeated-frame observation — `UNKNOWN` for animation timing, `PASS` for visibly changing rendered frames. Three screenshots captured 700 ms apart have distinct SHA-256 digests, but the environment has no `visual.capture.ephemeral-rolling-buffer/v1` hand, so the change cannot be isolated from normal world-state movement. Evidence: `03-after-shared-final.png`, `04-motion-mid.png`, `05-motion-settled.png`.
4. P1 first-person display — `WORKING`. The perspective camera showed the new terrain, riverbank, bridge, rocks, shadows, and faceted vegetation as world-space 3D geometry; the fallback canvas stayed hidden and no browser warning or error was logged. Evidence: `06-after-player-p1.png`.

## Visible strengths and remaining risks

- The forest now has a clearer low-poly/16-bit-adjacent material language without replacing the existing 3D runtime or gameplay state.
- The river and crossings are recognizable from both camera modes.
- The shared view keeps the complete 120×120 playfield visible, which leaves dark side gutters at 16:9.
- Aerial actors remain intentionally small against the full-map scale and can still overlap dense tree canopies.
- The 9 px spectator statistics are a readability risk at couch distance.
- Physical phone layout, touch targets, gamepad behavior, combat readability under heavy action, and offline Three.js loading were not proven by this visual pass.

## Live visual receipt

```text
claim: Briarfront has a more legible and cohesive low-poly 3D forest while retaining its active 3D renderer.
surface / route: Briarfront shared display /?player=screen and player view /?player=p1
visual backend and fallback reason: BROWSER_PRIMARY; no Windows fallback required
viewport / device / seat: 1280x720 desktop viewport; spectator and p1
baseline evidence: 01-before-shared-screen.png · SHA-256 26271C7CB7E4CFAD568250CE66056AD90B91939646009D8483D068157F119045
action: added world-space faceted terrain, riverbank dressing, bridge planks, health-jar framing, clearer actor geometry, water marks, and a restrained pixel render finish
expected visible change: flatter placeholder-like surfaces become a layered forest with clearer crossings and stronger silhouettes, while the shared and first-person cameras continue to render live 3D state
observed sequence: baseline shared frame → improved shared frame → two 700 ms-spaced frames → improved p1 perspective frame
typed observation: Three.js canvas display=block; Canvas2D fallback display=none; 1280x720; shared and player browser logs empty; three repeated-frame PNG digests unique
verdict: PASS for the static visual claim; UNKNOWN for precise motion cadence
named seam: MISSING visual.capture.ephemeral-rolling-buffer/v1; dark 16:9 gutters and couch-distance HUD text remain
buffer digest: 8B4C9C2187704FE1E0B646682389F2E1798F1F15EBABFA67C6399FB7891691E8 · D789B5701ED85A65316D73CFF7558CDDC870AAB9549137DDC7734D15904E4C48 · 28E9CE644D7C627B49CC91243FB84168F89F82460B2ACA4A34BC3C5041A6DBEF
temporary paths deleted: none; no raw recording or temporary buffer was created, and selected PNGs are deliberate durable proof
cleanup complete: yes
next cheapest test: capture and interact with the real phone/controller viewport, then repeat motion verification when the rolling-buffer hand is available
```

## Checks

- `briarfront-client` inline script compile: `PASS`
- `node tests/html-script-syntax-test.js`: `PASS` — 55 passed, 0 failed
- `node tools/game-hub/game-package-verifier.js`: `PASS` — 19 game folders, 0 failures, 41 declared warnings
- Repository-required checks: final rerun `PASS` for all ten declared commands
- `node verify.js` and `node hub/verify-plus.js` each initially reported one verification-spine failure, then passed unchanged on the final rerun after the generated verification receipt moved. Classified `MOVING_WORKSPACE` / verifier-state seam, not a Briarfront source regression.
- Remaining repository warning: `tools-index.json` is stale for current manifests/contracts/selftests. It was already modified outside this lane and was not regenerated here.

## Capability route

The normalized capability comparison is `DEGRADED`: required static render proof is `READY`; optional motion-cadence proof has one missing hand, `visual.capture.ephemeral-rolling-buffer/v1`. See `capability-requirements.json` and `capability-inventory.json`.
