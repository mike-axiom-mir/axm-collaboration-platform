# AXM Presentation Spine

The Presentation Spine is the shared visual vocabulary for AXM surfaces. It makes the platform feel like one capable system without pretending every tool has the same job.

Four profiles are intentionally distinct:

- **Cockpit** — command, live state, telemetry and dense operator routes.
- **Studio** — creative tools where the canvas must remain authoritative.
- **Dashboard** — overview, discovery, growth and navigation.
- **Lab** — evidence, comparison and bounded experiments.

Add the stylesheet and opt the page in:

```html
<link rel="stylesheet" href="/shared/presentation-spine/presentation-spine.css">
<body class="axm-spine" data-axm-profile="dashboard">
```

The JavaScript helper is optional. It can switch a profile in memory, but it has no storage, file, permission, execution or approval authority.

## Shared by default, module by choice

The Hub is the presentation control plane. When it opens a same-origin module it resolves `axm.presentation-policy/v1` and applies one of two modes:

- **Shared** — the module receives the shared visual kernel, an appropriate profile and the scoped host layer. This is the default.
- **Module** — the module keeps the visual design supplied by its creator. The Hub restores the module's original profile and does not repaint its behavior.

The user may switch the active module between those modes in the Hub. The preference survives reloads. A module can declare a preferred shared profile and whether it has a meaningful module-owned visual:

```json
"presentation": {
  "schema": "axm.presentation-policy/v1",
  "defaultMode": "shared",
  "sharedProfile": "studio",
  "moduleVisual": true
}
```

This is presentation authority only. It never changes module truth, permissions, lifecycle, data, routes, verification status or runtime authority. Direct module URLs also remain valid and show the module's own page normally.

## Portable presentation recipes

`axm.presentation-recipe/v1` composes the shared profile with five independent, bounded layers:

- `surface`: glass, solid or minimal
- `depth`: flat, raised or dimensional
- `motion`: still, responsive or ambient
- `density`: compact, balanced or comfortable
- `signal`: quiet, clear or luminous

The recipe is data only. It cannot carry CSS, scripts, selectors, HTML, behavior, runtime or permission changes. The Hub applies it only to same-origin modules that are in **Shared** mode, and restores the module's original attributes in **Module** mode.

```json
{
  "schema": "axm.presentation-recipe/v1",
  "id": "shared-workshop",
  "name": "Shared Workshop",
  "author": "Mike + AXM",
  "profile": "auto",
  "layers": {
    "surface": "glass",
    "depth": "raised",
    "motion": "responsive",
    "density": "balanced",
    "signal": "clear"
  },
  "authority": "presentation-only"
}
```

This does not replace the existing systems:

- **Skinner (`axm.skin/v1`)** owns base colors, fonts, local assets and layout slots.
- **Presentation recipes** own portable platform-level emphasis and feel.
- **UI-FX** remains the lower-level composable effects library used by authored surfaces.

Together they form a reusable skin-manipulation stack without making appearance authoritative.

`migration-scanner.js` is deterministic and read-only. It inventories HTML surfaces, proposes a profile and reports missing seams. It does not rewrite files or approve appearance.
