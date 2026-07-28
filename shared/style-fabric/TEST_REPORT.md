# Test Report

Version: **0.6.0**  
Date: **2026-07-28**  
Status: **FINAL RELEASE-CANDIDATE VALIDATION PASSED — WORKING / TEST**

This report records evidence from the final packaged v0.6 source state.

## Automated unit suite

Command: `npm test`

Final result: **109 passed / 0 failed**

The suite covers:

- deterministic recipes, phrase parsing, seed variation, and SHA-256;
- exact mold-scoped bindings, materials, blueprints, and capabilities;
- 25 editable preskins, six families, fusion, and five palette harmonies;
- 16 built-in semantic molds, 33 surfaces, and valid generated contracts;
- Mold Foundry validation, explicit forge/grow receipts, and zero automatic
  game writes;
- seven game-skin organs, deterministic stack composition, conservative
  accessibility merge, and source-integrity lineage;
- Treatment Forge mold validation, exactly three distinct deterministic
  drafts, performance/reduced-motion caps, target isolation, legacy fallback,
  and zero automatic save/apply/promotion;
- Studio control/HTML contracts, accessible selection states, Treatment Forge
  controls, Test Chamber, and conformance evidence;
- strict pack, game-contract, skin-instance, effect-stack, lighting-rig, and
  resolved-presentation validation;
- pack admission combining structural checks, embedded-raster verification,
  and integrity policy;
- mutated signed-pack rejection before resolution, import, save, or export;
- safe canonicalization, own-data-only traversal, accessor/cycle rejection,
  and prototype-pollution path denial;
- exact runtime proposal binding, explicit approval, single-use apply,
  replay/concurrency rejection, preview separation, and rollback;
- remote asset, raw SVG, executable, authoritative-field, and gameplay-field
  denial.

## Package verifier

Command: `npm run verify`

Final result: **111 passed / 0 failed**

The final verifier run must parse every shipped JSON file, exercise all
generated catalogs and contracts, validate/admit portable packs, check
determinism and exact mold scoping, resolve the example contract, verify
33-slot/seven-organ coverage, inspect Treatment Forge invariants, and reject
unsafe or authoritative input.

## Build reproducibility

- `npm run preskins:build` → **PASS — 25 packs**
- `npm run molds:build` → **PASS — 20 kits and 16 contracts**
- `npm run example:compile` → **PASS**
- `npm run example:validate` → **PASS**
- all `.mjs` syntax checks → **PASS — 46 modules**

Two consecutive rebuilds produced identical SHA-256 lists across 66 generated
catalog/example files. The final example pack digest is
`6db8d23a0d0be845b2016737d9f2ab4f0add0ea91b72377b624f6e7a4e03760d`.

## Local HTTP smoke

Required checks:

- `/` redirects to `/studio/`;
- Studio HTML, CSS, JavaScript, and catalogs return expected responses;
- Content Security Policy and other declared security headers are present;
- a malformed encoded path is rejected without terminating the server;
- the server remains loopback-only by default.

Result: **PASS**

## Browser verification boundary

The cloud browser refused access to the loopback preview. No v0.6 screenshot,
responsive-layout result, or live interaction result is claimed. Static Studio
structure, accessibility-state wiring, module syntax, and local HTTP behavior
can still be verified automatically. Predecessor visual evidence is not reused
as proof of the changed v0.6 interface.

Result: **NOT RE-PROVEN — CLOUD BROWSER LOOPBACK ACCESS DENIED**

## Archive verification

- checksum-manifest entries: **151**
- clean extraction checksum verification: **151 / 151 PASS**
- clean extraction `npm test`: **109 / 109 PASS**
- clean extraction `npm run verify`: **111 / 111 PASS**
- ZIP structure and safe top-level layout: **PASS — one versioned root, no
  absolute paths, parent traversal, or links**

The final archive digest is reported alongside the downloadable ZIP.

## Not run in this environment

- Real AXM game, Foundation, Asset Vault, Creative Studio, or Game Hub integration.
- Physical Windows launcher.
- Physical Android/mobile viewport.
- Public hosting, gallery, accounts, or moderation.
- Cross-engine adapter execution or automatic renderer certification.
- Cross-OS deterministic comparison.
- Hardened sandbox decoder fuzzing.
