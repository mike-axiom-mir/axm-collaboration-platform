# Unreal import

1. Copy `Source/AXMTextFabric/Public` into an Unreal module or plugin.
2. Create a UI material exposing the parameter names listed in `material_parameters.json`.
3. Create a dynamic material instance.
4. Call `FAXMAxmFutureCorePreset::Apply(MaterialInstance)`.
5. Bind the material to the UMG display-text surface.

The generated header is a parameter application hand, not a full Unreal plugin module.
