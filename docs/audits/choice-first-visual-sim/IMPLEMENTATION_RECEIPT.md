# AXM Choice-First Visual and Simulation Foundation — implementation receipt

Date: 2026-08-12  
Branch: `local-visual-fabric-20260728`  
Delivery status: `EXPERIMENTAL` candidate  
Technical state: `WORKING` in the tested local scope  
Authority: `installed: false` · `promoted: false` · `canonical: false`

## Outcome

The candidate separates persistent asset/simulation truth from selectable visual representation. The same identity and causal state now drive deterministic 8-bit, 16-bit, and caller-shaped pixel output. Advertised but unimplemented high-detail, illustrated, realtime-3D, and cinematic directions return `MISSING_REPRESENTATION`; they never silently fall back.

The implementation also contains an upgradeable starter sofa with resource-bound mutually exclusive component slots, deterministic causal replay with no time-only decay, four original pilot identities, and a sparse 240-sample AXM film.

## Claim-to-evidence routes

| Claim | Required evidence surface | Result | Evidence |
|---|---|---:|---|
| Explicit visual axes override preset defaults without coercing custom profiles | Contract + deterministic runtime tests | PASS | `shared/asset-hands/choice-first-core.js`; Choice-First selftest |
| An unavailable visual direction does not become a cheaper representation | Typed runtime result + live UI | PASS | `axm.missing-representation/v1`; browser showed `cinematic-render unavailable`, `fallback_used: false`, and `nearest_substitute_used: false` |
| Time alone does not damage an asset | Reducer replay + live state observation | PASS | `pilots/causal-proof.json`; live one-year idle kept condition `100` and cleanliness `100` with both deltas `0` |
| Use can change condition because it is a recorded cause | Reducer receipt + live state observation | PASS | live 12-cycle event changed condition to `99.71`, cleanliness to `99.88`, and cycles to `12` |
| Sofa upgrades preserve object identity and spend real inputs | Before/after state + resource receipts | PASS | `pilots/sofa-branching-proof.json`; live frame + velvet upgrades retained `sofa-browser-instance-001` and reduced resources from EUR 620/30h to EUR 420/24h |
| Different sofa builds can be useful without one universal score | Contextual evaluations + mutually exclusive slots | PASS | both generated branches have different quality vectors and `universal_score: null` |
| 8-bit and 16-bit art are representations of the same asset | Identity-bound manifests + visual observation | PASS | eight generated representation packages share per-identity state digests; live Ferris wheel switched profile without changing its simulation state |
| Park and sofa animation is present | Repeated live visual samples | PASS | two browser screenshots 0.92 seconds apart visibly showed Ferris wheel spoke rotation; no rolling-buffer/realtime-continuity claim is made |
| Film is exactly 20 seconds, 640x360, 12 fps, and 240 samples | Container parse + decoded samples + receipt | PASS | `pilots/film/verification-receipt.json`: 240 samples, 40 unique raw frames, 20 seconds, MP4/WebM parse, first/middle/final decode |
| Film playback works in the browser | Live media state + repeated visual frames | PASS | video reported 640x360, duration 20, `readyState: 4`; playback advanced 1.077 seconds between observations and changed from the truth scene to the 8/16 comparison |
| Browser interaction stays healthy | DOM interaction + console observation | PASS | profile, gap, sofa, causality, integer zoom 5x→6x, and video controls exercised; browser console remained empty |

## Verification

Focused checks:

- Choice-First pilot build: PASS — 4 assets, 8 representations, 240 film samples, 40 unique film frames.
- Choice-First selftest: PASS.
- Asset Hands schema contract: PASS — 110 schemas and all local references resolved.
- Asset Hands registry: PASS — 39 providers and zero curated gaps.
- Pixel Animation Workshop: PASS.
- Final Video: PASS.
- Asset Fabric: PASS — 34/34.
- Asset Fabric upgrade integration: PASS.

Required Workshop checks:

- `node verify.js`: PASS — 0 failures.
- Hub, Route, Graft, Skin, and Verify Plus selftests: PASS.
- HTML script syntax: PASS — 55/55 registered surfaces.
- Tool Forge package, Agent Tool Forge, and Evidence Desk checks: PASS.

Aggregate checks:

- `npm test`: FAIL outside this lane after the already-running Casino intake assertion `Casino alpha is honestly labeled TEST/WORKING and still requires browser/phone QA` (24/25 intake seam checks). The aggregate command therefore short-circuited.
- Downstream `test:asset-hands-completion`: PASS.
- Downstream `test:asset-hands-upgrades`: PASS.
- Downstream `test:workspaces`: PASS.

The Casino failure was recorded and left untouched.

## Capability audit

The before/after scout report moved every technical requirement from missing to `READY`. The overall after-report intentionally remains `BLOCKED` only because `quality.taste.human-review/v1` is unavailable to automation. Mike must still judge originality, readability, motion quality, and whether the sofa progression is actually fun.

## Boundaries and known limits

- The pixel assets and film are original deterministic candidates, not copied commercial game material.
- “8-bit” and “16-bit” are art-direction profiles over RGBA8/sRGB output, not literal hardware colour-depth claims.
- 3D and cinematic are future capability families. Adapters may be added later without rewriting the simulation contract, but they do not exist here yet.
- Engine-specific import, walkable park gameplay, guest/household AI, queues, economies, construction, and complete room simulation remain later consumers.
- The workspace was already heavily dirty and shared. Work stayed in an additive choice-first lane; unrelated modifications were neither cleaned nor claimed. `npm test` legitimately refreshed `tools-index.json` and the public registry from the whole current workspace.
