# AXM Workshop integration receipt

- Upstream: AXM Style Fabric 0.5.0 WORKING / TEST
- Source archive: `AXM_STYLE_FABRIC_v0_5_WORKING_2026-07-28.zip`
- Source archive SHA-256: `5E3A27357A9C4E96CB7E54E30221A1F93FCEC90BC37A1B9DF28CA43E1F31D09E`
- Vendored files covered by `FILE_MANIFEST.sha256`: 136
- Upstream bytes changed: none
- Workshop route: `/tools/skinner/`
- Full upstream Studio: `/shared/style-fabric/studio/`

The Skinner route imports the upstream ES modules directly. The Workshop adapter
accepts only a validated Style Fabric pack, maps its presentation palette and
bounded material hints into the existing `axm.skin/v1` surface, and runs the
normal Skinner readability gate before staging a change. Embedded Style Fabric
assets are deliberately not copied into Skinner; the existing skin contract only
accepts explicit local `vault:` references.

The upstream `npm test` suite passes on Windows. The upstream `npm run verify`
script has a Windows-only URL-path bug in version 0.5.0; it treats a file URL
pathname as a native path and produces a duplicated drive prefix. The upstream
files are kept byte-identical, so the Workshop self-test verifies the release
manifest and adapter separately.
