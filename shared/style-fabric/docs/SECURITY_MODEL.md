# Security Model

Every imported skin is untrusted declarative data, including a skin made by a local machine user.

## Enforced in this reference build

- Strict top-level pack fields.
- Presentation capability allowlist.
- Gameplay, authority, executable, script, network, permission, prototype-pollution, and filesystem keys rejected.
- Remote asset sources rejected.
- Raster-only embedded assets: PNG, JPEG, and WebP.
- Data URI MIME checked against the declaration.
- Raster magic bytes checked.
- Image dimensions checked when the format header exposes them.
- Asset SHA-256 checked against embedded bytes.
- Pack canonical SHA-256 supported and verified on import.
- Finite bounded material values.
- Pack, asset-count, embedded-byte, dimension, and decoded-pixel limits.
- Game-owned minimum opacity and contrast protection.
- Unsupported renderer properties are omitted and named in the receipt.
- Preview, proposal, approval, apply, and rollback remain separate operations.
- No runtime network route.

## Intentionally denied in v0.3

- SVG, fonts, models, audio, video, archives, custom shader source, HTML, and executable plugins inside a skin.
- Remote URLs as asset sources.
- Automatic public upload.
- Automatic CANON or Game Hub promotion.

## ZIP boundary

The portable v1 contract remains one `.axmskin.json` file with optional
embedded raster data. This deliberately avoids archive extraction and its
traversal, symlink, duplicate-name, decompression-bomb, and platform-path
risks.

A future ZIP form must add a streaming quarantine importer that rejects absolute paths, drive letters, UNC paths, `..`, ambiguous separators, symlinks, devices, normalized-name collisions, duplicate manifests, nested archives, excessive expansion ratios, and undeclared files. Generic “extract all” is not an acceptable implementation.

## License and provenance truth

A declared license is a creator claim, not proof that the creator owns the source. Hashes prove byte integrity, not authorship or harmlessness. Public hosting needs a separate review state.

## Accessibility and fairness

Game-owned protected cues take precedence over a skin. A pack cannot use this presentation contract to remove required silhouettes, team markers, hazards, objective indicators, readable text, or reduced-motion caps.
