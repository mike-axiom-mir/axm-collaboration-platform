# Action Report

## Build

- **Name:** AXM Style Fabric
- **Module ID:** `axm.style-fabric`
- **Version:** `0.5.0`
- **Date:** 2026-07-28
- **Status:** WORKING / TEST
- **Canon:** No
- **Integrated into AXM:** No
- **GitHub modified:** No
- **Network service added:** No

## Direction preserved

- Built as the first standalone modular skin organ because current AXM games have no skin hooks.
- No assumption that the rapidly grown Workshop already exposes compatible adapters.
- No Foundation overwrite, Game Hub promotion, automatic merge, or automatic CANON.
- Preserved Creative Studio → Asset Vault → Style Fabric as the later intake route.
- Kept machine users visible and equal: structured intent and human controls compile into the same recipe.
- Kept skins at zero authoritative gameplay writes.
- Preserved the complete v0.1 through v0.4 working packages as predecessors;
  this pass was built in a separate v0.5 working line.

## Fifth steward pass

- Added one full Test Chamber containing all 33 semantic game surfaces.
- Added seven-organ filtering, semantic search, and explicit authored,
  connected, and fallback states.
- Added isolated base, secondary, accent, glow, metallic, roughness, gloss,
  and opacity editing with provenance and one-surface reset.
- Added an engine-neutral adapter conformance assessor with six structural
  checks and four explicit runtime-observation prompts.
- Kept conformance evidence honest: declarations are not automatic
  certification, mold changes reset evidence, and reports state
  `automaticWrites: 0`.
- Preserved portable v1 contracts, every prior preskin and mold, and all game
  fallbacks.

## Fourth steward pass

- Kept **Style Fabric** as the umbrella name because the contract now covers
  whole-game presentation; kept **Character Forge** as its focused character
  design organ.
- Expanded the surface library from six to 33 semantic slots.
- Grouped those slots into seven isolated organs: world, structures/props,
  vehicles/equipment, items/projectiles, characters, effects, and interface.
- Expanded the mold catalog from eight to 16 targeted game patterns.
- Expanded the deterministic compiler so a full recipe carries authored
  materials and bindings for every surface.
- Added category coverage receipts with `automaticWrites: 0`.
- Expanded the creator mixer from four sources to seven independent sources.
- Added eight new starter kits and eight new game contracts, bringing totals
  to 20 and 16.
- Preserved the v1 pack and game-contract formats plus legacy material IDs.

## Third steward pass

- Added eight semantic molds for future-game adoption.
- Added deterministic contract generation from those molds.
- Added a local mold maker driven by visible seed, mood, complexity, and scope.
- Added 12 portable starter kits and eight example game contracts.
- Added an isolated four-organ mixer for world, character, interface, and effects.
- Namespaced layer materials, assets, and blueprints to stop scope leakage.
- Added legacy, balanced, showcase, and reduced-motion performance profiles.
- Added explicit-only binding remaps and compatibility negotiation without
  automatic game writes.
- Preserved v1 pack and game-contract compatibility.

## Second steward pass

- Added 25 preskins across six clearly named families.
- Made every preskin an editable ordinary intent, not a locked official path.
- Added deterministic two-preskin fusion with exact source and blend
  provenance.
- Added five deterministic palette harmonies.
- Expanded bounded style words from 18 to 32.
- Added 19 declarative pattern languages.
- Expanded material, motion, pattern, geometry, silhouette, head, outfit, and
  accessory choices.
- Added 25 portable integrity-stamped preskin packs and a catalog.
- Added visible outfit, accessory, character-pattern, and shape response in the
  specimen.

## Implemented

