# Asset UI Sensory Workbench

Status: TEST, candidate-only.

This local workbench consumes a whole gated ui-component@1.2.0 result, decodes
the approved SVG as an inert image, and uses a trusted canvas wrapper to inspect
default, hover, active and disabled states; focus; raw and nine-slice views;
non-proportional stretch; zoom; backgrounds; safe areas; and reduced motion.

Start from the Workshop root:

    node tools/asset-ui-sensory-workbench/server.js

Then open the printed 127.0.0.1 address. The host calls the exact synchronous
Asset Hands create/edit route, then deterministic-ui-fabric.gateResult. It
accepts JSON no larger than 256 KiB and will not return more than 2 MiB. It has
no network access and makes no filesystem writes.

Create derives deterministic focus-ring defaults. After the exact ui-recipe is
bound, colour and width become authoritative edit fields. Successful edits
replace all three artifacts; failure or HOLD preserves the current candidate,
A/B source and review history.

The journey gate is intentionally demanding. Accept for TEST requires all four
states, raw and original/stretched nine-slice, 100/200 percent zoom, light/dark
backgrounds, pointer, keyboard focus, safe area and reduced-motion observation.
Simulated gamepad stays simulation. Human approval is never inferred.

This tool does not prove physical touch/gamepad behavior, screen-reader or
assistive-technology behavior, target-engine parity, representative device
performance, localization, physical display zoom, external conformance, or
aesthetic usefulness. It does not install, promote or canonize output.
