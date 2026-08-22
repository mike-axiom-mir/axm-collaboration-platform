# AXM AetherFX Workshop integration

This capsule admits the complete AetherFX Visual Effect Fabric v1.3.0 as an
inspectable local Workshop tool. The release stays under `runtime/`; the
Workshop manifest, contract, ownership map, CLI route, upstream checksum set,
and integration selftest live at this folder's root.

## Open it

Start the Workshop and open **AXM AetherFX Visual Effect Fabric** from the
launcher. The declared entry is the fully bundled offline Studio:

`/tools/aetherfx/runtime/OPEN_STUDIO.html`

The Studio stores recipes, custom modules, and snapshots in browser-local
storage. Imports, downloads, clipboard writes, repair, package commits, and
host integration remain explicit actions.

## Use the portable runtime and CLI

The renderer-neutral ESM runtime is available at:

`tools/aetherfx/runtime/dist/runtime/axm-aether-runtime.mjs`

From the Workshop root:

```powershell
npm run aetherfx -- validate tools/aetherfx/runtime/examples/recipes/command-dashboard.axmrecipe.json
npm run aetherfx -- inspect tools/aetherfx/runtime/examples/recipes/cinematic-glass-stage.axmrecipe.json --target=static-svg
npm run aetherfx -- compile tools/aetherfx/runtime/examples/recipes/luminous-hero.axmrecipe.json --target=web-css
```

CLI output is printed unless the source CLI receives an explicit `--out=...`
path. No package-supplied code is executed.

## Verify it

```powershell
npm run test:aetherfx
```

The selftest verifies the Workshop contract, all 170 integrated source
checksums, the exact two-file platform patch, all 36 Node tests, a real runtime
compile, positive and negative CLI paths, local-only bundled Studio boundaries,
and the 64-module catalog.

The status is `TEST`, not CANON. Web rendering is a CSS/DOM implementation;
SVG, Godot, Unity, and game handoffs keep their explicit approximation or
contract-only labels. Public licences remain unset and appearance still needs
human review.

See `integration-map.json` for admitted capabilities and ownership boundaries.
The bounded local desktop, Guide, protection-state, and phone-layout observation
is recorded in `BROWSER_INTAKE_RECEIPT.md`.
