# Holodeck Composer

Status: `TEST` human interface.

Composer exposes a deliberately small, friendly subset of the canonical Echo Atrium world: title, objective, atmosphere colors, beacon colors and scale, accent color, gate color, beacon position, starting distance, and fog distance. Every edit is applied to a clone of the template, validated through `axm.holodeck-world/v1`, compiled through the real Holodeck compiler, and rendered through the replaceable Screen Deck adapter.

The preview has two explicit authority modes. **Player** dispatches world-changing human intents. **Observer** owns only the disposable camera projection: orbit, height, zoom, and viewpoint presets produce `axm.holodeck-camera-receipt/v1` receipts whose before/after world revision is identical. Returning to Player restores the actor camera at the same world state.

Edits remain temporary unless **Save draft here** or **Download world** is explicitly selected. Reload resets to the template. Saved drafts are never promoted into Workshop truth automatically.

Open through the Workshop server:

```text
http://127.0.0.1:8788/tools/holodeck-composer/index.html
```

This version intentionally does not provide arbitrary world import, entity creation/deletion, complete rule editing, asset selection, VR, hologram hardware, or physical-space control.
