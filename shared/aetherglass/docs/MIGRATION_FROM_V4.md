# Migration from v4 to v5

v5 preserves v4 behavior and adds optional authoring modules. Existing v4 integrations do not need to adopt them immediately.

## Safest route

1. Keep the existing v4 integration unchanged.
2. Store `rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v4_0_0_STABLE.zip` separately.
3. Replace matching v4 source files with v5 files only after a platform rollback exists.
4. Re-run the platform’s existing v4 tests.
5. Add `axm-authoring-studio.css` only when using the demonstration authoring UI.
6. Load the five new JavaScript modules after the established runtime organs.
7. Instantiate the Token Forge and Visual Contract first; both can operate without applying a composition.
8. Add the Workbench with a contained sandbox and preview only.
9. Keep the Adaptive Orchestrator in recommendation mode.
10. Capture a Drift Monitor baseline only after the reviewed state is accepted.

## New scripts

```html
<link rel="stylesheet" href="src/axm-authoring-studio.css">
<script src="src/axm-design-token-forge.js"></script>
<script src="src/axm-visual-contract.js"></script>
<script src="src/axm-composition-workbench.js"></script>
<script src="src/axm-adaptive-orchestrator.js"></script>
<script src="src/axm-visual-drift-monitor.js"></script>
```

The authoring CSS is optional. The JavaScript modules do not require it.

## Compatibility boundary

v5 does not silently import v4 preferences, modify selectors, or apply a default blueprint. Existing scenes and production presets remain separate from authored blueprints.
