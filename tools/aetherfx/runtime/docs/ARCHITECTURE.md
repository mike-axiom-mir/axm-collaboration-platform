# Architecture

## Governing pattern

```text
Primitives → Effects → Organs → Molds → Scenes → Products
```

The top-level controls remain intentionally small. Internally, every visible result resolves into a dependency-aware render plan.

## Core objects

### Module

A module is a versioned visual capability. It can be a primitive, effect, organ, mold, or scene. A module never relies on its display name as identity; references use stable IDs.

### Recipe

A recipe is an ordered list of module instances plus scene and global controls. Each instance has its own ID, enabled state, and parameter values.

### Registry

The registry stores built-ins and user-created modules separately. Built-ins cannot be deleted or silently replaced. Custom modules can be versioned and exported. Package import and snapshot restore use a cloned staging registry and replace the live registry only after the full candidate state validates.

### Composer

The composer normalizes recipes, validates references, applies quality decisions, recursively expands derived/composite modules, resolves exclusive groups, and produces a flat render plan.

### Adapter

An adapter translates that render plan into one rendering environment. The working web adapter maps intent to DOM structure, CSS classes, bounded CSS custom properties, overlays, and known interaction handlers.

### Canonical intent

`AXM.Intent` converts a valid compiled plan into `axm.resolved-visual-intent/1`. Each ordered operation carries its renderer declaration, resolved parameters, optional `targetRole`, fallback origin, and target-support status. This contract is the handoff boundary for web, static, Godot, Unity, and future native adapters.

### Portable runtime

`AXM.AetherRuntime` exposes registry, validation, normalization, compilation, performance estimation, package review/import, snapshots, canonical intent, and target-support reporting without the Studio UI. Generated browser-global and ES-module builds live under `dist/runtime/`.

## Resolution flow

1. Validate the raw submitted recipe before normalization.
2. Display and explicitly accept any normalization changes.
3. Validate scene, instances, parameters, and references.
4. Resolve requested or adaptive quality.
5. Walk each active module recursively within depth and output budgets.
6. Replace disabled modules with declared fallbacks when available.
7. Expand derived and composite relationships.
8. Resolve exclusive groups in ordered-stack order.
9. Produce a flat plan and canonical intent.
10. Pass supported operations to the active adapter and report approximations or unsupported work.
11. Surface errors, warnings, fallback decisions, support status, and resolved module count.

## Compound creation without loss

A derived module stores a base-module relationship and tuned defaults. A composite stores child module references and parameters. Neither route silently flattens the source structure. This is the foundation of the recursive loop:

```text
create → test → save as module → reuse → combine → create stronger module
```

## Trust boundaries

- Module packages are declarative JSON, not executable script bundles.
- Sealed imports require SHA-256 integrity.
- The importer validates shape, renderer bounds, dependencies, cycles, entry identity, closure limits, and integrity against a staging registry before atomic commit.
- Built-in definitions are compared canonically; altered copies are rejected.
- Provenance and license fields travel with modules.
- Public-sharing consent is not inferred from file creation.

## Local-first data

The studio saves the current recipe, custom modules, and snapshots in browser-local storage. A current snapshot contains both recipe and custom definitions. Exported files are the portable continuity layer. No account, cloud, analytics, or outside runtime connection is required.

## Deliberate renderer limit

The resolved plan has per-operation identity, but class-based web effects that share one target also share that target's CSS class and variable surface. Multiple instances of the same class may therefore collapse visually. `targetRole` allows a renderer to route operations to more specific surfaces; it is not a claim of complete per-instance isolation.
