# Manual Visual Test Matrix v0.2

## Viewports and containers

- 320 × 568 viewport
- 375 × 812 viewport
- 390 × 844 viewport
- 768 × 1024 viewport
- 1024 × 768 viewport
- 1440 × 900 viewport
- Ultrawide viewport
- 24rem component container
- 52rem component container
- 200% browser zoom

## Component states

- Default
- Hover
- Keyboard focus-visible
- Active
- Selected
- Disabled
- Invalid
- Loading and skeleton
- Empty
- Success
- Warning
- Error
- Long text
- Translated text
- Table overflow
- Command search empty result
- Dialog open and close
- Inspector narrow mode

## Visual worlds

- Aetherglass
- Unified AXM
- Axiom
- Mir
- Calm Workshop
- Public-safe
- Paper/play
- High contrast

For every theme, repeat compact/comfortable density, minimal/balanced/cinematic effects, and full/reduced motion.

## Accessibility and compatibility

- Keyboard-only navigation and tab arrow keys
- Visible focus against every material
- Semantic contrast diagnostics
- Accent foreground auto-selection
- Forced colors / OS high contrast
- Reduced motion
- Reduced transparency
- Data-saving mode where supported
- Browser with no backdrop-filter
- Browser with no color-mix
- Screen-reader labels and dialog naming

## Stop conditions

Do not promote a candidate when:

- Content clips or becomes unreachable.
- Focus is invisible or keyboard order becomes confusing.
- Meaning exists only in color, glow or motion.
- A semantic contrast pair fails its declared threshold.
- Text becomes unreadable over a material.
- Motion causes disorientation or continues indefinitely in reduced mode.
- A high-tier effect blocks interaction or causes sustained frame drops.
- A fallback changes the meaning of the component.
- The candidate duplicates an existing mold without a clear purpose.
- Source, before/after evidence, QA or rollback pointer is missing.
