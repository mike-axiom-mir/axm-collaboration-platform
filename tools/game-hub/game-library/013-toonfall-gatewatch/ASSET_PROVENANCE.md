# Asset provenance

All visible game art is generated at runtime with first-party Canvas 2D drawing
code in `runtime/app.js`:

- Bloomvale terrain, river, paths, flowers, trees, cottages, clouds, and beacon;
- Scout Pippa, Moxie, Smudges, projectiles, pickups, and effects;
- story-card scenery and interface decoration.

No downloaded image, font, audio, model, texture, or external web asset is used.
Sound effects are optional local Web Audio oscillators. The implementation uses
only browser and Node.js platform APIs already present in the Workshop.
