# Mirror Foundation native-artifact inventory action report

Status: **TEST**  
Date: 2026-07-19  
Steward acceptance: not requested; not CANON

## Outcome

Mirror now has a generic, declaration-driven private inventory organ for native capability artifacts. Separate capability-bound sidecar declarations identify only bounded JSON roots beneath ignored `state/` or `training/datasets/` paths. The organ persists paths, sizes, file hashes, root `schema` values, refusal classes, and before/after source fingerprints. It never persists artifact content.

The operational inventory read two verified declarations and examined the two native output kinds already requested by the generic evidence-envelope adapter route. It found:

- 66 filename-matching reasoning-receipt files;
- 45 v4 root-schema witnesses;
- 21 older v2/v3 root-schema mismatches, preserved as refusals;
- one absent optional independent-exam root, preserved as a hold;
- zero selected artifacts.

“Root-schema witness” is deliberate. The organ verifies the declared top-level `schema` value and seals the file bytes; it does not claim full capability-specific schema validation.

## Why this organ was needed

The generic adapter and its synthetic examiner established instrument discrimination, but Mirror still had no generic machine declaration for where native artifacts might exist. Without a declaration-driven inventory, each capability would require a capability-specific scanner or a human would have to hand the route every artifact.

The new sidecar contract makes location, filename rule, depth, count, byte ceiling, expected root schema, private artifact class, and availability machine-readable. A future capability can add a valid declaration without adding a new routing branch. Discovery still grants no use permission or evidence status.

## Independent boundary verification

Five focused tests cover:

- root-schema witnesses versus old schemas and invalid JSON;
- declaration and artifact-order invariance;
- path traversal refusal;
- ambiguous declaration hold;
- file count and byte ceilings;
- root junction/symlink refusal;
- source mutation between before/after fingerprints;
- append-only deterministic reuse;
- committed batch tamper refusal without erasure;
- policy, contract, private-route, package, doctor, and runtime boundaries.

The tests use synthetic artifact roots and independently assert zero permission evaluation, evidence eligibility evaluation, selection, adapter execution, native-source execution, evidence admission, or promotion.

## The useful contradiction it found

All 45 v4 reasoning receipts match the declared root schema, yet all 45 are currently refused by the generic envelope boundary. Their public machine trace legitimately contains a field named `prototype`; the conservative envelope rejects any `prototype` key as an unsafe object key.

The inventory preserves both observations independently:

- artifact bytes exist and declare the requested v4 root schema;
- current generic-envelope compatibility is refused and was not executed.

This is the next bounded seam. The inventory does not weaken the adapter, rewrite the receipts, reinterpret the field, or call the refusal a failure of the underlying reasoning capability.

## Operational trace

- Latest snapshot: `foundation-development-2f687ab2b0809c9a06aa4a25`
- Snapshot digest: `d6f0ee08ef25121861dcd48fcb9c4239760752c73145f5bf2192c2642bcff9c4`
- Adapter-request batch: `foundation-capability-output-adapters-8bc8621b45f17c50f9065df3`
- Adapter-request digest: `e28fd9f77d42da35cd9745ebaee63c0fee1084a8b89f68c734223c39ddac6a76`
- Inventory batch: `foundation-capability-native-artifacts-323a4dfb1614fdbd5a9d833c`
- Inventory digest: `b5925b22b3aef6facfc13f09df48b81d4c936e74a798cc414b8cad6039c9daaa`
- Inventory file SHA-256: `c15eb6a6069bd909729cafd056b8c21eab0c1d79360304a432e0cb53d23c2a40`

The first root-schema-corrected inventory observation had eight observed-passing dimensions and two open evidence gates. A later evidence-only observation kept the same Foundation subject digest but detected that concurrent Workshop development had changed the previously settled Workshop source inventory. Mirror therefore exposed one `DISCOVERY_TRANSFER_ACROSS_WORKSHOP_GROWTH` regression and opened an independent regression-exam hand. That regression is preserved and is not attributed to this inventory organ or averaged away.

## Verification

- Focused inventory tests: 5/5 pass.
- Focused integrated inventory, adapter, survey, and model-BOM tests: 27/27 pass before the root-schema wording correction; the corrected inventory and model-BOM subset then passed 7/7.
- Final full repository regression on Node v24.17.0 after the wording correction: 206/206 pass via `npm.cmd test`.
- Mirror Doctor after final integration: `Structure: PASS`.
- Active runtime import: false.

Direct `npm test` through the PowerShell `npm.ps1` wrapper was not used; `npm.cmd test` runs the repository's exact `node --test tests/*.test.js` script.

## Claim ceiling and known limits

This result is a private hash-and-root-schema inventory only. It does not prove:

- full artifact-schema validity;
- artifact authorship, independence, permission, or requested evidence eligibility;
- generic-adapter compatibility or operational fit;
- capability execution or a real observed outcome;
- evidence admission, training eligibility, or new-organ need.

Current measured ceilings remain:

- permission evaluations: 0;
- evidence eligibility evaluations: 0;
- artifact selections: 0;
- adapter executions: 0;
- native source executions: 0;
- evidence admissions and relabelings: 0;
- capability selections and operational-fit claims: 0;
- new-organ decisions: 0;
- training admissions, permission grants, promotions, canon changes, and world actions: 0.

The current Workshop-transfer regression remains review-required while concurrent Workshop source changes are unsettled. Mirror did not repair, suppress, or reclassify it.

## Changed implementation surface

Primary additions:

- `organs/foundation-capability-native-artifact-inventory-organ.js`
- `contracts/foundation-capability-native-artifact-inventory-declaration.schema.json`
- `contracts/foundation-capability-native-artifact-inventory-batch.schema.json`
- two capability inventory declarations under `capabilities/`
- `scripts/run-foundation-capability-native-artifact-inventory.js`
- `tests/foundation-capability-native-artifact-inventory-organ.test.js`

Integration updates connect the organ only to private Foundation observation and Workshop stewardship routes, add package/doctor/README surfaces, include the organ in the measured Foundation subject, and record the 28th immutable batch writer. The active Seed-0 runtime was not restarted or changed.

## Source seals

- Inventory organ: `9d52544a286a8a932f47d12c5ca69f5fb818fc30fbd6076b8701a429d91ea8d9`
- Declaration contract: `75dfaf5a07223464a5da1b97aac451048112a7b9feb44b58a0c62ea4c154dedd`
- Batch contract: `d8b6aa2a82661b4027421dba22d7217a638376c28f33045763806fc9be50a266`
- Reasoning-receipt inventory declaration: `e4711336bd871225009a764a0e00a5e1c388e0f699f440073ba6fd6e6789ca5a`
- Independent-exam inventory declaration: `e2e02452d47fb56c654ae7b5e2e43eb6f73689340eaeda1e28de58b16248c08d`
- Training policy: `fd2c8ab135e17884bc3ddb3c00087450d3c9a6ab9a125c5178812c7fd8d89ab1`

Private artifact content and ignored `state/` batches remain outside commits. Failed and superseded traces remain preserved; nothing was promoted to CANON.
