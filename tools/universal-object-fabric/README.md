# Universal Object Fabric

This TEST-status Workshop tool is the read-only front door for the accepted Axiom/Mir v0.7.0 handoff.

It exposes all ten staged game assets through exact `asset_id + asset_version` resolution, keeps Runtime Capsules and reversible visual-skin bindings visible, and points receiving projects to the shipped Three.js and Godot bridge sources.

The complete accepted source remains byte-for-byte preserved as a ZIP under `intakes/universal-object-fabric-v0.7.0-2026-07-28/source/`. The consumable game stage is separate and contains no STL or 3MF files.

Run:

```bash
node tools/universal-object-fabric/selftest.js
```

Boundaries: no active-game write, no automatic physics or gameplay, no renderer-quality claim, no manufacturing/robotics authority, and no canon promotion. Godot is source-tested only.
