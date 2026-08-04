# Unity import

1. Copy the `Assets` folder into the Unity project.
2. Create an `AXMTextFxProfile` asset through **Create → AXM → Text FX Profile**.
3. Call `AxmFutureCoreAXMTextPreset.Apply(profile)` once in an editor utility or setup script.
4. Attach `AXMTextFxApplier` to a TextMeshPro object and assign the profile.
5. Keep the base TMP face readable when custom shader properties are zero.

The generated C# file contains the resolved parameters for `axm_future_core`.
