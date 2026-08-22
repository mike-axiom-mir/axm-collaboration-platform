# Visual Authoring — v5

## Purpose

The authoring layer turns visual direction into inspectable data rather than burying it in scattered CSS overrides. It deliberately separates five responsibilities:

1. **Create:** Design Token Forge
2. **Validate:** Visual Contract
3. **Apply:** Composition Workbench
4. **Recommend:** Adaptive Orchestrator
5. **Verify:** Visual Drift Monitor

No single organ receives hidden authority over all five stages.

## Token packs

A token pack is code-free JSON. Supported fields map to a fixed allowlist of CSS custom properties. Values are rejected when they contain remote URLs, expressions, JavaScript schemes, semicolons, or braces.

```js
const tokens = new AXMDesignTokenForge({
  root: document,
  target: document.documentElement
});

const preview = tokens.preview("quiet-crystal"); // zero mutations
const applied = tokens.apply("quiet-crystal", document.documentElement, {
  approved: true
});
```

A local derived pack can be created from three hex anchors:

```js
tokens.derive("my-world", {
  primary: "#6ff7ff",
  secondary: "#9d78ff",
  luxury: "#ffd681"
});
```

Derivation registers data only. Applying it remains a separate approved action.

## Blueprints

A blueprint coordinates reviewed visual organs. It may specify:

- policy
- token pack
- scene
- engine configuration
- particle field
- performance budget
- transition
- finite cue
- local surface targets
- tags and provenance

```js
const preview = workbench.preview("quiet-proof");

if (preview.valid) {
  await workbench.apply("quiet-proof", {
    approved: true,
    transition: false,
    cue: false
  });
}
```

The Workbench refuses unapproved application and, by default, refuses to replace a surface already owned by another Surface Composer session.

## Ownership

Rollback compares the current state with the last state applied by the Workbench. Values still owned by the Workbench return to their prior values. Later platform changes are kept.

This is stronger than blindly reapplying a complete old snapshot, which could erase legitimate platform work performed after the composition was activated.

## Recommended practice

Author in a contained sandbox first. Validate under the intended policy. Review every selector match. Apply to one platform region. Test contrast, focus, motion, pointer behavior, old hardware, and rollback. Expand only after the small integration proves stable.
