# Asset provenance

Circuitseed v0.2.0 director's cut uses no downloaded art, audio, icon, texture, font, model, voice, or remote runtime asset.

All visible world art, Circuitseed/Circuitkin silhouettes and emblems, region textures, minimap, title sculpture, particles, signal threads, icons, transitions, discovery reveals, and weather layers are generated at runtime by original Canvas 2D, inline code-native SVG, and CSS in this package. Audio is synthesized locally through WebAudio and contains no samples. The interface uses the device's system font stack; no font file is packaged or fetched.

The machine-readable inventory is `assets/ASSET_MANIFEST.json`. External source URLs and archives are absent because no external asset is used.
