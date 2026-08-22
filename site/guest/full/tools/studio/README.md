# AXM Studio v2.3

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

## Shared Creation Hands

Studio embeds the same Asset Hands workbench used by Asset Fabric and available
to future Workshop modules. A versioned brief exposes only hands compatible with
its asset kind, target canvas, required outputs, accepted schemas and available
runtime capabilities.

Studio supplies a target-canvas default for the active mode and preserves the
result's target canvas, editable recipe and validation receipt on the created
layer. SVG and raster image artifacts follow separate MIME-checked imports;
JSON, DXF and other non-image containers are not disguised as SVG. Physical
results can still be inspected and exported from the embedded workbench even
when Studio's layered screen canvas cannot import them visually.

Sending a result into Studio is always explicit. Layered-composition packets
pass through Studio's existing reviewed draw-command engine. Project saves keep
the hand ID/version, result/artifact digests, target canvas, creation recipe and
validation receipt.

## Boundaries

- Studio proposals do not write directly into game packages.
- UI/UX output remains proposal-only until reviewed.
- Skins remain data and pass the existing safety/readability gate.
- Asset packs remain honest manifest exports until an installer exists.
- Existing local records and compatibility routes are preserved.
