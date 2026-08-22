# Lumenwake 006 — low-poly 3D visual pass 01

Status: **WORKING** visual increment. This is not CANON and is not a Steam-release acceptance.

## Scope

- Replaced the active shared-screen Canvas2D world with a local Three.js r160 scene while preserving the existing DOM HUD, start gate, map selection, controls, phone controller UI, and Canvas2D fallback.
- Added low-poly keepers, gloom enemies, light shards, duet pads, resonance obelisks, pulse rings, faceted terrain, lighting, fog, and shadows.
- Gave the two selectable routes distinct 3D silhouettes:
  - Aurora Basin: layered twelve-sided ground plates, boulders, luminous fragments, and concentric light paths.
  - Prism Causeway: raised tiled crossing, colored edge rails, repeated edge prisms, and floating abyss debris.
- Reused the Workshop's local `shared/vendor/three-r160/three.module.js`; no network asset or generated-provider art was introduced.

## Live browser evidence

Capture surface: Codex in-app Browser at `http://127.0.0.1:8796/?player=screen`, 1280×720.

| Evidence | Claim | SHA-256 |
| --- | --- | --- |
| `02-before-active-play.png` | Matched active-play baseline: the former flat Canvas2D arena | `8ECB45AB4C6BD03DC18EFD748CC3AEF76EF3B688DC1BA0BB0373F9BC412E68CA` |
| `05-after-entry-fresh.png` | Fresh corrected boot with the 3D arena behind the ready gate | `C24806A113BCA92102852F212B242F9B7F9E7FC5364BED3831A9239371727B71` |
| `08-after-active-aurora-start.png` | Aurora Basin active at 3:29, wave 1 | `D0DB228636E0F219C20FEB0881F94CCDC29DDB417E275E8E48E8CC66D1527C46` |
| `10-after-player-movement.png` | Live keeper and arena after repeated D-key input | `1A15AD91438FA0A0713CE92ABF3D556E68BDA22E3C8AB82B0BB27FF4B61DD8DA` |
| `12-after-active-prism-3d.png` | Prism Causeway active at 3:29, wave 1 | `C17F7B0D0C33A1B65FA52A830E1A0EDBA79A06C291BDFA7B8544C1DDA3BABA5E` |
| `13-after-active-prism-followup.png` | A later non-identical Prism live frame | `EE8B9A489BA3D68E5C50BEF0F7E74F67714882F6D19E2F1D02C0ACED9A45DB41` |

Fresh-page probes on both routes reported:

- `stage.three-ready`
- `data-renderer="three-r160"`
- the correct `data-map3d` value
- `#world3d` opacity `1`
- Canvas2D fallback `#game` opacity `0`
- zero warning-level browser log entries

`08`/`10` and `12`/`13` are distinct images from the live renderer. The Prism pair was requested with an approximately 850 ms observation gap. This proves scene evolution, not an exact render cadence; exact cadence remains UNKNOWN because no rolling-buffer capture hand was exposed.

## Preserved failed attempt

`03-after-entry-ready.png` records the first boot attempt, where the browser rejected the relative module specifier `vendor/three.module.js` and retained the Canvas2D fallback. The import was corrected to the server-owned `/vendor/three.module.js` route. `04`, `05`, and all active-play captures were made after that correction in fresh page loads with no warning-level browser logs.

## Verification

Focused checks:

- `node --check runtime/lumenwake-server.cjs` — PASS
- `node --check runtime/lumenwake-three.js` — PASS
- `node selftest.js` — PASS
- `node balance-selftest.js` — PASS (`solo 19/20`, `pair 18/20`, `four-seat 19/20`)
- `git diff --check -- tools/game-hub/game-library/006-lumenwake` — PASS; only existing LF/CRLF conversion warnings were emitted

Workshop required checks, run after the final renderer diagnostics change:

- `node verify.js` — exit 0, 0 FAIL; existing Workshop warnings remain
- `node hub/hub-selftest.js` — exit 0
- `node hub/route-selftest.js` — exit 0
- `node hub/graft-selftest.js` — exit 0
- `node hub/skin-selftest.js` — exit 0
- `node hub/verify-plus.js` — exit 0, `VERIFIED_WITH_LIMITS`
- `node tests/html-script-syntax-test.js` — 55 PASS, 0 FAIL; Lumenwake's two local scripts compile
- `node tests/tool-forge-package-test.js` — exit 0, package remains `installed: false`
- `node tools/agent-tool-forge/selftest.js` — 17 PASS, 0 FAIL
- `node tools/evidence-desk/selftest.js` — 36 PASS, 0 FAIL

The browser click test is separate from script compilation and was performed on both routes. No packaged Steam build or hardware controller test was run.

## Source integrity and workspace boundary

The repository was already broadly dirty and every tracked Lumenwake source file was modified before this pass. This increment was therefore kept to these existing files plus one new renderer and this evidence directory; unrelated work was not reverted or reformatted.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/lumenwake-client.html` | `54FE5885B7379CB1897586ED8B31D804E9E77029204DA137FDE944D915EE09D6` | `9BE164D6C76B488CEA4D0D8F07A42223CAFB2FC96B56856DAD2C6DD06DE60419` |
| `runtime/lumenwake-server.cjs` | `D2E3EF043E789D2BAB433F2EDC43E79E01637825D58F914CAB5381392E7AD936` | `F2CC6D87AC5B7E6805BFD4D8C03BED6FF3708FF2666D2E691D5E9C00F237112D` |
| `game.manifest.json` | `1C51D25D748B0717FC9F562ACADCEFC987B855A2ECE9BF79AE1662A5103C1C84` | `5F0273D01D254B621CAB825E2D7D5C13885803EEA61FA439408C5BFFFD48A259` |
| `ASSET_LICENSES.md` | `03EEA2235CF257CDDB3C757C4DCABE0F2706C63A5786375FAA86EC2483E88DA6` | `73E1494254A4E996B9F88279AB0432B13B8E8497EAD46A10D5BECE336BDF24F9` |
| `runtime/lumenwake-three.js` | new | `BB1501A5235E71B70F95764DB10B6233F1DD114DFE9424110646941ED23759E6` |

Known open work: Steam packaging/performance, broader GPU and responsive-display coverage, physical gamepad/phone QA, accessibility review, long-run stability, and founder acceptance.
