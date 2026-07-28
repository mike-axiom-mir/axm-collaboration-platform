# Character Design Roadmap

Style Fabric v0.6 keeps Character Forge as the character-focused organ inside
the wider Full Game Skin system. It supports five portable character regions,
palette, material, eight silhouettes, seven head shapes, eight outfits, eight
accessories, proportions, character pattern response, deterministic preskin
fusion, and a procedural preview.

To become a full character-design organ later, add these as separate modular contracts:

1. **Character appearance contract** — semantic regions, layers, masks, proportions, variant assets.
2. **Rig/animation contract** — bones, sockets, animation names, frame timing, pose coverage.
3. **Expression contract** — face regions, visemes, emotions, fallback expressions.
4. **Equipment anchor contract** — safe attachment points and occlusion rules.
5. **Renderer adapters** — sprite, paper-doll, skeletal 2D, voxel, 3D/PBR.
6. **Consistency verifier** — frame dimensions, pivots, palette consistency, missing directions, clipping.
7. **Identity and consent record** — especially when based on a real person.

Gameplay statistics and abilities must remain outside these appearance contracts.
