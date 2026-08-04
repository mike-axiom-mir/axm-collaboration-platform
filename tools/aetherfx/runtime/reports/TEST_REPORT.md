# Test Report

**Artifact:** AXM AetherFX Visual Effect Fabric v1.3.0  
**Test date:** 2026-07-28  
**Overall result:** **PASS — verified local intake candidate**

## Exact-source verification

Command: `npm run verify`

Result:

- automated tests: **35 passed, 0 failed, 0 skipped**
- canonical catalog: **64 modules, 0 structural errors**
- expected licence-review warnings: **64**
- starter packages: **12**
- optical expansion packages: **2**
- static SVG examples: **6**
- current single-file Studio: **410,324 bytes**

Coverage includes recursive composition, quality fallback, derived precedence, promoted bindings, SHA-256 sealing, tamper rejection, required integrity, cycle/depth/size bounds, unsafe renderer/CSS rejection, atomic import rollback, complete snapshots, canonical intent/support accounting, portable runtime artifacts, photosensitive selectors, 320-layer stress, and contained-server path handling.

Full output: `reports/NPM_VERIFY_v1_3_0.log`.

## Portable runtime and CLI

`node integration/runtime/example.mjs` passed:

- 11 source layers compiled to 11 resolved operations
- web target reported 11 implemented operations
- generic-game target reported 11 contract operations
- full runtime snapshot schema returned successfully

CLI validation passed for the command-dashboard recipe. CLI inspection resolved the one-layer cinematic mold into six static-SVG approximation operations with no warnings.

## Desktop and phone browser proof

Command: `npm run browser:smoke`

Result: **13/13 assertions passed** in Playwright 1.61.1 with local Chromium 149.

- desktop shell and all three work areas rendered
- module-add interaction changed the active stack
- stack selection was keyboard-focusable
- real generic-game support report downloaded: **3,121 bytes**
- computed sweep animation changed from `axm-sweep` to `none`
- computed shimmer animation changed from `axm-shimmer` to `none`
- desktop page errors: **0**
- desktop console errors: **0**
- desktop HTTP(S) requests: **0**
- phone viewport: **412 × 915**
- phone horizontal overflow: **0 px**
- phone page errors: **0**
- phone console errors: **0**
- phone HTTP(S) requests: **0**

Evidence: `reports/browser_smoke_v1_3_0.json`, `reports/BROWSER_SMOKE.json`, `reports/MOBILE_SMOKE.json`, and the v1.3 desktop/phone screenshots.

## Visual regression

The v1.3 frozen baseline was visually inspected, then a second fixed 1600 × 1000 capture was compared in the same Chromium environment.

- mean absolute difference: **0**
- changed-pixel ratio above 18: **0**
- baseline updated during the comparison run: **no**
- result: **PASS**

Evidence: `reports/VISUAL_REGRESSION.json`, `reports/baselines/studio_desktop_v1_3_0.png`, and the v1.3 current/diff images.

This is a same-environment drift guard, not cross-browser, cross-platform, or native-engine pixel parity.

## Residual limits

The proof does not establish native Unity, Unreal, Godot, Blender, After Effects, WebGL, PBR, or mobile-engine rendering. Godot and Unity remain theme/token bridges; SVG is an explicit approximation; photosensitive-safe mode is protective behavior, not medical certification. Public licences remain unresolved by design.
