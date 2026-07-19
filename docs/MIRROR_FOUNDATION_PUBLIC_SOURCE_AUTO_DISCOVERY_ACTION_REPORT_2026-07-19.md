# Mirror Foundation Public-Source Auto-Discovery Action Report — 2026-07-19

Status: TEST

Claim ceiling:

`TEST_BOUNDED_AUTO_DISCOVERED_PUBLIC_SOURCE_SUBJECT_PRIVATE_AND_UNSAFE_PATHS_EXCLUDED_NO_SOURCE_EXECUTION_TRUST_CAPABILITY_PERMISSION_TRAINING_PROMOTION_OR_WORLD_AUTHORITY`

## Seam removed

Foundation observations previously depended on a manually maintained
`CORE_SOURCE_FILES` array in the observatory. A future organ could be present,
tested, and used but remain absent from the Foundation subject until a human
remembered to edit that central list. That made development observability
silently incomplete and forced one more manual step for every new organ.

The observatory now delegates subject construction to a separate deterministic
public-source inventory cell. The hardcoded filename list is removed.

## Machine ground added

The cell scans thirteen fixed public roots:

- roots
- kernel
- learning
- organs
- runtime
- contracts
- capabilities
- config
- adapters
- modules
- training
- scripts
- tests

Four anchors must always exist: `package.json`, the AXM roots file, the runtime
server, and the training policy. Admitted source extensions are bounded to CJS,
CSS, HTML, JavaScript, JSON, and MJS. Each file is represented only by canonical
relative path, byte count, and SHA-256 digest.

Hard limits are 1,024 files, 2 MiB per file, 32 MiB total, and depth 16. Roots,
directories, and files must be real and non-symbolic. Path escape, case
ambiguity, mutation during reading, hidden source, missing anchors, and limit
violations refuse the inventory.

Private or operational material remains outside the subject boundary:

- state, logs, private memory
- training datasets and candidates
- checkpoints
- module runtime storage
- packets and promotion packets
- rollback and lineage stores
- node modules and caches
- local configuration
- secret, key, and token files

Excluded private directory contents are not enumerated into the subject, so a
private receipt or runtime-session change cannot cause source-observation drift.

## What the tests established

- The live inventory automatically contains the new calibration cell, organ,
  contracts, and existing module manifests.
- Adding a previously unseen future organ changes the subject digest without an
  observatory edit.
- Different file-creation order produces identical canonical inventory.
- Changing private training data or module runtime storage leaves the source
  digest unchanged.
- Symlinked source, hidden source, local config, absent anchors, raised hard
  limits, excessive count, file size, total size, and depth are refused.
- A self-digested authority forgery is refused.
- The active runtime does not import the inventory cell.

## Authority boundary

Discovery means only that bytes exist inside the bounded public-source scope.
It is not trust, capability, correctness, permission, evidence eligibility,
execution, training material, runtime promotion, canon, or world-action
authority. New source changes the next observation identity; it does not make
the source accepted or active.

## Files changed

New:

- `kernel/foundation-public-source-inventory-cell.js`
- `contracts/foundation-public-source-inventory.schema.json`
- `tests/foundation-public-source-inventory-cell.test.js`
- `docs/MIRROR_FOUNDATION_PUBLIC_SOURCE_AUTO_DISCOVERY_ACTION_REPORT_2026-07-19.md`
- `exports/action-reports/MIRROR_FOUNDATION_PUBLIC_SOURCE_AUTO_DISCOVERY_AUDIT_2026-07-19.json`

Integrated:

- `organs/foundation-development-observatory-organ.js`
- `training/TRAINING_POLICY.json`
- `scripts/mirror-doctor.js`
- `README.md`
- `MODEL_BOM.json`
- `STATUS.json`

## Verification

- Inventory-specific tests: 6 passed, 0 failed.
- Combined inventory, observatory, request, executor, and BOM tests: 21 passed,
  0 failed.
- Full repository suite: 237 passed, 0 failed.
- Live bounded inventory: 440 public source files, 3,101,809 bytes, thirteen
  roots, digest
  `af437cb91f274bbce54df454d199c9f5a933210c31179d069479dd6f653f5d65`.
- Mirror doctor: PASS.
- Final operational observation:
  `foundation-development-73d6ad2b4f6557dc346a3ebc`, digest
  `e9f442177afc764ac5f01f0e233a94af9632e1dff66fc38c8448d81b72c809b3`.
  It preserved seven observed-passing dimensions, two open evidence gates, one
  direct Workshop-transfer regression, and fifteen longitudinal regressions.
  It performed zero training admissions, repairs, permission grants,
  promotions, canon changes, or world actions.

No runtime route, learned weights, private dataset, checkpoint, permission,
training admission, promotion, canon change, or world action was added. The
active runtime was not restarted. No Git stage, commit, branch, push, or pull
request action was taken.

## Known limits

- Fixed roots remain a deliberate hardcoded safety boundary. A genuinely new
  top-level source class still requires explicit steward review.
- File discovery does not understand semantics or decide whether code works.
- Source files outside the admitted extensions remain unobserved by this cell.
- The inventory detects local filesystem order and content, not independent
  authorship or external provenance.

Only Mike may accept CANON.
