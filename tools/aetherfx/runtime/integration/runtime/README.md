# Portable Runtime Kit

The v1.3 runtime is the reusable, renderer-neutral part of AetherFX. It lets another AXM app validate recipes, review/import sealed packages, compile the recursive graph, estimate load, create the canonical visual-intent contract, compare adapter support, and capture or restore a full recipe-plus-module snapshot.

It does not draw pixels by itself and does not claim native Godot, Unity, Unreal, WebGL, or PBR parity. A renderer consumes the resolved intent and must report what it implements, approximates, leaves as contract-only, or cannot support.

## Files

- `dist/runtime/axm-aether-runtime.mjs` — ES module for Node or modern bundlers
- `dist/runtime/axm-aether-runtime.js` — browser-global build exposing `globalThis.AXM`
- `tools/axmfx-cli.mjs` — local validate, compile, and inspect commands

## Node example

```js
import AXM from '../../dist/runtime/axm-aether-runtime.mjs';

const runtime = new AXM.AetherRuntime();
const recipe = runtime.recipe;
const compiled = runtime.compile(recipe);
const intent = runtime.intent({ target: 'generic-game-contract' });

console.log(compiled.plan.length, intent.supportSummary);
```

Run the included proof:

```bash
node integration/runtime/example.mjs
```

## CLI examples

```bash
npm run cli -- validate examples/recipes/command-dashboard.axmrecipe.json
npm run cli -- compile examples/recipes/command-dashboard.axmrecipe.json --target=web-css
npm run cli -- inspect examples/recipes/cinematic-glass-stage.axmrecipe.json --target=godot-theme
```

Raw recipes are validated before normalization. Sealed packages are cycle-checked and applied transactionally. A failed import does not leave earlier modules partially installed.
