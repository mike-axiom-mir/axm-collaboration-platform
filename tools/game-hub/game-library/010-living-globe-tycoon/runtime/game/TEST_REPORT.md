# Test report — Living Globe Steward vNext v0.10

Date: 2026-07-19  
Environment: Node v24.14.0, local loopback HTTP; no usable Chromium binary  
Status: `EXPERIMENTAL LOCAL TEST`

## Living Globe suite

```sh
node tests/run-tests.js
```

Observed result: `99 PASS · 0 FAIL`

All 91 v0.9 checks remain green. Eight new checks prove:

- byte-equivalent deterministic reports and no mutation while reading;
- five separate domains with no overall score;
- one record per strategic revision, same-revision replacement and a 24-record cap;
- exact public income/expense/net/closing-fund flow with private sales outside it;
- water, food-web and introduced-pressure readings drive their disclosed ecological warnings;
- exact civic reserve ratios and typed product shortfalls reach the supply card;
- the weakest faction request and both co-op mission contribution buckets remain intact;
- the AI observation receives the same bounded read-only report as the human surface.

Static coverage also requires the Brief stylesheet/scripts, AI metric strip, V10/v11 save field/migration, selected snapshot v10, read-only metric API, panel coordination, responsive/reduced-motion CSS and no wall clock, unseeded randomness, fetch or remote runtime dependency in the new modules.

## Included Tycoon Steward suite

```sh
node game/tycoon-steward/tests/run-tests.js
```

Observed result: `47 PASS · 0 FAIL`

The deterministic authority, resource, product, emergence, Preserve/Evolve, migration, replay and palace-polish checks remain green. No Tycoon rule was changed for v0.10.

## Syntax, static and package gates

Passed:

- parse of the inline globe module and `node --check` for external JavaScript;
- all static main/Tycoon DOM references resolve;
- root/Tycoon manifests and module contracts parse;
- original hardcopy SHA-256 remains `bf14582156717f660efd09289aa26d65a6f5641ba116a99627330d29548582fc`;
- local Three.js remains packaged; no runtime remote URL or unseeded core randomness exists;
- V10/v11 globe saves and the palace-polish Tycoon key do not overwrite v0.9 or earlier saves;
- ZIP integrity and local loopback HTTP checks.

## Browser/render boundary

v0.10 browser result: `NOT RUN`.

The workspace has no usable disposable Chromium executable. No browser download workaround was used for this version.

Immutable earlier baselines previously passed disposable Chromium checks for WebGL, laptop AI PIP/focus, AI intents, Two-Shores completion, phone human-only controls, the typed economy, genuine emergence capture and Preserve/Evolve. Those results support unchanged engines, but they do not establish the new Brief layout, metric-strip legibility or panel/input feel.

## Not proven

- v0.10 infographic pixel layout, cross-browser rendering or WebGL color on a real GPU;
- glance comprehension, status-band tuning, humor, long-session usefulness or play balance;
- accessibility conformance, focus trapping, sound mix or low-end-phone performance;
- AI decision quality, shared persistence, external trade balance, production security, scientific realism, readiness or canon status.
