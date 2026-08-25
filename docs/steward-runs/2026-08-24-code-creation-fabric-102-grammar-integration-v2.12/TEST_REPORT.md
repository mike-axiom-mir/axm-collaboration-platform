# Verification Report

Status: `TEST`

## Focused generation and composition checks

- Five generated-view drift checks: PASS; grammar profiles, specialist eyes,
  5,100 cheatcodes, machine templates, and machine keyboards reported no
  authored/generated drift before the planner change.
- All 20 language-organ selftest entry points: PASS.
- All 50 recursive Code Capability Fabric selftest entry points: PASS.
- Creation-session planner: 57 PASS.
- Capability Fabric package suite: PASS.
  - shared Fabric: 112 checks;
  - shared composition: 27 checks;
  - admission gate: 27 checks;
  - tool wrapper: 15 checks;
  - seven-recipe package test: 102 checks;
  - composition package test: 28 checks;
  - SVG proof digest:
    `sha256:c14aad755d5cf6950f6e185b8684e7609285b1a8e538e477c76e25c5d6bab6db`.
- City map gate and direct City selftest: 33 assertions each, PASS.

## Required AGENTS.md checks

All ten required commands exited 0:

1. `node verify.js`
2. `node hub/hub-selftest.js`
3. `node hub/route-selftest.js`
4. `node hub/graft-selftest.js`
5. `node hub/skin-selftest.js`
6. `node hub/verify-plus.js`
7. `node tests/html-script-syntax-test.js`
8. `node tests/tool-forge-package-test.js`
9. `node tools/agent-tool-forge/selftest.js`
10. `node tools/evidence-desk/selftest.js`

Final verifier result after refreshing `tools-index.json`:

```text
0 FAIL · 25 warn · spine b618c5762240070c
```

The 25 known-open warnings remain visible: 20 game QA gaps, one legacy
`UNDECLARED` manifest-kind migration, and four promotion claims needing current
selftest evidence. This branch adds no verifier warning.

Generated view digests:

- City graph:
  `0741ef3a0ebe98eadb0863dbdd94a947b95d633ea11a4e469d1b4962ff59f013`
- Schema registry:
  `a5cd0507fe99ac00ab6f859917d76f901abecc272c91e2682f1b8bf126e6d69d`
- Twin surfaces:
  `35a85e27a99163aff3e5063554a251afbad85695ff05773fd39e87f181006adb`

## Unrun or not claimed

- Browser render/click: N/A; no visual surface changed. No browser claim is
  made from syntax or HTTP evidence.
- General disposable-sandbox isolation: not run and not claimed.
- External AI/provider behavior and network behavior: not run.
- Installation, merge, publication, promotion, CANON, and physical actuation:
  not run.

GitHub checks for the final evidence commit are recorded at closeout in PR 62;
pending checks remain pending evidence rather than inferred PASS.
