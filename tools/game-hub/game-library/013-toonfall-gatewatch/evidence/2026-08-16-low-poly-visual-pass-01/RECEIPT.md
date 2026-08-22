# Gatewatch low-poly visual pass 01

Status: **WORKING · not CANON · Mike review required**

Sealed: 2026-08-16T09:21:37+02:00

## Scope

This pass upgrades slot 013, `Bloomvale: Gatewatch`, without changing its
authoritative game rules. Canvas keeps the illustrated terrain, exploration
objects, aiming, effects, labels, and the complete WebGL-unavailable fallback.
The transparent WebGL layer now owns the live Heartlight and gameplay pieces.

The WebGL pass adds:

- faceted box, pyramid, octahedron, and segmented-ring primitives;
- low-poly Pippa and Moxie silhouettes driven by authoritative position,
  facing, downed, and Prism Counter state;
- distinct Nib, Sprinter, Bruiser, Siphon, and Ink Crown silhouettes;
- authoritative enemy-windup rings, projectiles, counter projectiles, pickups,
  the active breach gate, and Heartlight geometry;
- a 16-step-per-channel palette with pixel checker/scanline treatment;
- a transparent, input-pass-through composition and reduced-motion camera;
- live DOM receipts for actor, enemy, projectile, pickup, vertex, phase, watch,
  and renderer-frame counts.

An initial attempt to place all terrain and exploration objects in the upper
WebGL layer was rejected after screenshots showed poor registration and visual
clutter. Those meshes are not part of the accepted pass.

## Visual evidence

Untouched baselines:

- `baseline/01-story-lobby.png`
- `baseline/02-exploration.png`
- `baseline/03-wave.png`

Accepted after evidence:

- `after/01-story-lobby.png` — story overlay remains readable.
- `after/02-exploration.png` — hybrid exploration entry and 3D ownership split.
- `after/03-movement.png` — keyboard movement changed the route objective from
  320 to 310 paces while the low-poly defenders remained registered.
- `after/04-wave.png` — first live combat wave with two WebGL enemies.
- `after/05-projectile.png` — a live WebGL projectile was reported.
- `after/06-pause.png` and `after/07-resumed.png` — pause overlay and recovery;
  renderer frames advanced from 5043 to 5111 after resume.
- `after/08-prism-counter.png` — authoritative perfect dodge with the HUD at
  `PRISM COUNTER · 2.0s` and four live enemies.
- `after/09-prism-shot.png` — shot-mode preparation reported two live WebGL
  projectiles, including the authoritative counter projectile.
- `after/10-motion-a.png` and `after/11-motion-b.png` — screenshots 360 ms apart
  have different SHA-256 digests.
- `after/12-reduced-motion.png` — renderer reported
  `reduced-locked-camera` after the visible motion toggle.

The screenshot inventory and SHA-256 digests are in `verification.json`.

## Verification

Focused package checks:

- `node tests/toonfall-3d-polish-selftest.js` — PASS, 30 checks.
- `node tests/toonfall-selftest.js` — PASS, 43 checks.
- `node tests/server-http.test.js` — PASS.
- `node tests/partner-choice-http.test.js` — PASS.
- `node tests/live-counter-visual-driver.js ... armed` — PASS; one perfect
  dodge, 2352 ms counter time remaining.
- `node tests/live-counter-visual-driver.js ... shot` — PASS; authoritative
  48-damage counter projectile captured in state.
- `node tests/live-semantic-driver.js http://127.0.0.1:18803` — PASS; five-watch
  victory, 83 kills, all five bounded receipts, full Heartlight, 64 human kills,
  and 277 human shots.

All ten required Workshop commands returned exit code 0 after the final code
cleanup. `verify.js` still reports the Workshop's existing warnings; a zero
exit code does not canonize this pass.

## Source receipts

| File | Start SHA-256 | Sealed SHA-256 |
| --- | --- | --- |
| `runtime/app.js` | `e2f41e3caa1af857184dca0b9a5563812d5fe771940da3e9c1a8665a43e96301` | `5d5c776bd5ea1ca8d327bd9f142a9c728ae3dd1d1f593eddd0f341ec5a200aab` |
| `runtime/bloomvale-three.js` | `761f3e275a0c850bd76073d6d0e4ed43490c60d25cbcb0db5eabff9f4d925ab1` | `8339ae809488d1828a68f4b03b92f3eb8c1a1c19c5a454df44ea761ba5cdaaf2` |
| `runtime/styles.css` | `d7bdc5de13f5f6af4014658b14a86cd18f00f4fcbefde2fbe9824e0befb94583` | `1b0e2da679d81deb88180ea83c9d3c353715d39b9c68785f0f9b26029a1933d0` |
| `tests/toonfall-3d-polish-selftest.js` | absent | `0c9c0e62daac55b1cd214e1371c7342bba074777591fe96a6d7f2ab6efd10863` |

## Open limits

- Physical gamepad, LAN/phone, Steam integration, store packaging, controller
  certification, long soak, and broad GPU performance remain unverified.
- Continuous rolling capture was unavailable; repeated screenshots are bounded
  observations and do not prove every frame between them.
- Visual quality is subjective and still requires Mike's human play/review.
- The package metadata seam changed independently during this pass and was
  preserved. `KNOWN_LIMITS.md` and `ASSET_PROVENANCE.md` still contain older
  composition wording that should be reconciled in a dedicated shared-seam
  review before release.

