# Asset Provenance — Brace Room

**Decision: zero third-party art.** This game ships with no external image,
audio, or font assets.

All visuals are flat vector shapes drawn directly to the HTML5 canvas at
runtime (`runtime/app.js`, function `render()` / `drawShape()`):

- Stations are drawn as squares, triangles, diamonds, or ringed circles
  (one shape per resolve-verb, so shape — not just color — tells you what
  a station needs).
- Player tokens are solid circles in per-seat colors with a numeral drawn
  on top.
- The Hull Integrity gauge is an arc drawn with the canvas 2D API.
- Fault countdown rings and effort-progress fill are drawn arcs/circles,
  not sprites.

Typography uses the system font stack declared in `runtime/styles.css`
(`'Segoe UI', system-ui, -apple-system, sans-serif`) — no bundled font
files.

No CC0 asset sites were used for this build. If a later polish pass wants
richer art (a real station illustration, ship background art, etc.), the
three CC0 sources Mike sourced separately are the first stop then — this
file should be updated at that point with source, license, and retrieval
records in the same format `008-district-party/game.manifest.json` uses
for its Kenney pack pulls.
