# Test report — Living Globe Steward vNext v0.10.1

Date: 2026-08-16  
Environment: Node v24.17.0, local loopback HTTP and Codex in-app browser  
Status: `TEST · STEWARDSHIP TOUR EXPANSION`

## Living Globe suite

```sh
node tests/run-tests.js
```

Observed result: `102 PASS · 0 FAIL`

All 99 v0.10 checks remain green. Three new checks plus the strengthened timing check prove:

- the first two completed starter errands unlock six expanded variants for a twelve-mission catalog;
- four genuine completions finish one repeatable stewardship tour and grant exactly one bounded `✦ 3` bonus;
- v0.1 mission saves retain Laurels and bounded history while gaining valid tour progression;
- missions remain open six active minutes, early completions retain a four-minute start cadence, and an expired errand rolls visibly into the next feasible start.

The retained shared-brief checks continue to prove:

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

v0.10.1 browser result: `PASS WITH LIMITS`.

The Codex in-app browser loaded the managed local route at a 1280×720 viewport. Repeated visible frames and semantic snapshots proved:

- the welcome surface transitions into the animated low-poly Three.js island;
- the first mission appears as `TOUR 1/4` with the correct six-minute clock, objective, Laurel balance and AI-seat readout;
- the Shared Island Brief opens over the live mission and closes back to the same 3D view;
- reload restores the same active mission, objective and remaining active-play time after re-entry;
- the page produced no browser console errors during the route.

No raw recording or repository screenshot archive was created for this pass.

## Not proven

- a complete four-errand human tour, expanded-catalog balance, cross-browser rendering or physical-device GPU behavior;
- glance comprehension, status-band tuning, humor, long-session usefulness or Laurel pacing;
- accessibility conformance, focus trapping, sound mix or low-end-phone performance;
- AI decision quality, shared persistence, external trade balance, production security, scientific realism, readiness or canon status.
