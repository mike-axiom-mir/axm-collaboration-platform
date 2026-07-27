# Action Report: Contract & Foundation Polish — 2026-07-20

Author: Claude (Cowork session). Scope: close the CONTRACT_INVALID seams and repair the three BROKEN foundation modules. Truth before story; one check below is honestly UNVERIFIED.

## Ground truth before

Technical Glasses fingerprint `64fe833094caf20c`: modules=133 **broken=3** contracts=**58/98** priorities=214.

- 41 × [HIGH] CONTRACT_INVALID — `permission not declared in manifest uses: export` (plus `gpu-timing` on performance-frame-profiler). Root cause: `hub/module-contract-verifier.js:38` checks contract permissions against manifest `uses`, not manifest `permissions`. 21 healthy modules already carried `export` in `uses`; the 41 failing ones only had it in `permissions`.
- 3 × [CRITICAL] MODULE_BROKEN + ENTRY_MISSING — `p1-production-foundation`, `p2-experience-foundation`, `p34-release-foundation` had **no manifest.json and no index.html at all**, though their kernels, verifiers and selftests all pass. They are the shared engines behind 40 member tools (which load their `lab.css` / `*lab-app.js`).

## Changes made

1. **41 manifests**: appended the missing permission(s) to the existing `uses` array. Text-level insertion preserving file formatting; each file re-parsed after edit and machine-checked that *only* `uses` changed. No behavior changes.
2. **3 foundations**: created canonical `manifest.json` + `module.contract.json` (schema `axm.module-contract/v1`, permissions `[]`, read-only boundaries) and an `index.html` overview per foundation. The overview fetches the sealed cell receipt (`p1-production-cell.json` / `p2-experience-cell.json` / `p34-release-cell.json`), renders cell measurements and the exact receipt SHA, and links to every member module. It mutates nothing.

## Evidence after

Technical Glasses fingerprint `dd4190de4908dc09` (2026-07-20T01:09Z): modules=133 **broken=0** contracts=**101/101** priorities=165. No CRITICAL or HIGH seams remain; the top seams are now MEDIUM READINESS_UNKNOWN (pre-existing, out of scope).

- `hub/module-contract-verifier.js` direct run: 101 contracts checked, 101 pass, 0 fail.
- `tools/p1-production-foundation`: selftest 90 checks PASS; cell selftest 34 checks PASS, receipt `404BC2FC…`.
- `tools/p2-experience-foundation`: selftest 72 checks PASS; cell selftest 28 checks PASS, receipt `E24D3E05…`.
- `tools/p34-release-foundation`: selftest 78 checks PASS; cell selftest 30 checks PASS, receipt `771F87E0…` (matches sealed cell JSON).
- `shared/technical-glasses/selftest.js`: PASS (17 assertions).
- `worlds/foundation-planet` and `worlds/living-globe` selftests: PASS (run earlier this session, before changes).

## UNVERIFIED — cheapest next check

**Full `node verify.js` was NOT run to completion.** The sandboxed shell caps commands at ~45 s and the mounted-folder I/O makes the whole-tree audit exceed that; background processes do not survive between calls. The spine files (`axm-foundation.js`) were not touched, so no spine change is expected, but this is an inference, not a receipt. Cheapest check: run `node verify.js` from the workshop folder on the host machine and confirm exit 0; it rewrites `exports/verify-report.txt`.

The three new foundation overview pages were also not opened in a browser this session; their selftests do not cover the DOM. Cheapest check: open `/tools/p1-production-foundation/` (and p2, p34) from the running Hub and confirm CELL PASS renders with member links.
