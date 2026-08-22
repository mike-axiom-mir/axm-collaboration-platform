# Unity adapter

Use TextMeshPro or TextCore. Create semantic prefabs or ScriptableObjects for roles instead of styling each label independently.

- Use SDF/MSDF-style assets for large, transformed, glowing, or world-space text.
- Keep the smallest body text on the sharpest available raster path.
- Define fallback font assets for every supported script.
- Prefer static atlases for known strings and dynamic fallbacks for unknown glyphs.
- Test at TV distance, handheld distance, and 200% UI scale.

## Shader / material pack

Included starter hands:
- `AXMTextFxProfile.cs`
- `AXMTextFxApplier.cs`
- `AXM_TMP_SHADER_NOTES.md`

Use them as the modular bridge between the resolved plan and a TMP material preset.
