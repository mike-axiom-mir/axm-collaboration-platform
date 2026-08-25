# Browser journey receipt — Twin Reactor co-op v0.2

Status: `TEST` observation of an `EXPERIMENTAL` detached candidate

Exact candidate packet: `sha256:b0f6e28229555e86e76c722357cf8b225048268137f3064659dcff28033f42f6`

Final preview session: `twin-reactor-coop-v2-21-review-r5`

Final preview URL at observation time: `http://127.0.0.1:52600/`

## Visible interaction journey

1. Loaded the final preview and confirmed both independent keyboard seats, their controls, facing markers, shared reactor, scores, enemy count, and proximity-link state were visible.
2. Moved the seats apart and together. The HUD and arena changed between separated and linked states without merging the seats.
3. Clicked the visible **Warden practice** control. The scene entered wave 3 with a visible Warden and boss health bar; the reactor began at `76`.
4. Fired visible directional energy bolts from the players. An earlier output iteration revealed that a bolt could tunnel through the Warden at spawn; the collision order was repaired and a focused countertest was added.
5. In the repaired live journey, the Warden was defeated: enemy count changed `1 → 0`, P1 score changed `0 → 5`, and the dropped repair core changed the shared reactor `76 → 88`.
6. Paused the final exact candidate on the visible Warden-practice scene. Pause now preserves the preceding event text.

The completed defeat-and-repair screenshot came from preview revision r4. Its `game.js` is byte-identical to final revision r5: `sha256:f38402c41637cf94371cfe76e6d21ce4fffa466b9f8c469959f7a855f2f38799`, `22164` bytes. The r5 delta was candidate-contract metadata, not game behavior.

## Evidence files

- `BROWSER_READY_CONTROLS.png` — final r5 ready state.
- `BROWSER_FINAL_WARDEN_PRACTICE.png` — final r5 visible practice state.
- `BROWSER_WARDEN_DEFEATED_REACTOR_REPAIRED.png` — byte-equivalent r4 completed journey.

## Honest boundary

- PASS: the visible interaction and state changes above.
- UNKNOWN: two-human fun and balance; Mike or another second player must judge it.
- UNKNOWN: frame-perfect timing and transient flicker because no rolling visual buffer was available.
- NOT CLAIMED: installation, publication, persistence, general game generation, promotion, or CANON.
