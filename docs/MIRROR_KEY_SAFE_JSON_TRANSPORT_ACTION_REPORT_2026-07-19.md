# Mirror key-safe JSON transport action report — 2026-07-19

Status: TEST

## Outcome

The generic Foundation evidence-envelope adapter no longer treats a property name as executable behavior. A new deterministic key-safe JSON transport cell preserves all inert own JSON data properties, including legitimate fields named `prototype`, `constructor`, and `__proto__`, without changing the destination object's prototype.

The cell refuses the behaviors and shapes that actually cross the boundary: changed object or array prototypes, proxies, accessors, symbol keys, non-enumerable properties, sparse or extended arrays, cycles, non-JSON values, non-finite numbers, and configured depth, node, or byte limits. Hidden-reasoning names remain a separate semantic refusal in the evidence adapter. No capability-specific field exception was added.

## Why the prior rule was wrong

The prior adapter rejected the strings `__proto__`, `prototype`, and `constructor` before distinguishing inert own data from active structure. This conservatively blocked prototype-pollution shortcuts, but it also rejected 45 legitimate v4 reasoning receipts whose public machine trace contains a normal `prototype` field.

The repaired boundary asks structural questions instead:

- Is the source exact inert plain JSON data?
- Does it have the expected built-in prototype?
- Are every property and array element own, enumerable data rather than an accessor?
- Can it be copied with `Object.defineProperty` without invoking the inherited `__proto__` setter?
- Does the detached canonical copy retain `Object.prototype` and the same content digest?

That makes the policy generic: names remain data; behavior and authority remain bounded.

## Independent falsification

The separate fixture examiner contains its own reference canonicalizer rather than importing the transport cell it judges. Its v2 batch binds the examiner, adapter, and transport-cell source independently by SHA-256. The inventory v2 batch likewise binds the inventory organ, adapter, and transport source bytes that produced each compatibility result. The earlier v1 contracts and batches remain preserved rather than being silently reinterpreted.

Across the two current adapter requests it authored 44 cases and made 46 pure adapter calls. All 44 cases passed. The added cases test:

- preservation of a legitimate public `prototype` field;
- preservation of `constructor` as ordinary data;
- preservation of an own enumerable `__proto__` data property without prototype pollution;
- refusal of an input whose actual prototype was changed;
- refusal of an accessor-bearing input.

Direct transport tests additionally verify that getters are never invoked, proxies and symbols are refused, hidden and sparse structures are refused, source mutation cannot alter the detached seal, ordering is invariant, bounds hold, and `Object.prototype` remains unchanged.

## Operational observation

- Source adapter-request batch: `foundation-capability-output-adapters-1ab1a597a4a36e27de447320`
- Source adapter-request digest: `2a12a92c3ec4017566a8a4898a202c43f7ffcc0ff4427c8a26d462c1c406b13f`
- Fixture-exam v2 batch: `foundation-capability-output-adapter-fixture-exams-19fd916a81ab011f6d03c504`
- Fixture-exam digest: `43deb61a95ac00ba2e8d11976ca34420c563ace9053fa3bc5d57d80b2255a4e1`
- Fixture-exam file SHA-256: `46374e87ebef493ab09dc20882efb3611c15aff734d07241ce5a2698a62234f7`
- Native-artifact inventory v2 batch: `foundation-capability-native-artifacts-beccc5ebccc0059a4b5d94e9`
- Native-artifact inventory digest: `38ffbb6ec04c17b01b978d1cd2d8d1d839438b08d6b2782f32a919fda3866494`
- Native-artifact inventory file SHA-256: `4070e51c6a4e9c81ea45297d113ecd1d74c04502801c3fa0716069e477ac7a59`

The declaration-driven inventory again found 66 matching files: 45 current v4 root-schema witnesses, 21 older v2/v3 schema refusals, and one absent optional independent-exam root. All 45 current witnesses now pass the generic structural envelope boundary. The organ persisted only paths, hashes, root schemas, refusal classes, and source-stability seals—not artifact content.

## Claim ceiling

Structural envelope compatibility is not permission, requested-evidence eligibility, native verification, artifact selection, adapter execution, evidence admission, evidence relabeling, operational fit, or a decision about whether a new organ is needed.

This run performed zero artifact selections, permission evaluations, evidence-eligibility evaluations, adapter executions on real artifacts, native source executions, evidence admissions, relabelings, training admissions, permission grants, promotions, canon changes, or world actions.

## Verification

- Focused transport, adapter, independent-examiner, and inventory regression: 21/21 pass.
- Operational fixture exam: 44/44 independent cases pass; 46 pure adapter calls.
- Operational inventory: 45/45 current root-schema witnesses structurally compatible; 21 older schemas preserved as refusals.
- Full repository regression after v2 source sealing: 212/212 pass via `npm.cmd test`.
- Mirror Doctor structure check: PASS.
- Exact Foundation rerun: `NO_NEW_OBSERVATION_REQUIRED`; no duplicate request, snapshot, or execution receipt was written.
- Runtime server: not restarted or modified by this action.
- Git: no staging, commit, branch, push, or pull request performed by this action.

## Known limits

- No real artifact was adapted. The operational step was a read-only inventory compatibility check.
- The independent examiner uses synthetic fixtures; its pass proves bounded instrument discrimination, not real-world validity.
- Permission and requested-evidence eligibility remain unevaluated for all 45 witnesses.
- Existing legacy canonicalizers elsewhere in Mirror were not globally replaced. Doing so could silently change historical content addresses. This new cell is used at the untrusted evidence-envelope boundary and can be adopted elsewhere only through separately tested, lineage-preserving migrations.
- The cell is deterministic hardcoded Foundation machinery with no learned weights and no authority.

## Source seals at operational run

- Key-safe JSON transport cell: `3c22af810285a04c2693e4f6ce68cb6c54a0391739229193deede1d39221d9ba`
- Generic evidence-envelope adapter: `13f857fff1a8521e9dc8d9ee58afc0ea1258bf03ebc365c3dafbd3df9950fa3d`
- Independent fixture examiner: `0f65e556f9f33f6e10aae9b59458fa43cca64b274a6698a97010b13cef219246`
- Fixture-exam v2 batch contract: `64e7069e0ebdf751159daf9b65e734be70d9fb080f255bdcb067075fa2651a62`
- Native-artifact inventory organ: `67b56a2ce308e292467a899e85d1539221c5ec2cab1997a6a3aa93d9be88e026`
- Native-artifact inventory v2 batch contract: `ae29e953c72a43323bcda1b34314629c1551d9a348e16a59fbc69dc224a127b6`
- Direct transport test: `3f87316619bc3e0af3c2e2f3e05d45079c8a042325e8eba79ec8024ea7d925b5`
- Independent examiner test: `4fe48449a789cc1119d20f8a7e9a540acfd3c63c5450ae810a8812e1bfc1155d`
- Inventory test: `b7ee0d363ee7542f5325cbf20aec4ccc376b1367e56091b5009f1613e27735f4`
- Training policy: `fd2c8ab135e17884bc3ddb3c00087450d3c9a6ab9a125c5178812c7fd8d89ab1`

Mike alone may review and accept any future CANON claim. This action remains TEST.
