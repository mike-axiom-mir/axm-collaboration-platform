# Empty venue shells

Version 0.2.2 adds two **empty, enterable ground-floor shells** near Tilburg City Centre. They are deliberately not a casino and contain no activity, gambling, ownership, shop, NPC-flow or economy logic.

## Small venue shell

- Building ID: `small-venue-shell`
- Interior zone: `small-venue-interior`
- Exterior: `x 5904, y 4272, 336 × 240`
- Usable floor: `x 5916, y 4284, 312 × 216`
- Door: north wall, 64 pixels wide
- Status: `floor_ready`
- Intended role: a compact future shop, side room or small game module

## Large venue shell

- Building ID: `large-venue-shell`
- Interior zone: `large-venue-interior`
- Exterior: `x 6528, y 4352, 768 × 480`
- Usable floor: `x 6540, y 4364, 744 × 456`
- Door: north wall, 96 pixels wide
- Status: `floor_ready`
- Intended role: a future large venue such as the planned casino, without committing that content yet

## Runtime contract

Both entries use `type: "walkable_building"`, `walkable: true`, a stable `interiorZoneId`, a normal world-space floor and host-authoritative collision walls. They are part of the same streamed outdoor world; entering does not teleport players, replace the camera or create a separate simulation.

`data/map.json.layers.interior_zones` is the future attachment seam. `contentModule` is explicitly `null` in this release. A later module can claim a shell by stable zone ID and add furniture, machines, NPC anchors, activities and interaction zones without changing the building or doorway contract.

The shells are not Party House bases, safe zones or regeneration areas. Normal world combat and 1 HP/second regeneration rules therefore continue inside them until a later module explicitly introduces a different host-owned rule.

## Collision compilation

The two declared gameplay clearings remove pre-existing source-derived roof, water and collision rectangles beneath the handcrafted floors. Global wall rectangles then restore only the intended perimeter collision, leaving each doorway and interior path open. `tests/open-interiors.test.js` checks the floor centres, both sides of both doors, solid side walls, empty content-module state and absence of accidental base/safe-zone behavior.
