# Asset provenance

All visible game art is generated at runtime with first-party WebGL and Canvas
drawing code in `runtime/bloomvale-three.js` and `runtime/app.js`:

- Bloomvale terrain, river, paths, flowers, trees, cottages, clouds, and beacon;
- Scout Pippa, Moxie, Smudges, projectiles, pickups, and effects;
- story-card scenery and interface decoration.
- low-poly district mesas, roads, rift gates, trees, Heartlight tower, and the
  final Crown marker, built from runtime triangles with no model or texture.

No downloaded image, font, audio, model, texture, or external web asset is used.
Sound effects are optional local Web Audio oscillators. The implementation uses
only browser and Node.js platform APIs already present in the Workshop.
