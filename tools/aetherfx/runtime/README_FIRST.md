# AXM AetherFX Visual Effect Fabric v1.3.0

**Status:** WORKING — verified local intake candidate  
**Creator:** Mike — Axiom/Mir  
**Purpose:** Build visual effects as reusable parts, combine them into organs, molds, and scenes, and let those creations become stronger future building blocks.

## Open it

Open `OPEN_STUDIO.html`. It is the fully bundled local studio and makes no outside runtime requests.

Alternative launchers:

- `START_STUDIO.bat` — Windows
- `START_STUDIO.sh` — macOS/Linux
- `dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html` — versioned bundle

## What is working

- **64 canonical modules:** 11 primitives, 36 effects, 7 organs, 6 molds, and 4 scenes.
- Typed visual parameters, explicit dependencies, quality fallbacks, provenance, package integrity, and rollback-safe local editing.
- Guided Creation that translates human goals into an inspectable scene recipe rather than hiding the generated stack.
- Recursive composites with bounded promoted controls and explicit parent-to-child bindings.
- Raw-recipe review validates the submitted document before normalization and shows every normalization change before confirmation.
- Sealed module and recipe packages are integrity-required, cycle-checked, bounded, and imported transactionally.
- Dependency Graph, Performance Inspector, Repair Center, and review-before-mutation import flow.
- Manual quality plus adaptive `Auto` quality with battery, balanced, and quality biases.
- Reduced motion, high contrast, large text, and photosensitive-safe protection modes.
- Raw recipe, sealed package, standalone HTML, Web Component, CSS tokens, canonical visual-intent JSON, target-support report, SVG, Godot Theme, and Unity UI Toolkit starter outputs.
- A reusable renderer-neutral runtime and local CLI under `dist/runtime/` and `tools/`.
- Practical integration helpers under `integration/`, including a runtime example.
- Deterministic stress, contract, server-boundary, integration, desktop, phone, and visual-regression test paths.

## Beginner workflow

1. Open **Guide**.
2. Choose the goal, mood, energy, device target, and protection needs.
3. Generate the scene.
4. Use **Graph** to see the parts underneath.
5. Use **Performance** to identify expensive layers.
6. Tune or remove only what is necessary.
7. Create a derived module or composite when the result is reusable.
8. Validate, snapshot, and export.

## Honest boundary

The web adapter and Web Component route render CSS/DOM approximations. SVG, Godot Theme, and Unity UI Toolkit outputs are practical handoffs, not full native shader/runtime plugins, PBR implementations, or pixel-identical cross-engine renderers.

Class-based effects on the same target still share that target's CSS style surface. `targetRole` makes intent more explicit, but v1.3 does not claim a fully isolated per-instance render graph.

Public licences are intentionally `UNSET`. Integrity proves file consistency, not ownership, consent, or redistribution rights.

## Folder map

```text
AXM_AETHERFX_VISUAL_EFFECT_FABRIC_v1_3_0/
├── OPEN_STUDIO.html          fully bundled local studio
├── catalog/                  canonical 64-module catalog
├── src/                      composer, creator, validator, repair, and adapters
├── styles/                   canonical studio and runtime styling
├── packages/                 sealed starter and v1.1 optical expansion packs
├── integration/              runtime, web, Godot, Unity, and static bridges
├── examples/                 editable recipes and adapter examples
├── schemas/                  portable declarative contracts
├── tests/                    structural, stress, integration, browser, and visual tests
├── tools/                    reproducible build and verification tools
├── reports/                  regenerated evidence plus inherited labelled baselines
└── docs/                     architecture, governance, formats, and limits
```

Start with `START_HERE.md`, then use `QUICK_START.md` beside the studio.
