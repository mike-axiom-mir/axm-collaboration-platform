# Physical-phone declaration truth audit

Status: **TEST**

Recorded: `2026-08-16T15:03:41+02:00`  
Branch: `local-visual-fabric-20260728`

## Purpose

Audit the Game Hub packages that produced no physical-phone warning and prevent
`not-applicable` or `verified` from hiding an unsupported hardware claim.

This receipt does **not** claim that physical-phone QA ran. No handset, router,
rotation, safe-area, touch-feel, thermal, or long-session hardware observation
was performed in this increment.

## Finding and correction

The four warning-free packages all declared `physical_phone_qa` as
`not-applicable`; none claimed `verified` hardware.

- `010-living-globe-tycoon` advertises touch input and its own limits/evidence
  leave physical touch and phone behavior untested. Its declaration is now
  `pending` with a bounded scope.
- `017-small-odds` advertises touch input and has narrow browser-viewport
  evidence, but no physical handset evidence. Its declaration is now `pending`
  with a bounded scope.
- `013-toonfall-gatewatch` advertises neither touch nor a phone controller. Its
  `not-applicable` declaration remains, now with an explicit rationale.
- `014-bonk-and-bolt` advertises keyboard, mouse, and gamepad only. Its
  `not-applicable` declaration remains, now with an explicit rationale;
  physical gamepad QA remains separately pending.

The verifier now enforces these boundaries:

1. `not-applicable` requires a written scope.
2. `not-applicable` is refused while touch or a phone controller is advertised.
3. `verified` requires a written scope and existing package-local evidence
   paths.
4. Responsive browser emulation and software-only checks are not treated as
   physical-handset proof.

The focused selftest also stopped depending on slot 002's obsolete adapter
warning. Synthetic pending and missing-contract cases now test that behavior
without weakening slot 002's current verified adapter contract.

## Files in this increment

- `tools/game-hub/game-package-verifier.js`
- `tools/game-hub/game-package-verifier-selftest.js`
- `tools/game-hub/GAME_NIGHT_SEAM_CONTRACT.json`
- `tools/game-hub/game-library/010-living-globe-tycoon/game.manifest.json`
- `tools/game-hub/game-library/013-toonfall-gatewatch/game.manifest.json`
- `tools/game-hub/game-library/014-bonk-and-bolt/game.manifest.json`
- `tools/game-hub/game-library/017-small-odds/game.manifest.json`
- `tools-index.json` (mechanically regenerated from the final source tree)
- this receipt

The worktree was already broadly dirty. Exact pre-edit SHA-256 snapshots were
recorded before touching the seven hand-edited seams, and the concurrent
Browser/LAN Hardware QA Lab authority repair was left untouched.

## Verification

Focused:

- `node tools/game-hub/game-package-verifier-selftest.js` — PASS, 21 assertions.
- Direct verification of slots 010, 013, 014, and 017 — PASS, zero errors;
  warnings only for the two touch-capable pending packages.
- `node tools/game-hub/game-package-verifier.js` — PASS, 19 folders, 0 failures,
  17 visible physical-phone warnings.
- JSON parse of the contract and four manifests — PASS.
- `npm run index:tools` — PASS, 218 tools, 1907 capabilities, 126 ready for
  human review; the generated index matches the final source tree.

Required Workshop checks:

- `node verify.js` — PASS, `0 FAIL · 17 warn`, spine
  `b618c5762240070c`.
- `node hub/hub-selftest.js` — PASS.
- `node hub/route-selftest.js` — PASS.
- `node hub/graft-selftest.js` — PASS.
- `node hub/skin-selftest.js` — PASS.
- `node hub/verify-plus.js` — PASS; verification spine remains
  `VERIFIED_WITH_LIMITS`.
- `node tests/html-script-syntax-test.js` — PASS, 55 HTML files.
- `node tests/tool-forge-package-test.js` — PASS; generated package remained
  `EXPERIMENTAL` and `installed: false`.
- `node tools/agent-tool-forge/selftest.js` — PASS, 17 checks.
- `node tools/evidence-desk/selftest.js` — PASS, 36 checks.
- `node tools/game-hub/steam/steam-readiness-selftest.js` — PASS, 19 games,
  17 warnings preserved, verdict `HOLD`.

No browser render/click test was run because this increment changed verifier
logic and JSON declarations only. No browser result is implied.

## Hash boundary

The table covers the hand-edited shared seams. The generated tools-index hash
is intentionally not embedded because this receipt itself participates in that
index's structural source digest; the final `verify.js` result is the readback.

| File | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `game-package-verifier.js` | `C339644F7E6191CEF400EFA0716493FAF3BD49C257E6AAC8EF410E1097E9BD8C` | `C5B8A2F1A3D295179F970AF802D12FC91E461110088D4079EF44C9295DDD1325` |
| `game-package-verifier-selftest.js` | `C5AA04C021D96317CE0525C71EAEB70AADC524D7B1FAF74D2EE5AEEBC8ED04AD` | `19E07982C0075E486249B8282F42AC84A1D7D8D2D0EF7F2B3A602D406E297DF0` |
| `GAME_NIGHT_SEAM_CONTRACT.json` | `16FFA2EEC4C609D9C80C34DDECE3D6AD52FBA97119754046D886F38774AD7152` | `98F7A3A5A70C3C509DB982CAB39653922D11CA66BBA96CFB62A1E43FAF5FC18F` |
| slot 010 manifest | `483748116C7556987A130E47476962364E9EA86F573A3CD786C611CDA73ABF02` | `91232BAAE579CC71D47095075DE2608959D8F3BF1276A99F5282E5FAE6E97385` |
| slot 013 manifest | `7C3D35EFA0A95492DBBED3488F37A0C96E73A7674AF8BEA8DBDC21A09DADD562` | `AF4DB8A9BC9D2DF902E67C42831D62C8344E8AA5C528595211393625A769ED0F` |
| slot 014 manifest | `EF30A2FB7DBD24F9E2F24E81106CB295DB45653829C1B9ADF0DCA4A3C0CCCEFE` | `F410487B9392D19EF4E08BDB6950A50C7DC84FB876743FD37092BF2D9E6A1DB7` |
| slot 017 manifest | `A5E8B073877912A9A39826DD465091F0E69B4EDA6E02401B1A4E1CCFD2DAB9E5` | `AF67FB758AF4B8E3C401061BFB7A4AD0D49CA787F2921012B810F01AEEC8CBE9` |

## Remaining boundary

The Workshop remains **WORKING / TEST**, not `CANON`. Seventeen game packages
still correctly expose physical-phone QA as pending. Closing any of those gates
requires recorded external handset observation and steward review; package code
cannot promote itself.
