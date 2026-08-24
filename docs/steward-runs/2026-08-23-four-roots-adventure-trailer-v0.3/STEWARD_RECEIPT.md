# Four Roots Adventure deterministic trailer steward receipt

Date: 2026-08-23  
Status: `TEST`  
Branch: `codex/four-roots-adventure-trailer-v0.3`  
Base: `7b5df7ded4fab2f6e05c0129bfb77b1d4a3ca4e4`  
Technical commit: `2ab22c744aae8adf4ab2307974164707015ae23e`

## Outcome

The Fabric now has a provider-neutral deterministic adapter that turns the exact Four Roots Adventure content and manifest into an evidence-bound trailer plan, real silent video, captions, a local review player, and verification receipts. This is the first proven concept-to-another-body bridge: game data to animated media. It does not yet prove TV, native phone, VR, lighting, physical hardware, or cross-device transport.

The output is detached Workshop material labelled `TEST`. It is not published, installed into the canonical checkout, promoted to CANON, or allowed to approve itself. Public distribution and direct-reuse rights remain `HOLD`; Mike remains the merge and publication gate.

## Technical changes

1. Added strict `axm.game-trailer-generation-request/v1` and `axm.game-trailer-plan/v1` schemas, a closed module contract, and a pure deterministic planner.
2. Bound every trailer claim to the exact game content or manifest bytes. Reordered roots, root `HOLD`/`FAIL`, forged or stale digests, inflated counts, publication or authority escalation, resource drift, and unsafe Windows path aliases fail closed.
3. Added a native recipe renderer using existing Asset Hands codecs. It produces 48 unique RGBA frames expanded to 360 samples without child processes, network access, AI, or arbitrary commands.
4. Repaired the optional media resolver so a clean checkout can use the repository-pinned wasm-vips Node runtime. Nested dependency failures are not misclassified as an absent optional package.
5. Canonicalized content recipe text to UTF-8/LF before digesting while retaining separate source-byte and canonical-byte bounds, removing a Windows checkout ambiguity.
6. Added a locally served trailer player with exact path allowlisting, CSP, explicit media MIME types, captions, Replay, and a route back to the TEST game.
7. Updated the game package to version 0.2.1 without rewriting the immutable v0.2 content release.

## Exact artifact identities

- Request: `sha256:f498a13b9ee118d615ebed39a47f9da7d35562316e070ba6bcf95eb3fa071ed4`.
- Plan: `sha256:30d01e8c660471e332b33caad7a118fa5ece3bd0691a75cb75065360ad199c3e`.
- Render receipt: `sha256:bdb9688702fdd5c9376a3410174d06b3f2b1f46d59d1532d31219a0910ab93df`.
- Content source: 25,693 canonical UTF-8/LF bytes, `sha256:fa5e159f6d7266bd4f3881983e567ae2cce21ca339ac26e7921912439f02dd8d`.
- v0.2.1 manifest: 5,557 canonical UTF-8/LF bytes, `sha256:a123ae877201e08c43bea70078edabf6a80b554eb08b61067ec786ea1ac9cf96`.
- MP4: 10,835,439 bytes, `sha256:ef18047d49f136fb9fdbc0e96f49c8e7ca5eb78df0d6b872dc5457771dde45cc`.
- WebM: 4,605,018 bytes, `sha256:aaaaf0b963de9eb7d4e3509743cb638f5c34f267d22c83be3deb7eb69bc97517`.
- WebVTT: 561 bytes, `sha256:5c01693d7e4681c8a9f4de26a274c5f81c16d9b5a0247810d25ab6d640b23c19`.
- Proof frames: first `sha256:f7631de854ab741a9ee0bc5d1b1453ec3761b40405849473ed05e341373e88a3`; middle `sha256:7b70a1b059da4cb5ad585497835a1e1449d1966454759ee861e834a2d711217c`; last `sha256:4f8499f3b65df5e055aee5c27291902b64f95c1b5cc18b9272660d2408b99b7d`.

## Verification

All ten required `AGENTS.md` commands passed on the technical tree:

