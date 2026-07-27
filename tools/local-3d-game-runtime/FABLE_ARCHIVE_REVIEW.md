# Fable PS3 renderer archive review

Source archive (left untouched): local Downloads archive `files.zip`

- Archive SHA-256: `0C374578867F47EEE6724267C598D2E8308E024D7FF1AADF31CDD233C3770E84`
- `axm-graphics-ps3.js`: 19,071 bytes; SHA-256 `472D9458BAB5F871C0D64096369E2E4AAF2E778ACC44D77A07EF636F4EC25A1E`
- `ps3-demo.html`: 4,647 bytes; SHA-256 `D771EA5869DE3225C9FB72FC3482B209979CCEE6A729097A6B777E597609CB56`

## Useful ideas adopted

The archive correctly separates renderer presentation from model, texture, gameplay, and art-direction quality. Its useful ideas were reimplemented in the AXM-owned WebGL2 renderer as bounded Performance, PS2 Baseline, and PS3 Preview profiles. The profiles control pixel-density caps, fog range, exposure, highlight rolloff, vignette, and deterministic grain; live evidence exposes the selected profile.

## Material deliberately not promoted

- The Three.js r128 and CDN dependency conflicts with AXM's dependency-independent runtime.
- The demo's placeholder boxes and cones are smoke-test geometry, not reusable game assets.
- Its post-processing implementation was not copied wholesale. AXM keeps its existing native GLB/PBR/skinning route and adopted only the useful presentation concepts.
- Bloom, soft-shadow maps, and a generated normal-texture route need separate performance and visual evidence before they enter the native runtime.
- Nothing in the archive proves PS3-quality assets; the new UI says that explicitly.

The archive remains saved at its original location. No source file from it was added to the permanent module/library inventory.
