# Unreal UMG / Slate Material Notes

Recommended approach:
- use a Data Asset per semantic text style
- bind base font and color there
- use a Material Instance for premium hero text

Suggested scalar parameters:
- `OutlineWidth`
- `GlowPower`
- `SheenOpacity`
- `SheenAngle`
- `GlitchOffset`
- `GlitchIntensity`
- `ScanlineOpacity`

Suggested vector parameters:
- `BaseColor`
- `GlowColor`
- `OutlineColor`
- `GlitchRed`
- `GlitchCyan`
- `BevelLight`
- `BevelDark`

Rule:
use UI materials for banners, headers, rewards, and HUD emphasis — not dense paragraph text.
