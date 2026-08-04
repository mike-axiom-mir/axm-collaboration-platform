# Asset provenance

Everything needed at runtime is local to slot 014.

## Runtime

- `runtime/vendor/three.module.js`: Three.js r160, copied from the Workshop's
  existing `shared/vendor/three-r160/` runtime. The accompanying MIT license is
  preserved as `runtime/vendor/THREE_LICENSE.txt`.
- Buildings, robots, enemies, particles, water, markers, class weapons, action
  cues, the Toon hero, and UI remain original code-native work in `app.js`,
  `index.html`, and `styles.css`. No model or art was copied from another game
  package.
- `runtime/motion-system.js` and its class action profiles are original
  code-native work. They use no downloaded clips or model data. The version-1
  semantic rig binding is deliberately path-neutral so future licensed GLB assets
  now drives both the code-native fallback and the licensed Human animation
  bridge described below.

## Licensed Human production rig

- `runtime/assets/characters/quaternius/animated-men/man-casual-a.glb` is
  **Man Casual A** from the **Animated Men Pack by Quaternius**.
- Source: `https://poly.pizza/bundle/Animated-Men-Pack-DAC9SDgMQT`
- Creator: `https://quaternius.com/`
- License: Creative Commons Zero v1.0 Universal (`CC0-1.0`). A package-local
  provenance note is preserved beside the GLB as `LICENSE.txt`; the canonical
  legal text is at `https://creativecommons.org/publicdomain/zero/1.0/legalcode`.
- SHA-256:
  `dad8fa3ca2bc7760892f9ff47f544941179e50acb2aa772cf9f035154a37fc58`
  (493,196 bytes).
- The asset contains one skinned mesh, 31 joints, and 11 authored clips. The
  runtime binds idle/walk plus class-specific attack, special, and dodge roles
  by semantic clip suffix rather than exporter paths.
- `runtime/hero-rig-contract.js` stores only a game-local relative path. The
  loader resolves that path from `import.meta.url`, so moving the full package
  to a future asset drive does not require rewriting an absolute workstation
  path.
- `runtime/vendor/GLTFLoader.js` and its `BufferGeometryUtils.js` dependency are
  from the same Three.js r160 distribution as `three.module.js` and are covered
  by `runtime/vendor/THREE_LICENSE.txt`.
- If loading, bounds, skeleton, or required clips fail validation, the original
  Human primitive remains visible and playable. Toon identity is intentionally
  unchanged by this Human-only bridge.

## Key art

- `runtime/assets/bonk-bolt-key-art-v1.png` was generated for this package with
  the built-in OpenAI image tool on 2026-07-28.
- Final prompt intent: an original peaceful 3D cartoon adventure valley with
  Human, Toon and miniature robot villages, elevated three-quarter framing,
  warm late-afternoon light, and no text, logos, guns, watermark, franchise
  characters, or named-style imitation.
- The first, more crowded concept request was rejected by the image service and
  produced no asset. The calmer second request produced the local PNG above.
- The image service is not a runtime dependency. The game performs no remote
  image generation and adds no content filter or creation limit to AXM.
