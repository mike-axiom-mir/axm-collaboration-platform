# PR14 source trace — Creative Studio Classes

GitHub was inspected read-only. No repository mutation was made.

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Pull request: `#14`
- PR head: `d427a35f3dafa500d40ff66b86cb464563e4e42b`
- Source file: `tools/studio/engine.html`
- Source blob observed: `ede45acc2eea661e86623eb49557d433a6f75d25`

## Observed contract

The Studio source declares a single tool registry with these human-facing tools:

- Paint: brush, pencil, airbrush, eraser, smudge
- Shape: line, rect, circle, polygon, fill, gradient
- Tone: blur, sharpen, dodge, burn
- Detail: pick, text

The machine draw path accepts `axm.drawpacket/v1` and applies it through the same `runDraw` and multi-layer engine used by live AI seats.

Observed machine operations:

- stroke
- erase
- line
- rect
- circle
- dot
- fill
- polygon
- gradient
- text
- blur
- dodge
- burn
- sticker
- newlayer
- movelayer
- shiftlayer

Observed boundaries preserved by this build:

- canvas is 600 × 600;
- numeric coordinates remain inside 0..600;
- maximum 14 commands per turn;
- machine work stays on its assigned AI layer;
- erase and multiple layers are legitimate repair tools;
- screenshot input is part of Studio AI turns;
- valid JSON failure remains visible instead of being guessed through;
- wisdom is optional and only filed when a real lesson occurred.

## Local extension

The Learning Forge adds a curriculum and static grader around that existing Studio contract. It does not change the Studio, connect to it, or grant pixel authority.
