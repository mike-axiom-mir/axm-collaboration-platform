# Shared runtime deterministic JSON closure

Status: `TEST` · review branch only · not merged · not `CANON`

This lane closes the six remaining safe exported shared-runtime canonical JSON
surfaces left after the upstream-root v0.5 milestone:

- Cognitive Resource;
- Holodeck;
- Mirror Core utilities and atomic JSON persistence;
- Sensorium core;
- Verification Snapshot Continuity; and
- Verification Source Evolution Review.

All six now reuse `tools/deterministic-json-core`. The thirteen-module runtime
inventory moved from 6 strict / 6 invalid / 1 silently transforming surface to
12 strict / 1 invalid / 0 silently transforming surfaces. Across the fixed
runtime corpus, 158 of 169 unsafe fixture/module pairs are refused and all 78
safe fixture/module pairs remain strict-core exact. The one non-strict module is
the already-deferred Voluntary Phone QA Campaign; its CONTRACT/EVIDENCE gap is
preserved rather than papered over.

## Compatibility and persistence

`tests/shared-runtime-deterministic-json-test.js` proves 133 bounded assertions:
safe byte equality, unsafe-state refusal, six isolated persistence roundtrips,
Mirror atomic-write refusal without partial files, and Holodeck's browser UMD
load path. Native module suites also pass. Mirror retains intentional no-value
mutator control flow in `JsonStore` while clone and persistence boundaries stay
strict.

Sensorium's apparent 33-artifact drift was entirely a Windows CRLF checkout
policy mismatch. `.gitattributes` now keeps its generated source and portable
skill pack LF-stable, so the unchanged exact-byte parity guard passes all 33.

## Browser evidence

Holodeck Composer and Screen Deck were rendered in the in-app browser at
1280x720 and each received one bounded interaction. Composer applied the Sun
forge preset and advanced a human movement to revision 1; Screen Deck applied a
machine turn to revision 1. Both canvases remained visible and browser logs had
no warnings or errors. Raw screenshots were not retained; the typed receipt is
`HOLODECK_VISUAL_RECEIPT.json`.

## Honest limits

Sensorium's full nine-phase suite passed only when supplied its existing ignored
local visual-acceptance receipt. The temporary copy was removed and is not part
of this commit, so a clean checkout cannot reproduce that full suite without
separate visual evidence. Its focused core, parity, and Foundation-contract
checks are self-contained and pass.

The production JavaScript scan still reports 285 potential representation
review seams. It does not execute every non-exported helper, inspect every
browser-inline or non-JavaScript runtime, prove semantic intent, establish human
benefit or model learning, or evaluate the future shadow-clone candidate. No
install, permission, promotion, merge, Foundation mutation, or `CANON` authority
is granted.

## Reproduce

```powershell
node docs/steward-runs/2026-08-20-shared-runtime-json-closure/build-current-shared-runtime-closure.js
node docs/steward-runs/2026-08-20-shared-runtime-json-closure/run-verification-checks.js --write
node docs/steward-runs/2026-08-20-shared-runtime-json-closure/selftest.js
```

The recorded matrix is 25/25 passing: 15 focused checks and the exact 10/10
Workshop-required checks.
