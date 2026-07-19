# AXM Visual Kernel v0.2

The Visual Kernel is shared infrastructure, not a creation hand and not a
product skin. It defines semantic, host-neutral visual roles and deterministic
validation. Product modules may add character while preserving interaction
meaning, readable contrast, focus visibility and reduced-motion behaviour.

`visual-kernel.js` is the executable registry. `visual-kernel.tokens.json` is
the portable data view. `axm-kernel.css` is the browser foundation currently
consumed by the Hub. Dark, light and high-contrast profiles share typography,
spacing, radius, motion and minimum-target scales.

The kernel never applies itself to a host automatically. The Theme Token Hand
can create or edit candidate token bundles, but adoption remains an explicit
host decision.