- `node verify.js` — `0 FAIL · 22 warn · spine b618c5762240070c`.
- `node hub/hub-selftest.js` — passed.
- `node hub/route-selftest.js` — passed.
- `node hub/graft-selftest.js` — passed.
- `node hub/skin-selftest.js` — passed.
- `node hub/verify-plus.js` — passed; `VERIFIED_WITH_LIMITS`, same 22 warnings.
- `node tests/html-script-syntax-test.js` — `55 PASS · 0 FAIL`.
- `node tests/tool-forge-package-test.js` — passed; transient proof cleaned; installed false.
- `node tools/agent-tool-forge/selftest.js` — `17 PASS · 0 FAIL`.
- `node tools/evidence-desk/selftest.js` — `36 PASS · 0 FAIL`.

Focused verification also passed:

- All 15 Fabric selftest suites, including trailer planner 13, route v2 74, route v1 18, semantic generator 104, adventure generator 13, and game candidate 12 cases.
- Sandbox Session-1: 27 PASS; disposable candidate sandbox: all 11 cases.
- Game package verifier: 21 assertions; Game Runtime Port, Game Night, and Universal Control passed.
- Full library: 0 failures, 17 warnings, 20 games; slot 020 had no warning.
- Asset Hands final-video and animated-web selftests passed.
- Four Roots package: 59 assertions; HTTP: 58 assertions; complete journey: 202 moves, 25 interactions, 6 quests; restart persistence: 20 assertions; deterministic trailer render passed.
- Planner adversarial suite: all 13 cases.
- Capability comparison moved from `BLOCKED` with eight missing capabilities to `READY` with none missing for this bounded vertical.
- A clean sparse Windows checkout of the exact technical commit passed the pinned-runtime byte check, libvips 8.18.3 observation, planner suite, complete game package suite, render, journey, and persistence tests, then remained clean.
- Separate live browser evidence passed; see `LIVE_VISUAL_EVIDENCE.md`.

The old intake cited 41 warnings. The selected v2.5/Four Roots base already reported 22, and this run still reports those 22. They were neither hidden nor repaired by this bounded work.

## Unrun, unsupported, or uncertain

- The trailer is silent. Voice, music, sound effects, audio description, and licensing were not attempted.
- No physical phone, touch device, TV, cast target, VR headset, light controller, gamepad, screen reader, Safari, Firefox, Edge, public CDN, or social platform was tested.
- Cross-device transport needs both sender and receiver receipts; none is claimed here.
- Browser CPU, memory, GPU, frame pacing, battery, and thermal behavior were not independently measured.
- Human taste, marketing effectiveness, and public comfort remain human judgments.
- No optional AI challenger was used. No model training or hidden learning occurred.
- No experimental uploaded runtime or arbitrary generated code was executed.
- Public direct-reuse rights remain `HOLD`; publication is false.
- Canonical integration and CANON remain unperformed.

## Evidence curation

- Session id: `2026-08-23-four-roots-adventure-trailer-v0.3`.
- Sealed segment: `session.jsonl` — 9 physical lines, 9 valid events, 2,769 bytes, `sha256:2a1747e926317b4f05f80f6e83a869e8860aa642a658228782d16ba6f6088fc9`.
- The append-only segment retains nine bounded events: scope, pre-gap, two observed repairs, technical change, artifact, verification, live visual observation, and handoff boundary.
- Repeated logs and browser polling were reduced to exact totals, state transitions, exceptions, and limits.
- No raw browser screenshot, recording, private stdout/stderr, user upload, secret, account data, or machine path is retained in the receipt.
- Committed renderer proof frames are product-verification artifacts and remain byte-bound.
- The generated session seal records the segment byte length, digest, event count, and parse status.

## Safe integration route

Do not cherry-pick only the trailer technical commit: this branch includes and depends on the prior Fabric and Four Roots lineage. Do not use a busy canonical checkout.

After re-checking the Mike-selected target branch, HEAD, and dirty state, create a new clean review worktree at that exact target. From it, stage the full branch integration without committing:

```powershell
git merge --no-ff --no-commit codex/four-roots-adventure-trailer-v0.3
```

Review the complete prerequisite lineage and this 36-path technical diff, rerun the tests above plus live playback, and either let Mike commit the reviewed merge or run `git merge --abort`. This receipt grants neither action. Exact target drift is recorded separately after the evidence commit.
