# Tilburg Streetscape Foundation v0.3.0 — evidence route

Date: 2026-07-24  
Lane: `tools/game-hub/game-library/008-district-party`

## visual_readability

claim: The close top-down city no longer presents as anonymous BGT footprint masks; roads, curbs, pavements, roof components, water, greenery, landmarks, markings and props are visually separable.  
kind: visual appearance / quality  
risk: high  
pass_condition: Same-scale exterior gameplay and gameplay-scale centre views expose a readable public-way and city-block hierarchy without changing world geometry.  
primary_surface: Live 1870 × 1037 all-party gameplay plus actual-renderer centre preview.  
counterevidence: `city-presentation-before-v0.2.9.png` and the rejected v0.2.9 preview set.  
observed_evidence: `city-presentation-after-v0.3.0.png`, `tilburg-centre-art-pass.png`, `party-house-art-pass.png`; repeated browser frames; no browser console errors.  
verdict: AGENT PASS; HUMAN VISUAL APPROVAL PENDING  
named_seam: Human taste and release art direction cannot be approved by tests or an agent.

## authoritative_world_integrity

claim: Collision, map/chunk geometry, mission coordinates, spawns, NPC routes, territory data, save state and multiplayer authority remain unchanged.  
kind: static structure / deterministic behavior  
risk: high  
pass_condition: Repair stays in renderer/art-profile/docs/tests/previews; authoritative data is not modified and complete regression checks stay green.  
primary_surface: Shared-workspace before/final snapshots and 178/178 unit/integration tests.  
secondary_surface_if_needed: CLI lifecycle smoke through live server start/input/state/end.  
counterevidence: Any edit to `data/map.json`, `data/map-chunks/`, mission/spawn/route/territory data, or a functional test failure.  
observed_evidence: No authoritative data path appears in the repair file list; 178/178 PASS; CLI lifecycle PASS; real controller packets moved two actors through the existing Party House door to exterior positions.  
verdict: PASS  
named_seam: None.

## deterministic_presentation

claim: Static city-art output is deterministic while live animation retains the browser clock.  
kind: deterministic behavior  
risk: medium  
pass_condition: Two consecutive actual-renderer runs produce byte-identical PNGs without freezing the live runtime.  
primary_surface: SHA-256 comparison of nine regenerated previews.  
counterevidence: Any preview hash differs.  
observed_evidence: All nine hashes matched; recorded in `docs/previews/preview-sha256.txt`. Preview harness injects `() => 0`; runtime defaults to `performance.now()`.  
verdict: PASS  
named_seam: None.

## live_gameplay_seams

claim: Camera, map overlay, controller input, chunk streaming and renderer performance remain usable.  
kind: interaction journey / performance  
risk: medium  
pass_condition: Real input changes authoritative positions; camera follows; map opens and Escape restores play; visible chunks settle with no loading backlog; measured frame rate remains above 50 FPS for the declared view.  
primary_surface: Live local server and in-app browser.  
counterevidence: Input rejection, collision escape, stuck overlay, camera jump, console error, loading backlog or sustained measured FPS below 50.  
observed_evidence: Actors moved from `(6584,6216)` / `(6696,6216)` to exterior `(6773.6,6516.2)` / `(6785.5,6674.2)` through real token-bound controller packets; map `aria-expanded` changed `false → true → false`; live debug showed 91 FPS, zoom 2.07, 19 loaded / 0 loading / 9 nearby chunks at 1870 × 1037.  
verdict: PASS for the declared local workload  
named_seam: Physical phones, target television displays and physical eight-player play remain untested.

## release_appearance

claim: The v0.3.0 art direction is enjoyable and ready for human release approval.  
kind: taste / meaning  
risk: high  
pass_condition: A human steward reviews the retained before/after and live target display.  
primary_surface: Human visual judgment.  
counterevidence: Human rejection or observed target-display readability problems.  
observed_evidence: Agent visual pass only.  
verdict: PENDING  
named_seam: Human approval required.
