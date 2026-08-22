# Universal Object Fabric

This TEST-status Workshop tool is the read-only front door for the accepted Axiom/Mir v0.7.0 handoff.

It exposes all ten staged game assets through exact `asset_id + asset_version` resolution, keeps Runtime Capsules and reversible visual-skin bindings visible, and points receiving projects to the shipped Three.js and Godot bridge sources.

The reviewed game stage now lives under `shared/universal-object-fabric/source-stage-v0.7/`. The complete accepted source ZIP is retained in the local intake archive; its signed digest receipt remains with the shared stage. The consumable game stage contains no STL or 3MF files.

Run:

```bash
node tools/universal-object-fabric/selftest.js
```

Boundaries: no active-game write, no automatic physics or gameplay, no renderer-quality claim, no manufacturing/robotics authority, and no canon promotion. Godot is source-tested only.
