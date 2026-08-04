# AXM AetherFX Visual Effect Fabric — Stewardship Action Report

**Version:** 1.3.0  
**Date:** 2026-07-28  
**Status:** **WORKING — verified local intake candidate**  
**Release theme:** Contract & Runtime Truth  
**Stewardship target:** preserve the 64-module creative fabric while making validation, import, recovery, adapter output, and reuse more truthful.

## Decision

The v1.2 direction and 64-module catalog were preserved. This release does not add decorative volume. It closes root contract defects that could make an apparently successful import, recipe review, accessibility mode, server launch, or adapter handoff less trustworthy than the interface implied.

## What changed

### 1. Raw input is reviewed before normalization

Raw recipes are structurally validated as submitted. Invalid raw documents are blocked without first being converted into a valid-looking default recipe. When a valid document would be changed by normalization, the review shows a bounded field-level diff and asks for explicit confirmation.

This separates two questions that were previously blurred:

- Is the submitted document valid?
- Which defaults or canonical forms will normalization apply?

### 2. Package import is sealed, bounded, and transactional

Sealed module and recipe packages require SHA-256 integrity. Validation rejects duplicate IDs, self-references, dependency/composite/derived/fallback cycles, unsafe renderer declarations, invalid CSS bindings, excessive generated counts, and oversized or excessively deep graphs.

Imports run against a staged registry. The live registry is replaced only after the entire package and resulting dependency closure validate. If a later module fails, earlier modules from that package are not left partially installed.

### 3. Recovery includes custom definitions

Named snapshots now capture both the recipe and custom modules. Restore validates the staged definitions and recipe before committing them together. Legacy recipe-only snapshots remain readable and are identified honestly; they do not pretend to restore definitions they never contained.

### 4. Accessibility behavior matches its declaration

Photosensitive-safe CSS selectors now target the sweep and shimmer layers actually emitted by the web adapter. Repeating sweep, shimmer, attention-beacon, reflection, and idle-pulse animation paths are suppressed in the protective mode.

Module accessibility metadata now carries an explicit `photosensitiveSafe` value across the catalog. This is protective design behavior, not a medical certification.

### 5. One canonical adapter contract

`schemas/resolved-visual-intent.schema.json` defines `axm.resolved-visual-intent/1`. Exports include the resolved scene, accessibility state, ordered operations, parameters, target role, fallback origin, and per-operation support status.

Target profiles distinguish:

- implemented
- approximated
- contract-only
- unsupported

The Studio can export both the canonical intent and an adapter support report. Static, Godot, Unity, web, and generic-game handoffs now share this vocabulary rather than implying silent parity.

### 6. Reusable runtime and CLI

The dependency-free runtime kit exposes validation, normalization, compilation, performance estimation, canonical intent generation, target-support reporting, transactional package review/import, custom-module registration, and full snapshots outside the creator UI.

Outputs:

- `dist/runtime/axm-aether-runtime.mjs`
- `dist/runtime/axm-aether-runtime.js`
- `tools/axmfx-cli.mjs`
- `integration/runtime/example.mjs`

The CLI validates, compiles, or inspects raw recipes and sealed recipe packages locally.

### 7. Adapter and server boundaries are more explicit

The static SVG adapter resolves derived and composite modules, applies quality fallback and parameter bounds, and reports unsupported interaction intent. It no longer describes a composite recipe as though only its top-level mold were active.

The local server rejects traversal and malformed encoded paths, enforces real-path containment, handles `GET` and `HEAD`, and applies a no-network content security policy for the local Studio.

The web shell forwards photosensitive-safe and large-text state. Renderer inputs are restricted to known types, scopes, interactions, class tokens, and bounded `--fx-*` or `--axm-*` custom-property bindings.

## Verification policy

Evidence was regenerated from the exact packaged v1.3 source state:

```bash
npm run verify
node integration/runtime/example.mjs
```

`npm run verify` passed **35 tests with 0 failures and 0 skips**. Catalog validation found **0 structural errors** and retained the expected **64 licence-review warnings**. The portable runtime example and CLI validation/inspection passed.

The v1.3 Chromium proof passed **13/13 assertions** with zero page errors, console errors, or HTTP(S) requests on desktop and phone, plus zero phone horizontal overflow. Computed sweep and shimmer animations changed from their active names to `none` in photosensitive-safe mode. A second frozen v1.3 capture exactly matched the visually inspected same-environment baseline. Browser and visual evidence identifies the tested distribution, browser, executable source, scope, and timestamp.

The generated files in `reports/` are the source of truth. Retained v1.2 screenshots and logs are labelled historical and do not substitute for the current evidence.

The catalog remains intentionally fixed at 64 modules. Public licences remain `UNSET`, so catalogue validation is expected to retain licence-review warnings until Mike makes an explicit sharing decision.

## Boundaries that remain

This build does not claim:

- native Unity, Unreal, Godot, Blender, After Effects, WebGL, PBR, or mobile renderer plugins
- a universal GLSL, HLSL, or WGSL compiler
- physically exact optical simulation
- pixel-identical output between web, SVG, and game engines
- medical photosensitivity certification
- a public marketplace, remote identity layer, or automatic cloud updates
- public sharing rights while licences remain `UNSET`

Class-based effects that resolve to the same web target still combine through that target's CSS class and variable surface. Duplicate use of the same class can therefore collapse visually. `targetRole` improves routing intent, but v1.3 is not a fully isolated per-instance render graph.

Godot Theme and Unity UI Toolkit outputs remain starter theme/token approximations. Target-support reports describe this boundary; they do not turn an approximation into a native implementation.

Community packages remain declarative data. They cannot inject package-supplied JavaScript or silently replace built-ins.

## Steward judgment

The strongest next growth step is real product integration. Use the portable runtime and canonical intent in one AXM surface, record operations that are approximated or unsupported, and implement only the adapter work demanded by that evidence.

**Recommended intake status:** `WORKING — verified local intake candidate`.
