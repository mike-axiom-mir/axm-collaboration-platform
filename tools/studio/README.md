# AXM Studio v2

AXM Studio is the single user-facing 2D and interface workspace.

## Modes

- Drawing & Painting
- Vector Graphics
- Pixel Art & Animation
- Photo, Collage & Compositing
- Textures & Patterns
- Typography & Type Design
- Graphic Design & Story Layout
- UI/UX & Web Design
- Skin Production
- Asset Pack Production

The first seven modes share the same persistent layered canvas in `engine.html`.
UI/UX Builder, Skinner and Asset Pack Lab keep their existing storage formats and
are mounted as Studio modes. Their old URLs remain compatibility routes.

Vector mode has a non-destructive object layer. Paths are created point by point,
remain node-editable, support open/closed, smooth, fill, stroke, duplication and
SVG export, and are included in normal PNG composites.

Pixel mode has a persistent frame timeline. Every frame retains the full raster
layer stack and its own duration. Frames can be added, duplicated, deleted,
onion-skinned and played, then exported as a PNG spritesheet plus JSON timing map.

Asset Vault is opened as Studio's shared library drawer. It is a service behind
the creative workflow, not another creative product a beginner must learn.

## Boundaries

- Studio proposals do not write directly into game packages.
- UI/UX output remains proposal-only until reviewed.
- Skins remain data and pass the existing safety/readability gate.
- Asset packs remain honest manifest exports until an installer exists.
- Existing local records and compatibility routes are preserved.
