# License and asset status

Status: **TEST**  
Steam distribution decision: **NOT CLEARED — HUMAN REVIEW REQUIRED**

This ledger records package evidence; it is not a legal clearance or a claim that every file may be distributed commercially.

## Observed runtime content

- No raster art, recorded audio, bundled font, or downloaded 3D-model files were found. The world models and audio are described and implemented as procedural local content.
- Three.js r160 is vendored locally at `runtime/game/vendor/three.module.js`.
- `runtime/game/vendor/SOURCE.json` records the upstream version, source URL, file hashes, MIT license, and no runtime-network requirement.
- `runtime/game/vendor/LICENSE` contains the Three.js MIT notice and must remain in every distributed copy.
- `runtime/game/DESIGN_RESEARCH.md` identifies external references as design research and explicitly says no Tropico code, assets, music, UI, characters, dialogue, or copied game text are included.
- `SOURCE_PACKAGE.json` records the supplied intake archive and SHA-256 receipt.

## Missing evidence and required decision

- Mike must confirm ownership or distribution authority for the supplied source archive, original code, procedural content, copy, names, and branding.
- The pre-existing machine-specific `source_file` value in `SOURCE_PACKAGE.json` must be redacted or normalized before any public depot or commit containing that receipt is approved; preserve the archive basename and SHA-256 instead.
- Final packaging must include both `vendor/SOURCE.json` and `vendor/LICENSE` alongside the vendored Three.js file.
- Research citations are not asset licenses and must not be treated as permission to copy referenced game material.

The third-party Three.js notice chain is documented, but the game remains unapproved for a public Steam depot until the human ownership and packaging checks are signed off.
