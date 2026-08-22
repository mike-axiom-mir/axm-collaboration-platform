# Migrating from v7.0 to v7.1

v7.1 preserves all v7.0 public engine, production, authoring, Storycraft, and capture APIs. The additions are optional.

1. Keep `rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v7_0_0_STABLE.zip` untouched.
2. Add `src/axm-luminous-layer-forge.css` after the existing luminous architecture CSS.
3. Add `src/axm-luminous-layer-forge.js` after Lighting Director.
4. Mount the forge only after the core engine is mounted. Start with `quiet-aura` for an existing platform.
5. If Runtime Supervisor is used, connect the module as `lightLayers` so health, snapshot, and restore include its configuration.
6. Exported studio compositions now include `luminousLayers` as a separate optional object.
7. The production/runtime browser inventory grows from 178 to 190 assertions; combined inventory is 320.
8. The offline Product Design workflow is independent of runtime intake. Use its launcher when a human or AI needs a guarded design run.
9. Do not treat static validation as visual approval. Run browser validation and compare the real platform state before replacing v7.0.

Removing the new CSS/JavaScript include and forge mount returns the runtime architecture to v7.0 behavior. The local design workflow does not affect runtime unless someone explicitly runs it.
