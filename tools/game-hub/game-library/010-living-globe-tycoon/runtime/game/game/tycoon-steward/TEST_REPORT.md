# Test report — Tycoon Steward v0.1 ruleset in the v0.7 palace-polish host

`EXPERIMENTAL LOCAL TEST CANDIDATE`

Date: 2026-07-18  
Node: v24.14.0  
Runtime package dependencies: none

```sh
node game/tycoon-steward/tests/run-tests.js
```

Observed result: `47 PASS · 0 FAIL`

## Deterministic rules

The prior 46 replay, resource-integrity, supply, emergence, road, recovery, novelty, receipt, import/export, captured-pattern, Preserve/Evolve and proposal-only checks remain green.

## Palace-polish boundary

The added check proves:

- the v0.7 browser key is isolated and v0.6 stays a read-only fallback;
- every cell receives a deterministic terrain attribute and code-native glyph;
- palace notices report explicit decisions and real emergent construction;
- notice timers are presentation-only and do not call simulation advancement;
- reduced-motion handling is present.

## Browser boundary

v0.7 browser rendering was not run because the workspace had no browser executable and the permitted download produced no usable payload. The v0.6 host previously passed the full 64-cell/13-product sample, genuine capture and no-placement Preserve/Evolve browser flow. That baseline covers the unchanged engine but not the new visual layout.

## Not proven

These tests do not establish v0.7 pixel layout, human fun, balance, realism, accessibility, cross-browser behavior, production security, living-world ownership, readiness or canon. External trade remains deliberately absent.
