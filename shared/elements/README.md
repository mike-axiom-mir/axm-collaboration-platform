# AXM Modular Elements

Elements are AXM's small, typed vocabulary beneath components and modules.
They do not replace assets, hands, components, modules or organs:

```text
raw assets/data -> elements -> components -> modules -> organisms/experiences
```

An element can describe a panel, light, state gate, camera anchor, timeline cue,
content record or fabrication region. The category registry prevents the word
"element" from silently collapsing into "UI widget".

## Important separation

Each element declares one or more independently replaceable facets:

- `behavior` -- states and declarative transitions, never embedded code;
- `content` -- semantic data and named slots;
- `appearance` -- visual tokens and presentation variants;
- `spatial` -- transforms, bounds, anchors and regions;
- `temporal` -- clips, tracks, cues and timing;
- `physical` -- materials, tolerances and fabrication constraints.

The category registry determines which facets are meaningful and declares the
verifier route that must eventually own each category. Those route identifiers
are not executable verifier implementations. A technically valid visual or
fabrication element still does not claim aesthetic or manufacturing approval.

## Universal Component Protocol bridge

`element-protocol.js` converts any valid exact-version element into an immutable
UCP component. That means larger AXM compositions reuse the existing typed-port,
canvas, provenance, resource and receipt machinery instead of inventing a
parallel universal protocol.

Element composition receipts remain contract-only:

- they do not claim that the composition executed or rendered;
- they do not claim visual approval;
- they do not install or promote anything;
- missing elements, incompatible categories and unsupported targets fail closed.

## Files

- `category-registry.json` -- the eight initial neutral element families;
- `element.schema.json` -- exact element record;
- `element-composition.schema.json` -- typed element composition graph;
- `element-receipt.schema.json` -- sealed contract-only receipt;
- `element-protocol.js` -- validator, registry, composer and UCP adapter;
- `core-element-seeds.json` -- deterministic starter vocabulary;
- `selftest.js` -- executable contract and boundary checks.
- `dual-operator-command-deck.css` -- reusable twin-seat cockpit, route, metric,
  instrument-vault and command-line presentation elements. It contains no
  routes, service state or authority; owning modules bind those explicitly.
- `axm-ui-theme.css` -- reusable space-canvas, panel, tile, pill, metric and
  control primitives promoted from the Command Deck concept export. Styling
  only; it carries no routes, service state, permissions or authority.
- `axm-ui-fx.css` and `axm-ui-fx.js` -- composable TEST appearance layers
  promoted from the UI-FX export. They default to Visual Kernel brand tokens,
  respect reduced motion and carry no host-apply or appearance-approval authority.

The Element Foundry at `tools/element-foundry/` is a human-machine composition
surface. Browser previews are deliberately not technical or aesthetic proof.
