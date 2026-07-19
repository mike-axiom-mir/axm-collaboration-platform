# Circuitseed director's cut — v0.2.0

Date: **2026-07-18**  
Status: **ALPHA CANDIDATE / WORKING**  
Scope: local-only presentation, exploration depth, optional progression, crafting breadth, and intake quality

## Direction

The roster remains deliberately fixed at **30 designs: 20 individual Circuitkin and 10 two-parent Confluence specialists**. The polish pass did not inflate that number. It gave the existing collection more places to live, more reasons to train, and more memories, work, objects, and visual identity around it.

This preserves the readable first-region codex while turning the collection loop into more than a checklist.

## New exploration and story layer

- Added **10 authored Memory Echo sites** across Lumen Yard, Relayborn Route, Threadwild, North Corewild, and Rootsignal Convergence.
- Every echo is found in the field and recovered through the ordinary authoritative **Scan** path.
- Every echo records a title, region, teaser, full fragment, artifact, provenance-bearing history entry, and optional recipe unlock.
- Repeated scans do not duplicate the keepsake or unlock.
- The archive preserves disagreement, uncertainty, recovery history, consent, empty seats, and continuity without flattening them into generic lore drops.
- Added an animated discovery reveal and a persistent journal with ten visible archive slots.

## New optional mission layer

- Added **16 Field Requests** in six categories: exploration, archive, relationships, Confluence, training, making, and chapter return.
- Requests have no timer and no away penalty.
- Eligibility is derived from real local profile state: discoveries, recovered echoes, individual connections, Confluences, field uses, recoveries, explicit specializations, crafted objects, fulfilled orders, reputation, and earned achievements.
- Claiming is host validated, one-time, ledger recorded, receipt backed, and portable with the participant profile.
- Rewards include local currency, materials, keepsakes, reputation, trust, and achievements.
- The request board shows exact progress and becomes visibly ready only when its requirements are met.

## New items, materials, crafting, and trade

- Expanded the item catalog to **45 named entries**:
  - 9 materials;
  - 10 crafted objects;
  - 10 Memory Echo keepsakes;
  - 16 request commendations.
- Expanded the world from 8 to **34 resource nodes**.
- Expanded crafting from 4 to **10 recipes**.
- Expanded local demand orders from 3 to **9 orders**.
- Business-path selection now unlocks its actual service recipe.
- The Corewild story reward now unlocks the Portable Anchor Node recipe.
- Additional recipes are learned from specific Memory Echoes.
- The craft surface now shows the live material shelf, known/unknown recipes, missing ingredients, and ready state before the host receives a craft request.
- The journal shows materials, crafted objects, keepsakes, commendations, quantities, descriptions, recipes, and milestones from the real profile observation.

## Presentation upgrade

- Added a large procedural title sculpture with orbiting signal nodes, three companion lights, and an animated unfinished seed.
- Added a full-field minimap with region bounds, routes, visible signals, camera footprint, party positions, and live coordinates.
- Added distance-aware nearby guidance for Scan, Connect, Act, Recover, Open, and Engage.
- Added animated region-entry cards with authored descriptions.
- Added distinct procedural emblems for all 30 Circuitkin designs in starter, codex, roster, and Confluence surfaces.
- Replaced the handful of generic field companion shapes with deterministic design-specific geometry and dual-core Confluence rendering.
- Added region-specific terrain language:
  - settlement lattice tiles;
  - Relayborn carrier lines;
  - Threadwild woven curves;
  - Corewild fault structures;
  - Rootsignal continuity rings.
- Added signal trails, ambient motes, resource-family color and glyph language, memory-site geometry, scan/connect/action effects, stronger route light, and signal-pressure vignette.
- Added responsive journal, inventory, request, crafting, and discovery-reveal layouts.
- Extended the shared party screen with archive/request/collection status and Memory Echo rendering.
- Extended the phone controller with archive/request status without changing its intention-only authority boundary.
- Added `J` for Journal and `B` for the Signal Board. `E` opens the nearby workbench/stall while still sending the ordinary Act intention.

## Authority and persistence

- No client sends a reward, eligibility result, item grant, or mission outcome.
- Memory rewards are committed during the authoritative scan handler.
- Field Request eligibility and rewards are computed server-side from the participant profile.
- New progress uses existing portable profile fields: discoveries, inventory, recipes, achievements, receipts, relationships, roster development, and history.
- No participant/world boundary was merged or redefined.
- No remote runtime, telemetry, CDN, cloud account, or external AI was added.

## Verification added

- Referential-integrity coverage for every echo, point, material, recipe, item, request reward, and unlock.
- Authoritative scan-path proof for keepsake and recipe recovery.
- Profile-derived journal and request observation proof.
- Field Request eligibility, one-time reward, receipt, refusal, and authenticated HTTP route proof.
- Bootstrap and UI-surface coverage for 10 archive slots, 16 requests, and 10 recipes.
- A temporary dependency-isolated DOM boot smoke loaded the real HTML/scripts against the real local server, started a journey, rendered all new surfaces, opened the journal, and ended cleanly.

Final automated package command at this pass: **PASS — 49/49 tests, CLI lifecycle, actual Game Hub lifecycle, result returned to lobby, child stopped, and package verifier.**

Rendered pixels and physical-device comfort remain honestly **UNRUN**. See `KNOWN_LIMITS.md` and `TEST_REPORT.md`.
