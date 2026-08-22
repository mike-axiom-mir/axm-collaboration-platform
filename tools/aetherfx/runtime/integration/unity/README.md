# Unity UI Toolkit bridge

1. Copy an exported `*.unity-theme.uss` into the Unity project.
2. Copy `AXMAetherThemeLoader.cs` into `Assets/Scripts`.
3. Add the component beside the target `UIDocument` and assign the imported `StyleSheet`.
4. Use the corresponding visual-intent JSON and support report when rebuilding native Shader Graph, VFX Graph, particle, bloom, or pointer-response behavior.

The USS carries UI tokens and surface approximations. It is not presented as a complete Unity rendering plugin.
