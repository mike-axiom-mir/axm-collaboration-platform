# Security Model

Every imported skin is untrusted declarative data, including a skin made by a local machine user.

## Enforced in this reference build

- Strict top-level pack fields.
- One admission decision combining structure, embedded-raster verification,
  and integrity policy before resolution or portable-file acceptance.
- Presentation capability allowlist.
- Gameplay, authority, executable, script, network, permission, prototype-pollution, and filesystem keys rejected.
- Own-data-only canonicalization, merge, flatten, lookup, and instance
  override; inherited values and accessors are rejected.
- Cycles, non-finite values, dangerous prototype path segments, and ambiguous
  instance shapes are rejected.
- Remote asset sources rejected.
- Raster-only embedded assets: PNG, JPEG, and WebP.
- Data URI MIME checked against the declaration.
- Raster magic bytes checked.
- Image dimensions checked when the format header exposes them.
- Asset SHA-256 checked against embedded bytes.
- Pack canonical SHA-256 supported and verified on import.
- A declared signed pack that changes after signing is rejected before it can
  be resolved, saved, or exported through the supported paths.
- Finite bounded material values.
- Pack, asset-count, embedded-byte, dimension, and decoded-pixel limits.
- Game-owned minimum opacity and contrast protection.
- Unsupported renderer properties are omitted and named in the receipt.
- The final resolved presentation is revalidated against the exact game
  contract, policy budgets, supported-property vocabulary, and
  `ZERO_AUTHORITATIVE_WRITES`.
- Preview, exact prepared proposal, approval, single-use apply, and rollback
  remain separate operations.
- Forged, modified, replayed, or concurrently reused runtime proposals are
  rejected before adapter execution.
- Treatment molds use bounded declarative enums and numbers. Shader source,
  arbitrary URLs, executable expressions, and authoritative targets are
  denied.
- No runtime network route.

## Intentionally denied in v0.6

- SVG, fonts, models, audio, video, archives, custom shader source, HTML, and executable plugins inside a skin.
- Remote URLs as asset sources.
- Automatic public upload.
- Automatic selection, save, runtime application, publication, or promotion
  of generated Treatment Forge directions.
- Automatic mold discovery, adapter rewriting, or promotion of Mold Foundry
  drafts.
- Automatic CANON or Game Hub promotion.

## Integrity and trust boundary

Integrity verifies canonical bytes; it does not establish safety, authorship,
licensing, moderation, or aesthetic quality. Local policy may admit unsigned
packs. A stricter hosted policy can require integrity, but either policy still
applies the same structure and raster checks.

Adapter registration validates and captures the adapter's declarative game
contract. Runtime proposal binding protects the boundary before adapter
execution; it does not prove that an adopting adapter implements safe renderer
behavior. Each game still owns its defaults, protected cues, apply logic, and
rollback.

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
