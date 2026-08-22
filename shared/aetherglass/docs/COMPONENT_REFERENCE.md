# AXM Aetherglass 7.1 — Component Reference

`src/axm-components.css` is optional. It provides a coherent professional layer that uses the core Aetherglass tokens without requiring a framework.

## Layout

| Class | Purpose |
|---|---|
| `.axm-bento` | Twelve-column responsive grid |
| `.axm-span-3` through `.axm-span-12` | Grid span helpers |
| `.axm-stack` | Vertical stack |
| `.axm-cluster` | Wrapping horizontal group |
| `.axm-split` | Space-between row |

At 680 px and below, bento items become one zero-minimum column. Wide internal tables remain inside local horizontal scroll containers instead of widening the page.

## Surface hierarchy

| Class | Purpose |
|---|---|
| `.axm-glass` | Standard reactive glass surface |
| `.axm-glass--quiet` | Lower-intensity supporting surface |
| `.axm-glass--luminous` | Strong focal surface |
| `.axm-glass--solid` | More opaque dialog or dense-content surface |
| `.axm-glass--outlined` | Border-led surface |
| `.axm-glass--prismatic` | Spectral focal surface |
| `.axm-elevate` | Restrained hover depth |
| `.axm-tilt` or `[data-axm-tilt]` | Explicit tilt target for Interaction FX |

## Navigation and toolbars

- `.axm-navigation`
- `.axm-toolbar`
- `.axm-toolbar__group`
- `.axm-toolbar__separator`
- `.axm-brand`
- `.axm-brand__mark`
- `.axm-brand__name`
- `.axm-brand__meta`
- `.axm-tabs`
- `.axm-tab`
- `.axm-tab.is-active`

## Buttons

Base:

```html
<button class="axm-button">Action</button>
```

Variants:

- `.axm-button--primary`
- `.axm-button--secondary`
- `.axm-button--lux`
- `.axm-button--ghost`
- `.axm-button--icon`
- `.axm-button--magnetic`

Use one semantic variant per button. Do not use luxury treatment for ordinary actions.

## Form controls

- `.axm-input`
- `.axm-select`
- `.axm-textarea`
- `.axm-switch`
- `.axm-switch__track`
- `.axm-range` can use the browser accent token or platform-specific range styling.

Example:

```html
<label>
  Search
  <input class="axm-input" type="search">
</label>

<label class="axm-switch">
  <input type="checkbox">
  <span class="axm-switch__track"></span>
  <span>Living field</span>
</label>
```

## Status and metadata

- `.axm-chip`
- `.axm-badge`
- `.axm-status-dot`
- `.axm-avatar`
- `.axm-icon-tile`

State should remain understandable through text or iconography, not color alone.

## Information structures

- `.axm-card-head`
- `.axm-card-head__title`
- `.axm-card-head__copy`
- `.axm-stat`
- `.axm-stat__label`
- `.axm-stat__value`
- `.axm-stat__delta`
- `.axm-progress`
- `.axm-table-wrap`
- `.axm-table`
- `.axm-timeline`
- `.axm-timeline__item`
- `.axm-command`
- `.axm-command__prompt`
- `.axm-command__key`
- `.axm-code`

Wrap wide tables:

```html
<div class="axm-table-wrap">
  <table class="axm-table">...</table>
</div>
```

## Feedback and overlays

- `.axm-toast`
- `.axm-modal-backdrop`
- `.axm-modal`
- `.axm-tooltip`
- `.axm-skeleton`
- `.axm-empty-state`

Dialog or modal content should generally use solid or smoked material for readability.

## Pure CSS focal objects

Core CSS also provides:

- `.axm-energy-orb`
- `.axm-portal-ring`
- `.axm-crystal-core`
- `.axm-metric-ring`
- `.axm-holo-line`
- `.axm-light-rail`
- `.axm-title-gradient`

These are visual primitives, not required controls. Use them only where they reinforce purpose.

## Explicit legacy adapter groups

`AXMVisualAdapter` supports these selector groups:

```text
navigation · toolbars · panels · luminousPanels · quietPanels
solidPanels · prismaticPanels · tiltPanels · buttons
primaryButtons · secondaryButtons · luxuryButtons · ghostButtons
magneticButtons · inputs · selects · textareas · chips · tabs
progress · tables · commands · iconTiles · avatars
```

Run `preview()` first. The adapter claims ownership only of classes it actually adds.