- Versioned universal skin-pack contract.
- Versioned game skin-slot contract.
- Separate immutable pack and per-user skin-instance contract.
- Deterministic structured style-intent compiler with recorded seed.
- Bounded natural-language phrase interpreter with unknown-word reporting.
- Palette, material, effect, accessibility, and character-appearance model.
- Whole-game, character-only, and reusable-style modes.
- Semantic slot resolver with explicit full/partial/incompatible result.
- Layer receipts: applied, inherited, protected, unsupported, and unknown.
- Full 33-surface Test Chamber and isolated per-surface editor.
- Read-only future-game adapter conformance report and Studio evidence lab.
- Game-owned fallback behavior.
- Explicit proposal → approval → apply → rollback runtime.
- CSS-variable reference adapter and future-game adapter templates.
- Local futuristic creator with live specimen, original comparison, motion pause, and inspectable JSON.
- Custom PNG/JPEG/WebP import and slot binding.
- Portable `.axmskin.json` import/export.
- Local IndexedDB skin library with content-hash identity.
- Canonical SHA-256 with browser fallback for local HTTP/LAN.
- Pack and asset integrity verification.
- Local and future-hosted policy profiles.
- Share-provider contract without network implementation.
- Beginner documentation, integration guide, AI-native guide, security model, adoption levels, character-design roadmap, and body card.

## Security controls implemented

- Declarative presentation-only capability allowlist.
- Gameplay/authority/code/script/network/permission/filesystem/prototype-pollution fields rejected.
- Remote assets and raw SVG denied.
- Raster MIME/data URI/magic-byte/hash/dimension/pixel/byte checks.
- Finite bounded material values.
- Pack size, asset count, per-asset, total embedded, dimension, and pixel limits.
- Integrity mutation detection.
- Game-owned visibility/contrast protection.
- No hidden public upload or telemetry.

## Actually run

- Node unit tests: `60 PASS / 0 FAIL`.
- Package verification script: `101 PASS / 0 FAIL`.
- Example deterministic compile.
- Example pack validation and integrity verification.
- Local HTTP route smoke test.
- Deterministic mold-maker repeatability.
- Seven-organ composition and scope isolation through automated contract tests.
- Structural adapter conformance and declared-runtime-evidence state
  transitions through automated contract tests.
- Static Test Chamber control/HTML contract verification.
- Legacy performance cap across material and shared motion tokens.
- HTTP smoke: redirect, Studio, module, and mold catalog routes returned the
  expected responses with the security headers present.
- The cloud browser declined access to the loopback preview. No v0.5 live
  visual or interaction claim is made for the changed chamber layout.

## Package seal

- 136 source files covered by `FILE_MANIFEST.sha256`.
- Clean extraction verification: `136 / 136 PASS`.
- ZIP structure test: PASS.
- The final ZIP SHA-256 is delivered next to the archive because an archive
  cannot contain its own final digest without changing that digest.

## Visual repair record

1. First private preview showed unstyled fallback HTML.
2. Cause: root route served `studio/index.html` without redirecting relative asset paths.
3. Repaired server root to redirect to `/studio/`.
4. Second preview rendered the full neon/glass creator but exposed missing Web Crypto on local HTTP.
5. Added a deterministic pure-JavaScript SHA-256 fallback.
6. Live Character mode then exposed global preview tokens leaking into fallback world visuals.
7. Repaired specimen fallback so character-only scope leaves world, enemy, and effects on game-owned defaults.
8. Final desktop frame and live scope loop passed.
9. The first v0.2 live fusion check exposed a hidden 0% default when adding a
   second preskin.
10. Repaired new fusion selections to begin at a visible 50%.
11. Character-only fusion then exposed shared player material variables on the
    reactor and enemy specimen.
12. Split player, enemy, and world/FX variables. Final evidence showed:
    world `#4e79ff / #31b39f / #ffb454`, world glow `0.12`, enemy glow `0.12`,
    fused player `#9ca99a`, one applied slot, five fallbacks.
13. The v0.3 live performance check found material motion capped to zero while
    shared motion tokens still animated the preview.
14. Extended performance profiles to cap both material and token motion.
15. Repeated live evidence showed legacy glow `0.22`, valid layer-stack output,
    and settled preview motion `paused`.

## Not implemented

- Direct adapters for existing AXM games.
- Foundation, Asset Vault, Creative Studio, or Game Hub integration.
- Hosted sharing/gallery/moderation/accounts.
- Public ZIP package importer.
- Hardened sandbox image decoder/re-encoder.
- Finished sprite/rig/animation/3D character generation.
- Platform certification.
- Automated target-renderer certification; every adopting game must produce
  its own runtime observations.
- Physical Android/mobile visual verification.

## Final truth label

`STANDALONE MODULAR WORKING / TEST SYSTEM — READY FOR LOCAL AXM INTAKE REVIEW, NOT INTEGRATED OR CANON`
