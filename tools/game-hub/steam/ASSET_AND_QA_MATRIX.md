# Steam asset and QA matrix

Status: **TEST** · required evidence is incomplete

The complete 10-image draft set now lives under `assets/draft/candidate/` and
passes the automated dimension/alpha/hash checks. It remains outside
`assets/final/`: Mike must approve the name, composition, disclosure, rights,
and store-rule fit before promotion. No generated image is being used as a
gameplay screenshot. Five separate 1920×1080 draft screenshots were resized
from observed live runtimes and pass dimension/hash/provenance checks. Their
source and interaction ledger is
`assets/draft/candidate/screenshots/screenshot-manifest.json`.

## Store and library art

Place final files under `assets/final/`. The readiness auditor validates the
current dimensions automatically.

| Asset | Required file | Dimensions | Content boundary |
|---|---|---:|---|
| Store header | `store-header.png` | 920 × 430 | artwork + product logo only |
| Store small | `store-small.png` | 462 × 174 | readable product logo + artwork only |
| Store main | `store-main.png` | 1232 × 706 | artwork + product logo only |
| Store vertical | `store-vertical.png` | 748 × 896 | artwork + product logo only |
| Shortcut icon | `shortcut-icon.png` | 256 × 256 | logo or representative art |
| App icon | `app-icon.jpg` | 184 × 184 | logo or representative art |
| Library capsule | `library-capsule.png` | 600 × 900 | artwork + product logo only |
| Library hero | `library-hero.png` | 3840 × 1240 | artwork only; no text |
| Library logo | `library-logo.png` | 1280 wide and/or 720 tall | transparent logo only |
| Library header | `library-header.png` | 920 × 430 | artwork + product logo only |

Capsules must not contain review scores, awards, discounts, marketing slogans,
or unrelated product promotion. The base capsule should say only the product
name/official subtitle over artwork. Use actual current Steam templates and
preview tools before upload.

Create at least five 1920 × 1080 or larger 16:9 gameplay screenshots under
`assets/final/screenshots/`. They must show real gameplay from the shipping
build, not generated concept art, pre-rendered mockups, awards, or written
marketing panels. A useful first set is GameHub shelf, accessible solo play,
shared-screen party play, one same-Wi-Fi controller flow, and a visually distinct
game with its real UI.

The current TEST candidate set shows live play from AXM Pong Duet, District
Party, Living Globe Tycoon, Bonk & Bolt, and Hexbound. These frames satisfy the
draft count and format contract only. Mike must approve the exact images, and
the same scenes must be rechecked against the eventual shipping build before
any copy is promoted to `assets/final/screenshots/`.

## Launch and play matrix

| Claim | Native proof | Current verdict |
|---|---|---|
| 19 packages are structurally launchable | `game-package-verifier.js` | PASS with warnings |
| Windows bundled runtime exists | runtime file + license + provenance inspection | PASS locally |
| Steam launch option starts the two correct services | fresh process + two health identities | PASS locally in TEST; dedicated shell + GameHub |
| Steam shell excludes Workshop authoring surfaces | live route probes + server selftest | PASS locally: Workshop/profile 404, asset authoring 403 |
| Secret-safe depot candidate can be reproduced | explicit content contract + source/staged scan + per-file hash manifest | PASS locally in TEST: 19 games, isolated selftest |
| Depot launches outside the Workshop tree | bundled staged runtime + independent health identities + live browser journey | PASS locally in TEST; not a Steam-client or second-machine proof |
| Default browser route is usable | live render and complete lobby/game journey | PARTIAL PASS: direct local routes; OS popup handoff unproven |
| Clean Windows install launches from Steam | Steam beta branch on separate machine | UNRUN |
| Game saves avoid the install directory | staged play + before/after depot digest + external state inspection | PARTIAL PASS: GameHub ledger and District Party route external; remaining save-bearing games need scoped checks |
| Keyboard-only solo path works | real inputs through one advertised solo game | PASS for staged Bonk & Bolt movement; library-wide matrix UNRUN |
| Gamepad works where advertised | physical controllers across declared games | PARTIAL PASS: Brace Room, Pong Cross, Bonk & Bolt and Buddyfarm logic + live labeled simulations; physical and library-wide QA UNRUN |
| Phone controllers work where advertised | two physical phones on same Wi-Fi | ONE DESKTOP CONTROLLER ACTION PASS; portrait and physical phones UNRUN |
| Disconnect and reconnect are safe | disconnect during active rounds | 10 manifest warnings remain |
| Blocking overlays always have an escape | controller/keyboard/phone interaction | 7 manifest warnings remain |
| Store descriptions match shipped features | build/store comparison | HUMAN REVIEW REQUIRED |
| Rights and licenses cover every included asset | source/license ledger review | 19/19 PACKAGES HAVE A REVIEW LEDGER; HUMAN CLEARANCE INCOMPLETE |

The bounded live receipt is
`LIVE_VISUAL_RECEIPT_2026-08-16.md`. It proves one controller action and one
overlay recovery only. It does not close the library-wide physical-device,
disconnect, clean-machine, or Steam-client gates.

Brace Room's package receipt is
`../game-library/019-brace-room/evidence/GAMEPAD_VERIFICATION_2026-08-16.md`.
It proves the universal mapping logic and real browser integration through a
visibly labeled simulated pad. It does not claim a physical controller pass.

Pong Cross's package receipt is
`../game-library/003-robo-pong-cross/evidence/GAMEPAD_VERIFICATION_2026-08-16.md`.
It adds edge-relative P1/P3 movement, held-input lease renewal, power,
pause/replay, disconnect, unsupported mapping, and AI-seat refusal evidence.
It also remains explicitly short of a physical-controller pass.

Bonk & Bolt's package receipt is
`../game-library/014-bonk-and-bolt/evidence/universal-gamepad-verification-2026-08-16.md`.
It proves stable P1/P2 movement, attack, dodge, class special, Menu pause/resume,
visible unsupported/disconnect fallback and inactive-seat refusal through a
labeled browser simulation. Physical controller feel remains unrun.

Buddyfarm's package receipt is
`../game-library/011-axm-buddyfarm/evidence/universal-gamepad-verification-2026-08-16.md`.
It proves stable P1/P2 movement, A/RT Action tap/hold travel, X Work, View map,
Menu controls, standard-mapping refusal, third-pad ownership refusal and
disconnect fallback through a labeled browser simulation. Physical gamepad
feel and three simultaneous physical pads remain unrun.

The isolated packaging receipt is `DEPOT_CANDIDATE_RECEIPT_2026-08-16.md`. It
proves a local TEST candidate and direct browser journey, not a Steam upload or
release candidate approval.

## Required release pass

Run the repository's required scripted checks, the GameHub/workspace suite, the
Steam readiness selftest, strict readiness audit, live browser journeys, a
clean-device Steam branch install, physical controllers/phones, suspend/resume,
offline restart, and uninstall/reinstall save behavior. Script compilation or
an HTTP health response does not count as a browser render/click pass.
