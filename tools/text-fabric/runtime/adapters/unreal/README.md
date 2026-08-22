# Unreal adapter

Create Data Assets or style rows for semantic text roles and apply them through UMG/Slate. Use runtime composite fonts for multilingual coverage.

For modern Unreal projects, route large or heavily scaled text to SDF/MSDF and retain direct rasterization for small text. Test outlines and materials on the actual target device profile.

## Shader / material pack

Included starter hands:
- `AXMTextStyle.h`
- `AXMTextMaterialStyle.h`
- `AXM_UMG_MATERIAL_NOTES.md`

Use a material instance for premium display text and keep small text on the cleanest path.
