# Four Roots Adventure deterministic gameplay trailer steward receipt

Date: 2026-08-23  
Status: `TEST`  
Branch: `codex/four-roots-adventure-gameplay-trailer-v0.4`  
Base: `e6a15213a74d1bd7eb06a2ca2a759a6866c17753`  
Technical commit: `2185e0053ea5d85ba03e087ad71146ffb4de18b9`

## Outcome

The Fabric can now take the exact reviewed Four Roots Adventure engine and content, run one fixed deterministic journey, record a byte-bound replay, and render actual reconstructed gameplay states into a real 30-second trailer. This replaces the v0.3 trailer's abstract text-and-graphic middle with forty gameplay-map frames covering five zones and the completed ending.

This result is detached Workshop material labelled `TEST`. The replay is deterministic reconstruction from exact engine states, not browser screen capture or live player input. No uploaded or generated runtime was executed. No AI provider, network, install, merge, promotion, publication, or CANON action occurred. Public distribution remains `HOLD`; Mike remains the final merge and publication gate.

The canonical restoration checkout was not edited, cleaned, reset, merged, or otherwise disturbed.

## Technical changes

1. Added strict `axm.four-roots-adventure-gameplay-replay/v1`, `axm.gameplay-trailer-generation-request/v1`, and `axm.gameplay-trailer-plan/v1` records plus a closed `TEST` module contract.
2. Added a fixed native journey entrypoint that uses the reviewed exact-digest game engine and records 228 ordered actions with before/after state digests. One deliberately early Agency interaction remains visibly blocked until Truth.
3. Added forty byte-bound checkpoints across all five zones. Each checkpoint binds scene, action, action digest, state digest, zone, player coordinate, and completion state.
4. Added a deterministic gameplay-trailer planner with nine source/replay-bound claims, six scenes, 48 unique frames, 360 samples, exact duration, resource ceilings, ordered-root gates, public-rights hold, and authority `NONE`.
5. Reworked the renderer so forty of forty-eight unique frames draw exact 15x11 game maps, actors, player movement, root progression, quest/discovery counts, move counts, and engine messages. Visible labels distinguish reconstruction from capture and live input.
6. Added strict adversarial tests for forged actions, checkpoints, replay digests, stale source references, root drift, capture/live-input inflation, authority and publication escalation, resource drift, malformed records, and Windows path aliases.
7. Updated Game 020 to version 0.2.2 and served the replay JSON through the exact local allowlist. Package and HTTP tests bind its exact file bytes.
8. Rebound the older v0.3 planner's example manifest reference to the exact v0.2.2 bytes after its continuity test correctly detected the manifest change; no drift check was weakened.

## Exact identities

- Request: `sha256:f555ffac2031235eb1f2bfcd9bced4b8f749965033baa78c331145872106c0fa`.
- Gameplay plan: `sha256:81061e201ec3333c52c44210dd063a4c6291e47c4e4785f53b83cd7d360de22e`.
- Replay semantic core: `sha256:90185f8781b8460d0fc47f3dfe515735da5f61f79d5cf946d8d5038249524fe4`.
- Replay file: 102,882 bytes, `sha256:0fb7d7ecffdd6dd60977f5971cebf2274242774d485080cb2983596076ff3073`.
- Render receipt: `sha256:6ba4d6eb844a664b69973021b828414996f8f2b770a2120f36c54db5b201ab21`.
- Content: 25,693 canonical UTF-8/LF bytes, `sha256:fa5e159f6d7266bd4f3881983e567ae2cce21ca339ac26e7921912439f02dd8d`.
- v0.2.2 manifest: 5,867 canonical UTF-8/LF bytes, `sha256:810a9b6e1fa617a7bf02f746ba12f2a3792fc6ce3a81de82c1da5ff2d5d3f65e`.
- Native engine: 10,785 canonical UTF-8/LF bytes, `sha256:03e9fa179208868df943591a0b5f17fb58a53df4666b6530f21dfc4c8a9159a9`.
- MP4: 18,738,132 bytes, `sha256:5a87f73731e5a1cfc1bf9be345843ec1d412e17d6a8e6527832daa6df5a24a7e`.
- WebM: 9,255,844 bytes, `sha256:9368ca1417e189812d0a768f9cecde62c0db7b66767a37408d6fc1877dbf17d0`.
- WebVTT: 728 bytes, `sha256:2eea2c0c6bcb224bbcb869af218b191edbabae6c626a521bd4f24ecf6b35bb48`.
- Proof frames: first `sha256:c7096945286816fb6c269b39b4a6205d6e18da9168c2fafaee76ed09f52df675`; middle `sha256:3f4f14e40ec484f9b59c8684e82efdeeb39631c7684229129f62434bf5922b42`; last `sha256:608d5a3720c36d4a6013d84791ed9ab01fa59179db47464c3c55717473b0e253`.

## Verification

All ten required `AGENTS.md` commands passed on the technical tree:

