# Platform Human-Usability Integration Receipt

Recorded: 2026-08-09T05:57:58.5897830+02:00  
Workspace: `<AXM_WORKSHOP>`  
Overall comparator route: **DEGRADED**

The integrated route is working. A deterministic Human Guide now covers every registered Workshop module through the shared Hub search and the `Guide` control surrounding an open module. This is platform-wide access to source-bound guidance, not a claim that 214 independently owned module UIs were rewritten.

## Verified coverage

- Registered modules guided: **214 / 214**
- Declared capabilities bound into Module 1 cards: **1,826**
- Module 1 to Module 2 exact bridge digest matches: **214 / 214**
- Module 2 recommendations: **214**
  - recommended: 76
  - conditional: 126
  - insufficient information: 12
- Module 2 assurance: 87 PASS, 115 REVIEW, 12 NOT_APPLICABLE
- Module 3 signals retained: **214**
  - GUIDANCE_READY: 87
  - REVIEW_REQUIRED: 127
- Module 3 execution/CANON authority: **closed**

Catalog SHA-256: `sha256:885f558c009cf27fbb63d7c9e20fee08cef052bf3706e6f3fb1ee34532d03803`  
Coverage receipt SHA-256: `sha256:d6a52bd0467cdcf6ffc110477b4b2a39a30eed73f824746d01d60ab79b86a73d`  
Module 3 platform report SHA-256: `sha256:dce7c3915c9a0edf5473fdd72daf6ecfa893ab7546f8c2c54da7e4a48556294c`

## Supplier and chain verification

- Module 1: **133 passed, 2 expected skips**
- Module 2: **108 passed**
- Module 3: **41 passed** on native Windows `cp1252`
- Module 3 package: **334 indexed files verified** after the local repair was resealed
- Versioned pipeline: **15 checks passed**
- Platform catalog verification: all 12 checks passed
- Platform deterministic rebuild: all 13 checks passed, including two independent rebuilds and unchanged supplier trees during each build
- Platform UI contract: all 15 checks passed
- Hub self-test: **0 FAIL**
- Repository verification: **0 FAIL**, with 43 pre-existing/steward warnings including a stale generated tools index
- Required Hub route, graft, skin, syntax, package, and evidence-desk tests passed

## Repair made

Module 3 read `phase3_diagnosis.json` through the Windows locale default and failed on a valid UTF-8 character. `need_generator/generate_needs.py` now uses explicit UTF-8. Original intake file SHA-256 `9ca0661030262239955edb193059c98ec977f49f8a6a3968d5a201addb6efffa`; locally repaired file SHA-256 `0cb861cccb374a538d7cb1230dce943bdb6436f0a0ecfdf87749051ea4238268`.

## Human-use behavior checked live

- Desktop guide dialog: readable, scrollable, source SHA visible, no console errors
- Guide control remains available around an open registered module
- Phone viewport 390 x 844: one-column dialog, no document horizontal overflow
- Conservative Body Pulse case: no interface invented; it visibly remains `NOT_APPLICABLE` / `REVIEW_REQUIRED`
- Raw browser screenshot buffers were not retained; their byte digests are in `live-visual-receipt.json`

## Truth boundaries and remaining work

- This work does not grant automatic execution, promotion, merge, or CANON authority.
- The native Module 1 and Module 2 contracts both use a `0.1.0` label but have different schema identities. The explicit local bridge is tested; native contract identity remains **BLOCKED** pending steward action.
- Twelve unknown-risk modules are deliberately held instead of receiving fabricated interface advice.
- 127 modules retain review needs. The shared guide improves usability immediately, while module-owned UI changes should be made only when their evidence supports a safe pattern.
- The generated tools index remains stale relative to two integrated manifests; it was not regenerated in the moving shared worktree.
- Live visual proof sampled representative, responsive, and conservative cases. It is not 214 separate visual walkthroughs.

