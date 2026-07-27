# AXM Procedural Animation Blocks

This governed adapter admits Opus's local motion Lego under the distinct `axm.procedural-motion/v1` contract and makes its relationship to the existing Workshop animation spine explicit. The original ZIP remains immutable evidence of the source label; the governed copy removes the accidental claim that it was already the Workshop's bounded rig format.

- Ten bounded presets cover juice, camera shake, idle/walk/run locomotion and directed respawn morphs.
- Identical input produces an identical content digest.
- Semantic descriptors can feed `shared/game-animation-foundation` today.
- The source contract is **not** silently renamed to `animation/clip+json`. Converting channel motion into a bounded rig clip still needs a declared skeleton/channel adapter.
- Technical tests can prove determinism and graph compatibility. Human visual review still decides whether motion looks good.

Original intake: `exports/axm-anim-kit-v0_1.zip` (SHA-256 `328a4b27224d89fb5ff7d0aee176e05fe48ce0166cd0b169124db0f521241da0`).
