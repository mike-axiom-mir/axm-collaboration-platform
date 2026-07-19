# Mirror Foundation generic evidence-envelope adapter action report

Status: **TEST**  
Date: 2026-07-19  
Steward acceptance: not requested; not CANON

## Outcome

Mirror now has one reusable, capability-agnostic candidate organ that can place a bounded declared native JSON output inside a content-digested Foundation evidence-candidate envelope. The organ does not interpret or re-verify the opaque native artifact. It preserves exact request, hand, declaration, artifact, permission, authorship, independence, observed-outcome, and native-acceptance lineage while fixing the resulting Foundation assessment at:

- `REQUESTED_NOT_PROVEN`
- `NOT_ADMITTED`
- `UNASSESSED`
- `UNTESTED`
- `realEvidenceProduced: false`

All output authority remains closed. The organ has no private-state writer and is not imported by the active runtime.

A separate examiner binds the adapter source by SHA-256, authors its own bounded synthetic fixtures, executes only the pure adapter, and judges outputs with separately implemented predicates. The candidate does not author its fixtures or expected results.

## Why this organ was needed

Capability survey v2 correctly found two partial witnesses whose hand family, input kind, and required tokens match but whose native outputs do not equal `CONTENT_DIGESTED_FOUNDATION_EVIDENCE_CANDIDATE`. The two declared native output kinds are:

- `axm.mirror.reasoning-experience-receipt/v4`
- `axm.mirror.typed-trace-language-independent-exam/v1`

Adding a capability-specific converter for each output would hardcode the growth route. The generic envelope instead handles any declared bounded JSON output through the same machine contract. An unseen synthetic output kind passed through the same implementation without a new routing branch.

## Independent falsification

The operational exam covered both current adapter requests with 17 independently authored cases per request, 34 cases total and 36 pure adapter calls. All 34 cases produced the independently expected result.

The cases exercised:

- valid opaque content sealing;
- object-key-order and fluent-prose invariance;
- an unseen native output kind;
- wrong native output kind;
- post-seal artifact mutation;
- unknown required permission;
- explicitly forbidden source material;
- invented permission status;
- blank permission basis;
- capability, declaration, and hand binding mismatch;
- nested hidden reasoning;
- authority injection;
- extra acceptance claims;
- a native `PASS_VERIFIED_REAL_CANON` label remaining unadmitted;
- content-aware output tampering with recomputed identity and digest.

Both source bindings were identical before and after examination.

## Operational trace

- Snapshot: `foundation-development-fd201ed63938d23901961ebb`
- Snapshot digest: `e726bc01a071ec8eea7ce8a79e47df3f906688a33f1d950e5d05e3790cc2c1ed`
- Adapter-request batch: `foundation-capability-output-adapters-9dcddfae31abf2e6992a7999`
- Adapter-request batch digest: `babe5f4b0e5cf5e3b408fe803597c5c40621173a72621fae2f3ab1e2b7d24d12`
- Fixture-exam batch: `foundation-capability-output-adapter-fixture-exams-345a90848657f1d6467795d7`
- Fixture-exam digest: `818c39b03578134230a9c801c3103df2372c042b40e0f82b71d40f1627149e7e`
- Fixture-exam file SHA-256: `a69b5bd4299f20129058926af04a009acae62d7b0a48d76b7a3d2de81460d223`

The new Foundation snapshot compared twelve prior verified subjects. Eight dimensions remained observed passing, two evidence gates remained open, and zero direct or longitudinal regressions appeared. No composite intelligence or growth grade was produced.

## Verification

- Focused adapter and independent-exam tests: 10/10 pass.
- Focused integrated Foundation and model-BOM tests: 26/26 pass.
- Full repository regression on Node v24.17.0: 201/201 pass via `npm.cmd test`.
- Mirror Doctor: `Structure: PASS`.
- Active runtime import of adapter or examiner: false.

Direct `npm test` through the PowerShell `npm.ps1` wrapper was not used; `npm.cmd test` ran the repository's exact `node --test tests/*.test.js` script.

## Claim ceiling and known limits

This result proves synthetic instrument discrimination only. It does not prove the adapter is operationally fit for either declared capability. Specifically:

- real native artifacts adapted: 0;
- native capability sources executed: 0;
- real Foundation evidence produced or admitted: 0;
- evidence relabelings: 0;
- adapter or capability selections: 0;
- operational-fit claims: 0;
- new-organ decisions: 0;
- training admissions, permission grants, runtime promotions, canon changes, or world actions: 0.

The typed-trace independent-exam artifact cannot be independently re-verified from the artifact alone; it also needs its bound pack and evaluation inputs. The generic adapter therefore truthfully records `NOT_RECHECKED_BY_GENERIC_ENVELOPE_ADAPTER`. A future real affordance exam must supply permissioned native artifacts plus capability-specific independent verification context. Until then, operational fit remains `UNTESTED` and new-organ need remains `UNASSESSED`.

## Changed implementation surface

Primary additions:

- `organs/foundation-evidence-envelope-adapter-organ.js`
- `organs/foundation-capability-output-adapter-fixture-exam-organ.js`
- `contracts/foundation-capability-native-output-envelope-input.schema.json`
- `contracts/foundation-evidence-candidate.schema.json`
- `contracts/foundation-capability-output-adapter-fixture-exam-batch.schema.json`
- `scripts/run-foundation-capability-output-adapter-fixture-exams.js`
- two focused test files

Integration updates connect the examiner only to the private Foundation observation and Workshop stewardship routes, add doctor/package/documentation surfaces, include both organs in the measured Foundation source set, and record the 27th immutable batch writer. The active Seed-0 runtime remains unchanged.

## Source seals

- Generic adapter organ: `3af7ec87ac5f870430a740f02c25fd3e73b6fd7d8523cc469a4cde936f02b340`
- Independent examiner organ: `5529cf3d5f6a5c58985e84676034b1b9d7f7d500899eae412357d29d7244f3e0`
- Native-input contract: `e7b5e90c16309a309c23ad538c07e92113931a713fee9d606757fd38cc8cdcae`
- Evidence-candidate contract: `420ad9b102105f6bb52329b04005d595976273592d1c5b9ab7bc24308882e4ff`
- Fixture-exam batch contract: `933fb437ac6dfb70227d94a381dda2c87b43afa75b992bd1f9108634a9fb0b75`
- Training policy: `dd480482b0f47a58da42b297ef26eb2df03496371e9559c56c46c8c503c1aafe`

Failed historical evidence and the earlier output-kind correction remain preserved; nothing was silently erased or promoted to CANON.
