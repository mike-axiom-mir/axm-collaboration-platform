# Adapters and Honest Limits

## Web runtime — working

The web adapter renders declarative modules into scoped classes, variables, overlays, particles, and adapter-owned interactions. It powers the studio preview, standalone HTML, and the exported self-contained Web Component.

## Practical integration kit — working starter bridges

`integration/` contains:

- a portable renderer-neutral runtime and executable Node example
- a dependency-free Custom Element shell and local example
- a Godot 4 helper for applying exported Theme resources
- a Unity UI Toolkit helper for attaching exported USS files
- the verified static SVG fallback workflow

## Static SVG — working approximation

The Python adapter resolves derived and composite modules, quality fallbacks, parameter defaults and bounds, exclusive groups, and composition budgets before drawing. It preserves palette, scene framing, panels, halos, beams, fog-like fields, vignettes, and labels where practical. Dynamic hover, ripple, parallax, exact backdrop blur, and browser blend behavior cannot be identical and are reported as unsupported rather than silently counted as rendered.

## CSS tokens and visual intent — working

CSS tokens transfer top-level design variables. Canonical `axm.resolved-visual-intent/1` JSON transfers the resolved scene, quality, accessibility state, operations, parameters, target roles, fallback decisions, and per-operation support. A target-support report summarizes implemented, approximated, contract-only, and unsupported operations. The intent contract is the preferred input for future native adapters.

## Godot and Unity — starter approximations

Generated `.tres` and `.uss` files plus the helpers in `integration/` transfer themes and top-level surface styling. Dynamic beams, particles, caustics, parallax, and shader behavior still require native implementation.

## Why adapters stay separate

Shared packages describe **what** an effect means and which controls it exposes. An adapter declares **how** one environment realizes or approximates it. Executable renderer code does not travel inside community packages.

## Known limits

- CSS and SVG cannot reproduce every physical-lighting or GPU-shader technique.
- Backdrop filters and blend modes vary between browsers.
- Class effects sharing one web target also share that target's CSS variables; duplicate same-class instances can collapse visually.
- `targetRole` expresses routing intent but does not provide a full isolated per-instance render graph by itself.
- Same-environment visual regression is not cross-platform pixel parity.
- Standalone scenes and Web Components contain viewers, not the complete creator UI.
- Browser storage can be cleared; exported files are the durable handoff.
- Photosensitive-safe mode is protective design behavior, not medical certification.
- Unset licences prevent an honest public-release claim.
