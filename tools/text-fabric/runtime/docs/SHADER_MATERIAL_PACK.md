# AXM Text Fabric — Shader / Material Pack

This pack translates AXM text recipes into **engine-native material directions**.

The goal is simple:
- keep the text **readable**
- keep the effect **modular**
- make the look **reusable** across engines

---

## 1. Universal layer model

Every premium text style should be treated as layers:

1. Base glyph core
2. Outline / dark separation edge
3. Near shadow
4. Far shadow / atmosphere
5. Gradient or material fill
6. Bevel / top highlight
7. Sheen sweep
8. Glow / bloom contribution
9. Optional glitch / RGB split
10. Optional scanlines / sparkle

If the text becomes unreadable, disable layers in the reverse order:

- sparkle / scanline
- glitch jitter
- sheen sweep
- far glow
- bevel

The **core text layer** should survive intact.

---

## 2. Recommended engine routing

### Unity
Use **TextMeshPro** for UI and world-space text.

Best path:
- SDF / MSDF-capable font asset
- material preset per recipe
- optional custom shader path for advanced glow / glitch

Good use cases:
- Neon Metal
- Readable Glitch
- Molten Gold reward titles
- Chrome launcher headers

### Unreal
Use **UMG / Slate** for UI text and route premium effects through:
- UI material instances
- parameterized material functions
- data assets for role binding

Good use cases:
- mission banners
- title cards
- cyber HUD alerts
- launcher / menu heroes

### Godot
Use a **Label / RichTextLabel** with:
- theme resource for role
- outline and font setup on the node
- `canvas_item` shader for premium overlays

Good use cases:
- game HUD
- splash panels
- premium menu headers

---

## 3. Material parameter map

Common cross-engine parameters:

- `BaseColor`
- `GradientTop`
- `GradientMid`
- `GradientBottom`
- `OutlineColor`
- `OutlineWidth`
- `GlowColor`
- `GlowPower`
- `BevelLight`
- `BevelDark`
- `SheenColor`
- `SheenOpacity`
- `SheenAngle`
- `GlitchRed`
- `GlitchCyan`
- `GlitchOffset`
- `GlitchIntensity`
- `ScanlineOpacity`

---

## 4. Recipe-to-material hints

### Molten Gold
- high warm gradient contrast
- narrow bright top edge
- dark warm lower edge
- restrained amber glow
- optional slow sheen sweep

### Silver Chrome
- cool metallic gradient
- slightly stronger contrast banding
- soft blue ambient glow
- no heavy sparkle

### Neon Metal
- metallic gradient plus emissive cyan layer
- dark separation edge
- stronger bloom contribution
- optional slow pulse

### Holo Prism
- pastel spectral gradient
- white edge highlight
- glass-like plate or soft bloom
- use sparingly

### Readable Glitch
- crisp core text
- tiny cyan / magenta split
- optional subtle jitter
- optional scanline overlay
- keep offset small (1–3 px typical)

---

## 5. Safety rules

- Do not use heavy glitch or bloom on dense body text.
- If text sits over gameplay, keep the plate or local contrast support.
- Respect reduced-motion settings.
- For small text, prefer static looks over animated ones.
- Keep one reusable material family per recipe instead of many one-off hacks.
