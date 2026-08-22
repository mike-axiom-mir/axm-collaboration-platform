# Pulse Choir 012 low-poly visual pass 01

Date: 2026-08-16  
Status: `TEST`  
Scope: lane-local WebGL venue and gameplay depth layer  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

Pulse Choir already had a strong 16-bit-inspired show identity and genuine
custom WebGL venue architecture. Its documented gap was that the shared core,
players, beats and hazards existed only in the authoritative Canvas overlay.

This narrow renderer pass keeps that overlay and adds a second dynamic WebGL
buffer beneath it. The new layer builds low-poly 3D silhouettes for:

- the octahedral shared Pulse Core, two rotating rings and twelve charge pylons;
- every live player, including body, faceted head, visor, cargo and shield/sync rings;
- Spark pyramids, Chord cubes and Wild octahedra with floor halos;
- horizontal and vertical warning/active glitch volumes;
- two extra segmented stage rings plus a height-aware 5-bit color and scanline shader.

The source declares visual pass `constellation-depth-02`. It is still the
project-authored dependency-free WebGL renderer: no remote URL, downloaded
model, texture, font, audio, unseeded randomness or runtime service was added.
The Canvas remains the crisp semantic surface and WebGL failure fallback.

The server remains authoritative. This pass reads snapshots only and does not
change simulation state, actions, AI, seats, scoring, Setlists, Room Signal,
checkpoints, handback, controls, save shape or Foundation boundaries.

## Fresh Browser proof

Captures are fresh 1265 × 720 Chromium screenshots from the isolated
`127.0.0.1:18802/games/012/` runtime with checkpoints explicitly disabled.
This kept the registered port 8802 runtime and its recovery state untouched.

| Evidence | Observation |
| --- | --- |
| `baseline/01-lobby.png` | Untouched lobby composition before renderer edits. |
| `baseline/02-active-arena.png` | Untouched Moonwell active play: static WebGL venue beneath Canvas-only gameplay entities. |
| `baseline/03-help-overlay.png` | Untouched strategy overlay and recovery baseline. |
| `after/01-dynamic-arena-iteration.png` | Moonwell with 4,014 static and 2,118 dynamic WebGL vertices, 14 beats, three players and a dynamic core. |
| `after/02-keyboard-movement.png` | CUA movement changed P1 from `(50,16)` to `(51.3,14.674)` and advanced semantic sequence 0 → 17. |
| `after/03-pulse-feedback.png` | CUA Space advanced P1 semantic sequence to 18 while the live depth layer continued. |
| `after/04-core-pulse.png` | P1 approached the core at `(51.3,26.78688)` and sent another accepted pulse input. |
| `after/05-help-overlay.png` | `H` opened the strategy overlay over the changing 3D arena. |
| `after/06-reduced-motion.png` | Escape recovered play; the Reduced Motion control set both `aria-pressed=true` and WebGL dataset `motion=reduced`. |
| `after/07-glitch-lane.png` | Authoritative active horizontal glitch at line `43.975...`; both the low-poly volume and crisp Canvas warning remained visible. |
| `after/08-result-overlay.png` | Fresh reload restored the authoritative Show Receipt overlay. |
| `after/09-prism-causeway.png` | Play Another Round entered live Prism Causeway with 2,274 dynamic vertices and venue-specific architecture. |
| `after/10-live-frame-a.png` | Live frame SHA-256 `fa807bbc9c55f16be64a32d0fafc4a5f12b2db82f71f4b4d5bd74f2448aea0f5`. |
| `after/11-live-frame-b.png` | Live frame 720 ms later, distinct SHA-256 `8a6d0a6675e6a0b4b0030128f873bdfe232065c66c2c1395655e812c7885abd0`. |

Three screenshots sampled at 0, 360 and 720 ms produced three distinct
SHA-256 digests, proving live visual change. The active Browser capability has
no ephemeral rolling-frame buffer, so exact cadence and dropped frames remain
an optional evidence gap.

