# Test report

Date: 2026-07-14  
Build: AXM Shared Controls + AI-Native Port Kit v0.1.0-portable

## Executed

### `npm test`

**PASS — 19/19**

Covered:

- floating-stick radial dead zone, precision curve, and normalized maximum;
- independent move/aim vectors;
- top-down release-to-fire and first-person no-release-fire profile difference;
- semantic allowlist and malformed numeric neutralization;
- human and connected-adapter parity through one host gate;
- wrong token, stale sequence, and built-in Host AI rejection;
- rising-edge pulse latching and host consumption;
- idle external-seat neutralization;
- party-camera and co-rider focal behavior;
- screen-bounded opponent visibility;
- forbidden host-key removal;
- connected-AI observation/input loop with token in the observation header;
- zero dependency manifest and local-only browser imports;
- reference host execution;
- loopback demo HTTP loading of HTML, profile, and browser module.

## Additional validation

- JavaScript and module syntax scan: **PASS — 18/18 files**
- All JSON parsing: **PASS — 8/8 files**
- `npm ls --offline --all`: **PASS — empty dependency tree**
- Reference host standalone execution: **PASS**
- Clean candidate ZIP extraction and `npm test`: **PASS — 19/19**
- `unzip -t`: **PASS — no compressed-data errors**
- ZIP path inspection: **PASS — 54 entries, 0 unsafe paths, all required files present**

## Local Foundation extension - 2026-07-18

The original 19/19 source-package result above remains preserved as intake
provenance. The active Workshop adds one contract-only test for the dormant
physical-controller route.

- Active local result: **PASS - 23/23**
- Added runtime gamepad adapter: **NO**
- Added hardware compatibility claim: **NO**
- Proved architectural boundary: a gamepad is an `inputSource` for a `human`
  seat, not a new `controllerType`
- Draft device-binding schema parses: **PASS**
- Exclusive input-source lease rejects a previous valid hand: **PASS**
- Runtime neutralize transmits a zero/released semantic packet immediately: **PASS**
- USB / Bluetooth hardware testing: **UNTESTED**

## Device and integration truth

- Physical phone test: **UNTESTED**
- Multiple real phone test: **UNTESTED**
- Real connected Workshop AI: **UNTESTED**
- Real Game Hub integration: **UNTESTED**
- Fable/Globe/other target integration: **UNTESTED**
- Rendered browser automation: **UNRUN** — no browser runtime is bundled with this small port kit.
