# Unity TMP Shader Notes

Start with `TextMeshPro/Distance Field` or your TMP-compatible SDF shader.

Recommended extension points:
- gradient fill
- controlled emissive glow
- bevel light/dark ramp
- sheen sweep
- RGB split / glitch pass
- scanline overlay

Suggested custom properties:
- `_AXMGlitchOffset`
- `_AXMGlitchIntensity`
- `_AXMGlitchRed`
- `_AXMGlitchCyan`
- `_AXMSheenOpacity`
- `_AXMSheenAngle`
- `_AXMScanlineOpacity`

Implementation rule:
keep the core face readable even when all custom properties are zeroed.
