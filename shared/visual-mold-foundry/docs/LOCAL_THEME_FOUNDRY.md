# LOCAL THEME FOUNDRY

## Purpose

The Theme Foundry allows local visual-language growth without changing the six protected package themes.

## Lifecycle

```text
Draft → QUARANTINED → APPROVED → ACTIVE → DEPRECATED / ARCHIVED
```

Approval and activation are separate. Imports always return to quarantine and require fresh local approval.

## Declarative fields

A theme may define semantic surfaces, text colors, accents, warning/success colors, panel/line/shadow colors, glow RGB, glass/noise strengths, contrast target, material language, motion character, low-power fallback, public scope, provenance, and compatible renderers.

## Rejected fields

Executable code, JavaScript, shaders, URLs, remote assets, and font files are outside the theme contract.

## Dependency rules

- a local child theme cannot activate while its local parent is inactive
- an active theme cannot be deprecated while an active child theme depends on it
- an active theme cannot be deprecated while an active extension declares it

## Portability

Theme packages, extension packages, workspaces, and family packages preserve local declarative themes. Imports remap IDs and quarantine the imported records.
