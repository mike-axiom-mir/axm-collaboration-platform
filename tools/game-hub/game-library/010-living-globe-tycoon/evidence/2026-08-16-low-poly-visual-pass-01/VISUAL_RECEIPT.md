# Living Globe Tycoon 010 low-poly visual pass 01

Date: 2026-08-16  
Status: `TEST`  
Scope: registered Living Globe Tycoon walkable-globe mode  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

Living Globe already had a real local Three.js r160 world, so this pass kept
that renderer and added a contained presentation-only art-direction layer. The
new layer renders a 960-vertex faceted gradient sky, banded daylight/golden
hour/night palettes, low-segment sun and moon glyphs, 729 current terrain
contour segments, crisp low-poly shadows, a subtle scanline treatment, and a
title composition that previews the live 3D island instead of covering it.

The canvas declares `data-visual-authority="presentation-only"` and
`data-visual-pass="low-poly-atmosphere-01"`. This pass did not change world
authority, ecology, missions, economy, treasury, saves, player-seat gates,
actions, resources, simulation clocks, or Foundation boundaries. It adds no
remote URL, fetch, unseeded randomness, downloaded texture, model, font, audio,
or raster art.

## Browser proof

All captures are fresh 1280x720 Chromium screenshots against the isolated
`127.0.0.1:18800/games/010/` runtime. That origin kept its browser-local world
state separate from the normal slot 010 port.

| Evidence | Observation |
| --- | --- |
| `baseline/01-entry.png` | Original opaque teal entry screen; the 3D island is completely hidden. |
| `baseline/02-world.png` | Original world with flat lavender sky and existing low-poly island assets. |
| `after/01-title-iteration-a.png` | First live-island title composition; retained as the initial visual direction. |
| `after/02-world-iteration-a.png` | First faceted daylight gradient and crisp low-poly shadow pass. |
| `after/03-world-contours.png` | Tuned terrain relief with 729 contour segments at restrained opacity. |
| `after/04-night-sky.png` | Starry night proof with the same live island and HUD. |
| `after/05-island-brief-overlay.png` | Existing shared Island Brief remains readable and complete. |
| `after/06-world-resumed.png` | Closing the brief restores the live 3D world with visual datasets intact. |
| `after/07-keyboard-movement.png` | Keyboard movement approached a different tree and exposed the live `CHOP TREE` interaction prompt. |
| `after/08-title-final.png` | Final title composition over a night island. |
| `after/09-title-day-final.png` | Final title composition over a daylight island. |
| `after/10-live-frame-a.png` | Final live frame, SHA-256 `f8c392742b7d2a88bca8c6713e9df1fb11eb7818b3bfd12213c98a47a564bbe6`. |
| `after/11-live-frame-b.png` | Same route 900 ms later, distinct SHA-256 `cd6f333e0c442dc175b3a8be8a8f699ea857e41a0e5f71a155b1c749678fbca2`. |

Fresh diagnostics reported Three.js r160, 960 sky vertices, 729 terrain
contour segments, presentation-only authority, daylight and night phases, and
no browser console logs. Distinct final-frame hashes prove live animation.
Exact cadence remains unknown because the active Browser capability exposes no
ephemeral rolling-frame buffer; `CAPABILITY_RECEIPT.json` records that as an
`OPTIONAL_GAP`.

## Source integrity

The entire 010 directory was already modified in a very dirty shared
workspace, and `LICENSE_STATUS.md` was already untracked. Foreign changes were
not reset, reformatted, or claimed. Start hashes were captured before this lane
edited every pre-existing file below.

| File | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/game/index.html` | `aeda683745fe966a9841db604722fa0f4d6de21942d5c6568fb25e1e835969dd` | `6e542b13b68d0f21a3efa11d361c17d6517f962dd235e91e63fbd27e43b90255` |
| `runtime/game/tests/run-tests.js` | `5f5d4b41d7c3705dcb6f0947852b102ebc3cbff723669c6a60b1f424cdfbb914` | `d889834d53dc8ee7d84cbe8b29b23f6f40f26b4da39901773240fcc1141fca54` |
| `game.manifest.json` | `c1573f038bf2602be606aaff929d3fda9edb6396f6788df50eae096edecf39c9` | `2d77e190fdaf7ad8633ed54313498a9516d21c5a447741cfcec29030492c4b02` |
| `runtime/game/core/island-visual-polish.js` | absent | `03de72378bcaddd85dbcfde4b2477be5a06e5747cd1ba9a6874451b48041e71c` |

Scoped `git diff --check` passed. Git emitted only existing LF-to-CRLF
working-copy warnings.

## Verification

- `node --check runtime/game/core/island-visual-polish.js`: pass
- Living Globe honest exam: `103 PASS`, `0 FAIL`
- GameHub wrapper selftest: pass
- Browser entry, daylight, night, keyboard approach, brief overlay, close recovery, and repeated-live-frame checks: pass

The first baseline command used a path relative to the wrong working
directory and exited before running the suite. The corrected repository-scoped
command then completed with `102 PASS`, and the post-change suite completed
with `103 PASS`; this was an operator invocation error, not a product failure.

All ten required Workshop checks passed after the change on 2026-08-16:

- `node verify.js` (`0 FAIL`, existing warnings retained)
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Known non-failing repository warnings remain: 43 current verifier warnings,
legacy `UNDECLARED` tool kinds, a stale `tools-index.json`, and
verification-spine `VERIFIED_WITH_LIMITS` warnings. Passing tests do not
canonize this pass.

## Still unrun / not claimed

- Complete four-errand tour and every ecology/season/weather visual combination
- Connected AI-seat co-op in a live browser, simultaneous human/AI camera stress, and adapter integration
- Touch controls, real LAN, television-distance, accessibility, and audio QA
- Steam packaging, overlay, launch options, controller glyphs, and Deck QA
- GPU compatibility matrix, sustained performance, thermal, and long-run soak tests
- Exact frame cadence and dropped-frame measurement

This is a tested visual increment, not Steam acceptance and not canonization.
