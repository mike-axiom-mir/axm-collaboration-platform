# AXM Workshop integration receipt

- Upstream: AXM Style Fabric 0.6.0 WORKING / TEST
- Source archive: `AXM_STYLE_FABRIC_v0_6_WORKING_2026-07-28.zip`
- Source archive SHA-256: `C538A820C31BE6518F1B0B7EAC52C9949D67C1F96954F4915A2EA291FF703EFD`
- Vendored files covered by `FILE_MANIFEST.sha256`: 151
- Upstream bytes changed: none
- Workshop route: `/tools/skinner/`
- Full upstream Studio: `/shared/style-fabric/studio/`

The Skinner route imports the upstream ES modules directly. The Workshop adapter
accepts only a validated Style Fabric pack, maps its presentation palette and
bounded material hints into the existing `axm.skin/v1` surface, and runs the
normal Skinner readability gate before staging a change. Embedded Style Fabric
assets are deliberately not copied into Skinner; the existing skin contract only
accepts explicit local `vault:` references.

The v0.6 runtime keeps the existing pack format and bridge entry points while
adding strict pack admission, Mold Foundry, Treatment Forge, bounded enhanced
materials, exact mold-scoped output and single-use runtime proposals. Both the
upstream `npm test` and `npm run verify` suites pass on Windows. The upstream
files remain byte-identical; the Workshop receipt and self-test are additive.
