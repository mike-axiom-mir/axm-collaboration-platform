# Portable static adapter

Every compiled v0.8 bundle includes a `portable/` folder containing:

- an accessible SVG
- a minimal HTML preview
- an asset manifest with SHA-256
- import and font-boundary guidance

The SVG is generated from the same resolved plan as the engine adapters. It is a fallback and proof asset, not a replacement for engine-native text when the text must remain editable or localized at runtime.
