# Changelog

Notable public AXM Workshop changes are recorded here. Historical workbench
reports remain available under [`docs/history/`](docs/history/).

## v0.4.1-experimental — 2026-07-28

### Visual fabric integration

- Integrated Style Fabric 0.6.0 as the governed game-skin foundation.
- Integrated CSS Skin Fabric 0.2.0 as the shared interface foundation.
- Added the Aetherglass 7.1.0 compatibility bridge and bounded Hub adapters.
- Reworked the Hub and Skinner visual paths without changing module authority.
- Repaired narrow-screen navigation and added focus and reduced-motion treatment.

### Verification

- Verified the Style Fabric 151-file release manifest and 109/109 unit checks.
- Verified the CSS Skin Fabric 98-file intake manifest and required validators.
- Passed the repository's required static, discovery, Hub, skin, and packaging gates.
- Passed the GitHub clean-Windows launch gate on the merged integration commit.
- Kept fake private-key self-test fixtures effective while making their source
  unambiguous to the public-package secret scanner.

### Known boundaries

- Experimental, not production-certified.
- First Windows bootstrap needs internet when compatible Node.js is absent.
- Deep optional CSS parsing depends on `tinycss2`; required CSS validation remains
  independent and passed.
- The broader Workshop suite still exposes a pre-existing Heartbeat observatory
  fixture mismatch (`HELD` versus `READY`).
- No broad open-source license has been granted yet.

## v0.3.0-experimental — 2026-07-27

### Public front door

- Added a concise visual README with a direct beginner route.
- Added human- and machine-readable discovery maps.
- Indexed 177 tool modules and 1,183 declared capabilities without treating
  declarations as runtime proof.
- Added current status, security, contributing, and license boundaries.

### Launch and verification

- Added `OPEN_AXM_WORKSHOP.cmd` as the recommended Windows route.
- Added a private pinned Node.js bootstrap with SHA-256 verification.
- Added Linux/static and fresh-Windows GitHub release gates.
- Proved launch from a clean Windows path with no Node.js on `PATH`.
- Preserved exact-byte generated registries and digest-bound contracts across
  Windows Git checkouts.

### Platform growth

- Integrated the current modular Workshop snapshot, including Heartbeat, Pulse,
  update seams, game-building systems, capability registries, evidence routes,
  and governed automation foundations.

### Known boundaries

- Experimental, not production-certified.
- First Windows bootstrap needs internet when compatible Node.js is absent.
- Clean macOS/Linux first launch and independent beginner comprehension remain
  unproven.
- No broad open-source license has been granted yet.
