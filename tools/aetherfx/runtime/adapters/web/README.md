# Web Adapter

The production web adapter lives at `src/adapters/web-adapter.js`. It accepts the composer's bounded flat plan and owns all DOM/CSS behavior. Portable packages declare only known renderer types, scopes, class tokens, interactions, and bounded CSS custom-property bindings.

Supported target scopes include stage, scene, surfaces, active elements, loading elements, ambient layer, light layer, and atmosphere layer. Optional `targetRole` can route an operation to a more specific declared surface. Interactions are bounded to pointer spotlight, click ripple, and multi-plane parallax handlers implemented by the adapter.

Use the single-file studio for a complete working example. `index.html` is the readable multi-file development form.

Class-based effects on one target share that target's CSS class and custom-property surface. Multiple instances of the same class can collapse visually; the v1.3 contract does not claim full per-instance render isolation.
