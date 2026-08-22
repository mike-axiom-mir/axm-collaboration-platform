# Readability and Consistency

## Readability Guardian

The guardian samples computed text/background styling and calculates a contrast estimate. `audit()` is read-only. `apply()` adds ownership-tracked CSS variables/classes in either text or shield mode. `restore()` removes only changes still owned by the guardian.

It does not read semantic meaning, determine whether text is legally required, or certify WCAG compliance. Background imagery, compositing, video, canvas, and complex transparency can require human inspection.

## Consistency Auditor

The auditor reports practical integration seams:

- untreated control or surface candidates;
- touch targets below the configured size;
- excessive luminous-source count;
- excessive glass nesting;
- duplicate IDs;
- extreme z-index values;
- page-level horizontal overflow;
- readability issues from the guardian.

Its score is a triage aid, not an objective design-quality truth. Read-only is the default. Safe repairs remain explicit and rollback-scoped.

## Recommended acceptance

- Keyboard focus remains visible in every preset.
- Body text remains readable in full, reduced, and opaque transparency modes.
- Controls reach at least the platform's chosen target size.
- No content is hidden under glow, fog, field, transition, or sticky layers.
- Forced-colors and reduced-motion routes remain usable.
- A human reviews the highest-risk pages, not only the score.
