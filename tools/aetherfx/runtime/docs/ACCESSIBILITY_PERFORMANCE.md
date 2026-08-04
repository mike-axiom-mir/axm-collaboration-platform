# Accessibility and Performance

## Quality tiers

Each module declares behavior for `low`, `medium`, `high`, and `cinematic`. A tier may stay enabled, apply parameter overrides, disable the effect, or name a simpler fallback. The composer reports fallback decisions instead of hiding them.

## Adaptive mode

`Auto` observes rendered frame cadence and selects a conservative runtime tier. Battery, balanced, and quality biases change the governor's preference. Hysteresis prevents rapid tier oscillation. The saved recipe remains unchanged.

The Performance Inspector separates two forms of evidence:

- **measured cadence** from the running browser
- **estimated composition load** from module plans and parameters

The estimate is comparative guidance, not a universal GPU benchmark.

## Reduced motion

Reduced motion suppresses or slows non-essential animation and pointer parallax. Meaning must not depend only on movement.

## Photosensitive-safe mode

Photosensitive-safe mode suppresses repeating sweeps, shimmer, attention beacons, reflection motion, flashing-like decoration, rapid overlays, and unnecessary pulsing while preserving content, layout, focus, and interaction state. The runtime selectors match the layers emitted by the web adapter, and catalog metadata declares photosensitive safety per module.

This is a cautious presentation mode, not a medical certification or guarantee for every person or display. A module is treated as safe only when its metadata says so; missing metadata is not silently promoted to safe.

## High contrast and large text

High contrast strengthens separation, text readability, and focus. Glow is never the sole state indicator. Large text increases preview typography while keeping controls labelled and keyboard reachable.

## Practical guidance

- Prefer one dominant glow source over many full-screen blooms.
- Use particles as atmosphere, not required information.
- Inspect largest estimated contributors before reducing the whole scene.
- Use battery or balanced Auto bias on weak devices.
- Validate fixed low quality as a fallback.
- Treat cinematic mode as optional enhancement.
- Test narrow and wide viewports, reduced motion, photosensitive-safe mode, and keyboard operation before release.
- Inspect computed animation state for adapter-emitted sweep and shimmer layers; a checked control alone is not evidence.
- Keep target-support reports with non-web handoffs so unsupported motion is visible.
