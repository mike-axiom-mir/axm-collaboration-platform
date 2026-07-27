# Capability-gap scout receipt — next 50 modules

## Requested outcome

Rank the next fifty modules that most increase AXM's ability to create, build, play, coordinate, and publish complete games, with PS2 as the minimum asset floor and evidence-gated progress toward PS3 and PS4.

## Current evidence used

- Hub source declares and tests twenty unique governed foundation modules across all five parents.
- Asset Hands roadmap reports thirty-four executable creation hands plus the delivery finisher; its prior fifteen-hand admitted list is complete.
- Current manifest inventory includes the PS2 Asset Forge, Studio, Spatial Studio, Audio Studio, Film & Motion Studio, Asset Fabric, Game Forge, Living World State Server, Foundation Planet, controller transport, review, recovery, diagnostics, packaging, signed release, AI Team, and the one-page Command Center.
- The PS2 Asset Forge has a real GLB source pool and optional PS3-style viewport post processing, but it still does not claim PS3 asset production.
- The existing Game Forge is strongest in 2D, packaging, lobby, and play-test flow; no current manifest declares the planned authoritative local 3D runtime capability.

## Comparator result

The selected Capability Gap Scout comparator was run against fifty normalized required capability IDs and a normalized inventory of fourteen relevant current capabilities.

```text
overall: BLOCKED
requirements: 50
blocked requirements: 50
missing capabilities: 50
proposed hands/contracts: 50
temporary comparison files cleaned: yes
```

`BLOCKED` describes the complete future production target, not this planning task. The ranked roadmap itself is ready to build.

## Gap classification

| Gap type | Count | Meaning in this roadmap |
|---|---:|---|
| HAND | 27 | A bounded creation, runtime, build, or publishing action is absent. |
| EVIDENCE | 9 | Work can be produced, but the important quality/performance/safety claim lacks the right independent proof surface. |
| SUBSTRATE | 7 | Shared runtime, job, codec, session, or storage machinery is absent. |
| CONTRACT | 3 | Existing components cannot yet exchange the required state without loss or ambiguity. |
| AUTHORITY | 2 | Rights or consent must be explicit before the capability may operate or publish. |
| SKILL | 2 | Repeatable visual or game-design judgment is missing even where tools exist. |

## Cheapest honest route

1. Reuse the existing parent Hubs, review, recovery, world, controller, asset, AI, and publishing services.
2. Build ranks 1–10 as one vertical playable slice rather than ten disconnected dashboards.
3. Improve the current PS2 Asset Forge through the ranked Create modules; do not create a duplicate PS3 Forge shell.
4. Add adapters only at explicit contracts. Optional free/open-source tooling may corroborate results but cannot become an undeclared mandatory runtime.
5. Promote one module at a time only after its `firstBuild` and all four acceptance obligations in `next-50-modules.json` pass.

## Next cheapest test

Before scaffolding all fifty modules, prototype the first three contracts together: load one approved Forge GLB into a minimal local 3D runtime through the round-trip bridge, then apply one baked PBR material. If scale, material, animation, offline behavior, and frame evidence survive, the highest-risk architecture is sound enough to continue through P0.