- `node verify.js` — `0 FAIL · 22 warn · spine b618c5762240070c`.
- `node hub/hub-selftest.js` — passed.
- `node hub/route-selftest.js` — passed.
- `node hub/graft-selftest.js` — passed.
- `node hub/skin-selftest.js` — passed.
- `node hub/verify-plus.js` — passed; `VERIFIED_WITH_LIMITS`, same 22 warnings.
- `node tests/html-script-syntax-test.js` — `55 PASS · 0 FAIL`.
- `node tests/tool-forge-package-test.js` — passed; transient package proof cleaned; installed false.
- `node tools/agent-tool-forge/selftest.js` — `17 PASS · 0 FAIL`.
- `node tools/evidence-desk/selftest.js` — `36 PASS · 0 FAIL`.

Focused verification also passed:

- All 17 Fabric selftest suites. New gameplay replay: 11 cases; new gameplay trailer planner: 16; prior trailer planner after explicit lineage repair: 13; route v2: 74; route v1: 18; semantic generator: 104.
- Sandbox Session-1: 27 PASS; disposable candidate sandbox: 11 cases.
- Asset Hands final-video and animated-web selftests passed with real container parsing and independent decode.
- Game Hub: seven bounded core suites passed; package verifier 21 assertions; Game Runtime Port, Game Night, and Universal Control passed across 20 installed manifests.
- Game 020 package: 70 assertions; HTTP boundary: 69; complete journey: 202 moves, 26 attempts, 25 recorded interactions, 6 quests; restart persistence: 20 assertions; gameplay trailer: 40 replay frames, 5 zones, 228 actions, exact 30 seconds, captions, decode, budgets, and rights `HOLD`.
- All new JSON records parsed and all touched JavaScript entrypoints passed syntax checking.
- Capability comparison moved from `BLOCKED` with six missing and two degraded capabilities to `READY` with none missing for this bounded vertical.
- A fresh full Windows worktree at exact technical commit `2185e0053ea5d85ba03e087ad71146ffb4de18b9` passed both new Fabric suites and the complete Game 020 `npm test`, remained clean, and was removed.
- Separate live browser playback and responsive evidence passed; see `LIVE_VISUAL_EVIDENCE.md`.

The original Fabric intake cited 41 warnings. The selected Four Roots v0.3 base already reported 22, and this run still reports those 22. They remain visible and were neither hidden nor repaired by this bounded work.

## Unrun, unsupported, or uncertain

- The trailer does not contain a browser capture or live human-input recording. It reconstructs exact engine states and says so visibly.
- The video is silent. Voice, music, sound effects, audio description, and licensing were not attempted.
- No physical phone, touch device, TV, cast target, VR headset, light controller, gamepad, screen reader, Safari, Firefox, Edge, public CDN, or social platform was tested.
- Browser CPU, memory, GPU, frame pacing, battery, and thermal behavior were not independently measured.
- Human taste, marketing effectiveness, historical productivity comparisons, and public comfort remain human or research judgments.
- No optional AI challenger, model training, hidden learning, uploaded runtime, arbitrary generated command, or general-purpose executor was used.
- The separate shadow-Workshop sandbox requested after this run is a future bounded rung, not silently included here.
- Public direct-reuse rights remain `HOLD`; publication is false.
- Canonical integration and CANON remain unperformed.

## Evidence curation

- Session id: `2026-08-23-four-roots-adventure-gameplay-trailer-v0.4`.
- Sealed segment: `session.jsonl` — 3,052 bytes, 9 valid events, `sha256:95e595e71f1ca231156878c08dc2501108cd84689d8a9d0b795cdcd43ff67887`.
- Nine durable events preserve scope, pre-gap, technical change, artifact, one failure-and-repair, verification, live visual observation, clean reproduction, and handoff boundary.
- Repeated logs and browser polling were reduced to exact totals, state transitions, exceptions, and limitations.
- No raw browser screenshot, recording, private stdout/stderr, user upload, secret, account data, or machine path is retained in this receipt.
- Committed renderer proof frames and media are product-verification artifacts and remain byte-bound.
- Derived views updated: claim/evidence matrix and before/after capability reports. Unclassified items: none. Authority used: Mike's explicit `try it` direction for the fixed native game entrypoint and the repository stewardship request; no broader executor or lifecycle authority was inferred.

## Safe integration route

Do not cherry-pick only the technical commit: this branch depends on the full prior Fabric and Four Roots lineage. Do not use a busy canonical checkout.

After re-checking the Mike-selected target branch, HEAD, and dirty state, create a new clean review worktree at that exact target. From it, stage the full branch integration without committing:

```powershell
git merge --no-ff --no-commit codex/four-roots-adventure-gameplay-trailer-v0.4
```

Review the complete prerequisite lineage and this 35-path technical diff, rerun the tests above plus live playback, and either let Mike commit the reviewed merge or run `git merge --abort`. This receipt grants neither action. Exact target drift is recorded separately after the evidence commit.
