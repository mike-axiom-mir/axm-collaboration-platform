# AXM three-module functional integration receipt

Date: 2026-08-09  
Workspace: `<AXM_WORKSHOP>`  
Outcome: **PASS — INTEGRATED_WITH_NATIVE_CONTRACT_HOLD**

## What is now operational

- Module 1 (`human-capability-atlas` 0.11.0) builds and receipt-verifies a source-bound Capability Card plus Quick, Practical, and Deep human views.
- The separate platform bridge `axm.platform.capability-interface-adapter/1.0.0` maps the validated Module 1 v0.11 record into Module 2 v0.6 without claiming native contract identity.
- Module 2 (`human-interface-intelligence` 0.6.0) consumes that exact handoff, selects `searchable_library`, issues a decision receipt, and returns `PASS` recommendation assurance.
- The real Human Capability Atlas page now implements the four required controls: `search`, `filters`, `preview`, and `metadata`.
- Module 3 (`grounded-evolution-intelligence` 0.7.0) receives the exact Module 2 recommendation digest, retains the historical gap and tested result as two append-only signals, and retains `axm:need:apply-searchable-capability-library` as a non-authoritative candidate.
- All Module 3 authority flags remain false: no evidence promotion, automatic need creation, direction execution, silent overwrite, merge, or CANON.

## Evidence matrix

| Claim | Best evidence | Result |
|---|---|---|
| Module 1 makes the capability human-understandable | Real Module 1 build, producer-receipt revalidation, content checks over Quick/Practical/Deep views | PASS |
| Module 1 bytes reached Module 2 | Sender/receiver record SHA-256 equality in the pipeline receipt | PASS |
| Module 2 selected an interface from that record | Deterministic recommendation, decision receipt, registry fingerprint, assurance report | PASS — `searchable_library` |
| The real interface was improved | Before/after structural control audit plus live browser interaction | PASS |
| Module 2 bytes reached Module 3 | Recommendation SHA-256 equals every Module 3 signal input source digest | PASS |
| Module 3 retained evidence and proposed evolution safely | Valid signal ledger/hash chain, two signals, retained candidate, all authority flags false | PASS |
| Supplier engine sources survived execution | Before/after engine tree fingerprints plus disposable-copy full regressions | PASS |
| Workshop discovery still agrees | `npm.cmd run discovery:verify` | PASS — 214 modules / 1826 declared capabilities |

## Verification results

- Module 1: **133 passed**, 2 expected Windows-only skips, 0 failed.
- Module 2: **108 passed**, 0 failed.
- Module 3: **41 passed**, 0 failed.
- Platform seam: 17 checks PASS.
- Replayable pipeline: 15 checks PASS; same-path receipt reproduced exactly.
- Wrapper self-tests and discovery-seam reviews: all PASS.
- Targeted static accessibility audit: 0 definite findings across the three pages.
- Live browser: search empty state, deep-view switching, 390×844 responsive layout, Module 2 recommendation display, and Module 3 signal/authority display all PASS.
- Browser console: 0 warnings/errors on the verified routes.
- HTTP: the three module pages, platform status, and workflow summary all returned 200.
- Python cache scan after cleanup: 0 entries in the three engines and shared seam.

## Durable receipts

- Pipeline receipt: `shared/capability-intelligence/generated/verified-workflow/pipeline-receipt.json`
  - internal receipt: `sha256:ac358e3534db48c91a9e4ee3a20bb77f1ef1d4e0e86f16400e74fd89ac3b1fc2`
  - file bytes: `sha256:1eb8a3319573c21f11d15112a306bb9005e174d979b9cf5d64008616f81ad8b5`
- Full regression receipt: `docs/steward-runs/2026-08-09-three-module-functional-integration/full-verification-receipt.json`
  - internal receipt: `sha256:1fe1cd91bb8984919e893bb12e80549aced3e099f299044865721795a2922eb7`
  - file bytes: `sha256:c8cb64d25ccde050b39b405cefe02292d36ad8dd371bfe20391704ce0a417189`
- Live visual receipt: `docs/steward-runs/2026-08-09-three-module-functional-integration/live-visual-receipt.json`
  - file bytes: `sha256:a1c1666735b98e2335d864ee4fcb37685656f1eca9ab6df50b72a6960c0a6971`
- Platform status: `shared/capability-intelligence/status.json`
  - internal status: `sha256:79d78fccf3c733e6dfe25db1448c063900516c06bdde290050aff01f6b547bda`
  - file bytes: `sha256:af1b3034fd07c17ebbbb05dd0fbc68912b6443d7aee03db668855e5a8b404f11`

## Preserved source packages

- Module 1 ZIP: `sha256:a6a361ae5abeaf0a1787b08501374260093a615ac6bdc7aa87d052b364f692a6`
- Module 2 ZIP: `sha256:54f2d2399e61ba70511c77f0db57250b3cafa3fe25520a334bb9b6fe207bb1cc`
- Module 3 ZIP: `sha256:2e3bb039915877697af9ffa6e65f0b9605a67e03384008998eeffdc5e4e8e4e1`

## Explicit remaining boundary

The native Module 1/Module 2 paired gate remains **BLOCKED** because both suppliers claim contract `0.1.0` while shipping different schema bytes. The platform workflow is operational through its own explicit versioned adapter, but it does not rename that conflict as compatibility. CANON/public promotion still requires a separate human Merge Gate.

Capability schema hashes:

- Module 1: `sha256:c63d2c5d4b0ae7aeb8754a5a006a1efd2364c330ad18b74064d74ec7428a71b3`
- Module 2: `sha256:cf5b3d94f6dafcd9b1f2d93e7af9219db5c85f57931ecae7481f27924929a644`

Recommendation schema hashes:

- Module 1: `sha256:b85e9916f599d2c469b00ea91b12bc3de1e7cd3cceedcd226340fad6dd636e4f`
- Module 2: `sha256:90ca0bb938fba5595ef29e8fab8ca18a7c91e1b46b14000456525230a40f4062`

This HOLD is intentionally visible in every module page and in the machine receipts.