DOM datasets reported `renderer=webgl`,
`visualPass=constellation-depth-02`, `worldCore=dynamic-octahedron`, three live
world actors and 14 live world beats in Moonwell. The visible frame-cost label
reported eight consecutive 1.8 ms samples against the game-declared 16.7 ms
budget. This is a bounded Browser observation, not a low-end GPU benchmark.

## Player journey proof

The verified journey was:

`lobby → Start → countdown → Moonwell active play → keyboard movement → pulse → help → Escape → reduced motion → active glitch → results → reload recovery → Play Another Round → Prism active play`

Runtime state proved the movement coordinates, accepted semantic sequences,
venue transition and active glitch. Screenshots prove the corresponding pixels,
composition, overlay fit and recovery. Tests and source are supporting evidence,
not substitutes for those live observations.

## Shared-workspace integrity

The complete 012 package was already untracked inside a very dirty shared
worktree. During baseline capture, another builder changed the exact shared
manifest and provenance seams:

- `game.manifest.json` moved from
  `2655b7e9fd99336437b95ff86bedaac1b3ea8cae4b34b12d412bde1456995d06`
  to `f10c5749a2430800979e275c663736bb7900f54b358c579dd92fe364a49dfdd7`.
- `ASSET_PROVENANCE.md` moved from
  `dbe80febb2f44b93e4742400f38a623395e80b2f8a2a8392b004eed836aa8d3e`
  to `88877cc260655194506b8af422e2ff851754a3f7d2b2b45e4506a3ddedeabb4c`.

This lane immediately narrowed to the stable renderer plus new leaf evidence.
It did not edit, revert, reformat, register into, or claim those foreign shared
changes. `runtime/app.js` and `runtime/styles.css` also remained byte-identical.

| Lane-owned file | Start SHA-256 | End SHA-256 |
| --- | --- | --- |
| `runtime/arena-3d.js` | `bf80417dd231ff05e965f72bf65209a3c565717230afe9e91b532af48b06e117` | `cc848187fb90795b16834afd600c4417620f2339d2bc47127b7979bb7f5e5ff6` |
| `tests/pulse-choir-3d-polish-selftest.js` | absent | `af6c28a388db79fc435551a0cc395fe63270480b1a509a22da05fc3158bf80e3` |

The final workspace snapshot found no 012 file inside the five-minute active
window, but the repository-wide scan was truncated and an unrelated shared seam
was active. Scoped `git diff --check` passed.

## Verification

- `node --check runtime/arena-3d.js`: pass
- `node tests/pulse-choir-3d-polish-selftest.js`: pass
- `npm test`: pass
  - Pulse Choir core selftest: `25 PASS`
  - HTTP lifecycle: pass
  - runtime recovery: pass
  - Game Hub handback: pass
- Browser lobby, start, movement, pulse, help, Escape, reduced-motion,
  active-glitch, results-reload, replay and second-venue checks: pass

All ten required Workshop checks passed after the change on 2026-08-16:

- `node verify.js` (`0 FAIL`, 41 existing warnings retained)
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js` (`55 PASS`, `0 FAIL`)
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js` (`17 PASS`, `0 FAIL`)
- `node tools/evidence-desk/selftest.js` (`36 PASS`, `0 FAIL`)

Known non-failing repository warnings remain: legacy `UNDECLARED` tool kinds,
a stale `tools-index.json`, and verification-spine `VERIFIED_WITH_LIMITS`
warnings. Passing tests do not canonize this pass.

## Still unrun / not claimed

- Physical phone, Bluetooth gamepad, television-distance and Steam Deck QA
- Low-end GPU, integrated GPU, ultrawide, thermal and long-run performance
- Visual proof of Static Garden, Twin Comet Bridge and Dawn Archive in this pass
- Human fun, balance, fairness and replay-desire judgment
- Steam depot packaging, overlay, achievements and controller certification
- Exact frame cadence and dropped-frame measurement
- Direct visual Game Hub landing after handback in this Browser backend

This is a tested visual increment, not Steam acceptance and not canonization.
