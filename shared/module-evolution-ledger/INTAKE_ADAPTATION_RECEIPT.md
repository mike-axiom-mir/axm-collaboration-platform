# Modular Library intake/adaptation receipt

Date: 2026-07-24  
Source: local intake archive `AXM_Modular_Library_v0.1.0_COMPLETE.zip`  
Live lane: `shared/module-evolution-ledger`  
Status: `TEST`; Mike review/promotion required

The source ZIP was opened read-only and was not extracted into or installed over the Workshop. The task supplied an already-passed 52/52 SHA-256 package audit. The source's optional Windows command-provider path remains out of scope.

## Harvested and adapted

| Source idea | Today's bounded adaptation |
|---|---|
| Immutable `module_versions`, semantic version, parent, content hash | Immutable SHA-256-chained `version.recorded` events. Parent must equal the current head under an exact-revision writer lock; ancestry is derived. |
| Mutable `known_good` flag / active pointer | Append-only `known-good.selected` history with a derived current pointer and exact Mike confirmation. It is not an active/install/promotion pointer. |
| Explicit `set_if_missing`, `replace`, `append_unique`, `add_unique_values` patches | Bounded pure evaluator plus `remove`, base witnesses, safe preservation of unrelated newer fields, and explicit `REBASE_HOLD` on touched-path conflicts. |
| SQLite `BEGIN IMMEDIATE` and WAL for concurrency | Dependency-free local append adapter: exclusive interprocess lock, expected-revision recheck under lock, flushed immutable event, atomic rename, and hash chain. No filesystem-wide ACID claim. |
| Daily upgrade gate | Configurable autonomous-only pacing (enablement, bump kinds, interval, open-count). It cannot block an exact Mike-approved hotfix path. |
| Pending activation recovery state | Persisted activation attempt metadata with source/target digests, Installer candidate/review references, Recovery Center snapshot reference, external observations, verification evidence, and restart-visible hold. |

## Deliberately discarded duplicates or authority conflicts

| Older-package component or behavior | Disposition |
|---|---|
| Automatic proposal apply / activation | Discarded. Module Installer remains the sole module file-write/install authority. |
| Automatic crash rollback to a parent | Discarded. Restart produces an `INTERRUPTED_HOLD`; only a review-only Recovery Center handoff is emitted. |
| Package verifier and acceptance engine | Discarded. Verification Spine and specialist verifiers remain authoritative. |
| Database backup and rollback system | Discarded. Recovery Center remains snapshot/restore/rollback authority. |
| Dashboard and CLI | Discarded. No competing Workshop UI or command foundation was added. |
| Research ingest, feeds, mapper, category suggestions, generic planner | Discarded. Neutral Modular Intake, Workshop Needs Observatory, and current research systems retain their lanes. |
| Command provider execution | Discarded and out of scope, including the known Windows TOML escaping failure. |
| SQLite as a new canonical Workshop store | Discarded for this leaf. Node's built-in SQLite exists locally, but a new canonical database would compete with current state authorities; the narrower append adapter meets the required local concurrency contract. |
| Verification pass as permission or promotion | Discarded. `PASS` records `permissionGranted: false` and waits for Mike. |

## Authority receipt

- Neutral Modular Intake: unchanged; inspect/quarantine/family/compatibility authority.
- Module Installer: unchanged; only module file-write/install authority.
- Verification Spine and specialists: unchanged; verification authority only.
- Recovery Center: unchanged; snapshot/restore/rollback authority.
- Evidence Retention: unchanged; append-only session-evidence authority.
- Workshop Needs Observatory: unchanged; readiness/gap authority.
- Mike: explicit review, permission, confirmation, known-good selection, and promotion gates preserved.
- Ledger: may append local evolution facts, evaluate patches, derive pacing holds, and prepare typed handoffs only.

## Standalone Installer adapter handoff

No current Installer or operations seam was edited. The leaf adapter in `module-installer-handoff.js` defines the smallest future connection:

1. After Neutral Modular Intake routing and Installer staging/review, convert the exact Installer candidate digest and manifest version into `recordVersion()` input.
2. Before any explicit Installer apply, require a current known-good source, a Recovery Center snapshot reference, the exact Installer candidate/review references, and Mike's activation-record confirmation in `prepareActivation()`.
3. Record the externally initiated Installer attempt; do not initiate it from the ledger.
4. Convert the Installer receipt or an independent local digest into `recordActivationObservation()` input.
5. Record Verification Spine/specialist evidence. A pass waits for Mike and never moves known-good by itself.
6. If bytes are ambiguous or verification is held, emit only a Recovery Center review handoff. Recovery Center decides and performs any restore/rollback under its own gates.

This seam should be wired only after re-reading the live Installer and Recovery Center sequencing together. Until then, standalone operation avoids silently changing either authority.

## Remaining gaps

- The pure Installer handoff is not registered in the live Installer service; no module lifecycle automatically writes ledger events.
- The ledger records Recovery Center snapshot references but does not validate them against a Recovery Center receipt API because no such shared receipt seam was added here.
- The append adapter fails closed on an abandoned writer lock. Explicit lock-recovery tooling is intentionally absent pending a reviewed operator contract.
- `TEST` status remains; there is no Mike promotion or CANON mutation.

## Verification receipt

All required surfaces passed at the final checkpoint:

- `node shared/module-evolution-ledger/selftest.js` — PASS, including a real two-process stale-writer race and a fresh-process interrupted-activation inspection.
- Capability comparator — `READY`; no required capability missing.
- `node tools/module-installer/selftest.js` — PASS.
- `node shared/operations/selftest.js` — PASS, 73 checks.
- `node shared/verification-spine/selftest.js` — PASS, 31 checks.
- `node tools/recovery-center/selftest.js` — PASS.
- `node shared/modular-intake/selftest.js` — PASS.
- `node verify.js` — PASS: `0 FAIL · 38 warn` at the final rerun, `2026-07-24T20:12:35.851Z`.

Thirty-seven broad warnings are existing Workshop game-package, manifest-completeness, contract/selftest, lifecycle, and promotion-reverification backlogs outside this leaf. The additional `tools-index.json is stale` warning appeared after code-recipe-foundry files changed concurrently between the first broad pass and the final rerun; it is classified `MOVING_WORKSPACE`. This lane did not regenerate that shared index or overwrite the foreign work. No failure or warning was concealed, weakened, or converted into a capability declaration. Full claim routing is in `EVIDENCE_ROUTE.json`.

## Shared-workspace stewardship receipt

- Lane-owned: every file beneath `shared/module-evolution-ledger`.
- Shared seams touched outside the new leaf: none.
- Existing Installer, Operations, Verification Spine, Recovery Center, Modular Intake, Evidence Retention, Needs Observatory, Hub, CANON, and root registries were read/tested only.
- Foreign files observed changing: code-recipe-foundry manifest/receipt/selftest, Studio command-deck files, visual-actions files/contract, Workshop Search Provenance manifest, World Tile Foundry source/verification manifests, and `tools-index.json`; all were preserved.
- Final state: stable inside the ledger lane; globally moving because unrelated builders remained active.
