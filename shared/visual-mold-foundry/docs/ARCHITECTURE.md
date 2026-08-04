# ARCHITECTURE — v0.6

```text
Human / AI intent
        ↓
32 protected molds or separate local extension/theme registries
        ↓
Deterministic sparse-inheritance resolver
        ↓
Typed controls + independent variants + governed theme
        ↓
Reusable organs + semantic tokens
        ↓
24 card recipes / living-skin renderer / portal-scene renderer
        ↓
23 checks + 18-case proof + parent-baseline comparison
        ↓
Preset / candidate / theme / extension / export packet
        ↓
Quarantine → explicit approval → release gate → activation
        ↓
Snapshot + comparison + rollback + portable workspace/family packets
        ↓
Project Composer / Data Batch Builder
        ↓
Static multi-visual output or integrity-checked assembly packet
```

## Layers

1. **Protected source registries** — 3 roots, 29 sparse child manifests, starter presets, six package themes, organs, tokens, schemas, and adapter mappings.
2. **Build resolver** — validates lineage, rejects cycles and missing parents, and produces a complete mold index plus direct-file browser bundle.
3. **Runtime core** — state, storage migration, snapshots, comparison, safe imports, deterministic packet fingerprints, and merge-only portability.
4. **Local growth registries** — candidates, local themes, and local extensions remain separate from protected package truth.
5. **Visual renderers** — 24 card-layout recipes, living materials, and portal-derived scenes.
6. **Proof and release** — 23 mold checks, 18 proof cases, parent-baseline regression comparison, warning acknowledgement, and explicit activation.
7. **Assembly layer** — separate project and batch registries compose validated mold instances without modifying package molds.
8. **Export and bridges** — browser-native outputs plus honest mapping scaffolds for six downstream targets.

## Two interfaces over one system

- **Use interface:** understandable controls, previews, proof, presets, themes, and exports.
- **Workshop interface:** manifests, inheritance, organs, tokens, provenance, approval, release evidence, lineage, and rollback.

## Protected package versus local growth

The protected package registry contains 32 molds and six themes. Local themes and local extensions use separate browser-storage registries. Only records that are both approved and active become selectable at runtime; inactive records remain preserved for inspection and repair.

## No executable import path

Portable theme and extension packets are declarative data. They cannot install JavaScript, arbitrary shaders, remote assets, fonts, or engine plugins. New renderer code or new organs require a reviewed package update.


## v0.6 assembly layer

`app/js/assembly.js` adds separate local project and batch registries above the protected mold system. It composes existing mold instances; it does not mutate protected registry entries. `app/js/assembly-ui.js` provides the browser interface.

## v0.6 assembly layer

The assembly layer sits above molds without changing protected registry manifests.

```text
Mold instances → Project Composer → project package / static HTML
Structured rows → Data Batch Builder → governed instances → project / batch package / static HTML
```

`app/js/assembly.js` owns data contracts, validation, lifecycle, packaging, import remapping, workspace integration, and health integration. `app/js/assembly-ui.js` owns the beginner-facing browser controls.

Projects and batches live in separate local-storage keys. They reference molds and themes by ID; they do not copy changes back into protected parents.
