# Module and Package Specification

## Module schema

Schema identifier: `axm.visual-module/1`

Required structural fields:

- `id`: stable lowercase identifier.
- `name`, `version`, `kind`, `category`, `status`.
- `dependencies`: referenced module IDs.
- `parameters`: typed controls with defaults and optional bounds.
- `renderer`: declarative adapter intent.
- `quality`: low, medium, high, and cinematic behavior.
- `accessibility`: reduced-motion, contrast, and photosensitive-safety behavior.
- `provenance`: author, origin, license, date, source-integrity note.

## Renderer types in v1

- `capability`: non-rendering primitive used by dependencies.
- `class`: adds a declared class and parameter variables to a target scope.
- `overlay`: creates a bounded visual layer in a declared scope.
- `interaction`: attaches a known, adapter-owned interaction behavior.
- `derived`: resolves to a base module with tuned parameters.
- `composite`: resolves to an ordered child-module graph.
- `scene`: supplies scene structure through the scene renderer.

Packages do not carry arbitrary JavaScript. Renderer types, target scopes, class tokens, interactions, and generated-layer counts are validated against bounded v1 declarations. CSS parameter bindings are restricted to compatible number or color controls and `--fx-*` or `--axm-*` custom properties. New executable renderer behavior belongs in a reviewed adapter release, not inside an imported community package.

## Composite bindings in v1.1

A composite child layer may contain a `bindings` object:

```json
{
  "moduleId": "light.neon-edge-glow",
  "params": { "intensity": 0.45 },
  "bindings": { "intensity": "layer1.intensity" }
}
```

The key is the child parameter ID. The value is a parameter exposed by the parent composite. Both sides are validated. This allows a complex mold to retain simple top-level controls without flattening or hiding its child graph.

## Parameter types

`number`, `boolean`, `select`, `color`, and `text` are supported. Number definitions may include `min`, `max`, `step`, `unit`, and a target CSS variable. Select definitions declare an option list.

## Module package

Schema identifier: `axm.visual-module-package/1`

A package contains:

- package identity and version
- `entryModuleId`
- entry plus dependency closure
- compatibility declarations
- sharing review state
- integrity metadata

Integrity is required for sealed import and is calculated over canonical JSON after removing the `integrity` field. SHA-256 is used through Web Crypto when available and through the bundled dependency-free cryptographic implementation in restricted local contexts.

## Recipe package

Schema identifier: `axm.visual-recipe-package/1`

A recipe package contains:

- the recipe
- bundled custom dependencies
- required built-in IDs
- sharing review state
- integrity metadata

This prevents duplicating every built-in definition while preserving custom work. Recipe-package integrity is required before review can proceed.

## Import transaction and graph bounds

The importer validates the complete package against a cloned registry before commit. Duplicate IDs, self-references, dependency/composite/derived/fallback cycles, altered built-ins, unsafe renderer declarations, excessive graph depth, and package or layer limits reject the package. Rejection leaves the live registry unchanged.

## Version policy

v1 uses semantic versions. A package importer must never overwrite a built-in with a non-identical definition. Breaking schema changes require a new schema identifier. Parameter changes that break existing recipes require a major module version.

## Local cryptographic compatibility

The studio uses Web Crypto SHA-256 when the browser exposes it. Local or embedded contexts that do not expose `crypto.subtle` use the included dependency-free SHA-256 implementation. Both routes produce the same digest; the system does not downgrade integrity to a non-cryptographic checksum.
