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

## v0.6.5 procedural polish pass

Still zero external assets — everything below is canvas 2D API calls
(`createRadialGradient`, `shadowBlur`/`shadowColor`), no images, no fonts:

- A soft radial gradient vignette behind the existing background grid, so
  the play field reads as the lit center of a room instead of shapes on
  flat black.
- The hull gauge gained a dim full-circle track ring behind its colored
  progress arc (previously the arc had no reference for "out of what"),
  plus a glow in the same color as the arc.
- Stations get a persistent soft glow (previously only idle stations
  pulsed) and a subtle two-stop radial gradient fill instead of one flat
  color.
- Fault countdown rings, the effort-progress ring, and player tokens all
  gained a matching-color glow (`shadowBlur`) for a more "powered/neon"
  feel appropriate to the sci-fi UI already established by the palette.

All of the above is explicitly skipped under high contrast (`theme-high-
contrast`) — that mode's entire purpose is maximum legibility against pure
black, and gradients/glow would work against it, so the high-contrast
render path stays exactly as flat and maximum-contrast as before. Verified
live via the `ai-seat-courier`, not just by reading the source — see
`evidence/visual/05-visual-polish-glow-vignette-normal.png` and
`06-visual-polish-high-contrast-unaffected.png`.
