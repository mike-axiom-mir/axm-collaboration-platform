# AXM AetherFX Integration Kit v1.3

This folder is the practical bridge from the visual fabric into other AXM modules. It does not hide the boundary between canonical resolved intent and a native engine implementation.

## Routes

- `runtime/` — renderer-neutral validation, compilation, package, snapshot, intent, and support-reporting runtime with an executable Node example.
- `web/` — a dependency-free Custom Element shell and a complete local example.
- `godot/` — a Godot 4 helper that applies an exported Theme resource to a `Control` tree.
- `unity/` — a Unity UI Toolkit helper that attaches an exported USS stylesheet to a `UIDocument`.
- `static/` — the SVG approximation workflow for previews, documentation, and fallback images.

The Studio exports a self-contained Web Component, canonical `axm.resolved-visual-intent/1`, and an adapter target-support report. Godot and Unity exports remain starter theme approximations; dynamic beams, particles, parallax, caustics, and pointer effects still require native engine work.

An adapter must classify every resolved operation as implemented, approximated, contract-only, or unsupported. It must not imply native parity by silently dropping work.
