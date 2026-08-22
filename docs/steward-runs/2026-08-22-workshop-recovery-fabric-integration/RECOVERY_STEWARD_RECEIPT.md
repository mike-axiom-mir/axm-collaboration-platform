# Workshop recovery and Fabric v2.2 integration receipt

Status: **TEST**  
Branch: `codex/workshop-recovery-fabric-integration-20260822`  
Original canonical head: `c6e7909267f51a6fa14395e46d6917678ef87d06`  
Tested source tree: `f36b96cebde91dbc92ff3a5a9c1efdf4e0f34be1`  
Date: 2026-08-22

## Outcome

The canonical Workshop checkout was recovered in place. The initial census found
13,170 dirty paths: 3,568 tracked modifications, 31 tracked deletions and 9,571
untracked paths. Repeated snapshots and process probes found no continuing bulk
generator. Two late Foundation Planet R62 documentation saves appeared
sequentially during closeout, remained stable across repeated observations and
were preserved in one bounded documentation commit.

The completed Code Capability Fabric v2.2 TEST tip
`a580f6496fa57c84f994447d03e9569119796b49` is integrated by merge commit
`ae2911371885c4a097dffb463ec265502acfdd40`. The merge has exactly these parents:

1. `c6e7909267f51a6fa14395e46d6917678ef87d06`
2. `a580f6496fa57c84f994447d03e9569119796b49`

`git merge-base --is-ancestor` confirms the Fabric tip is an ancestor of the
tested tree. No Fabric v2.3 work is included in this recovery receipt.

## Recovery evidence and classification

- 10,307 dirty files matched the grounded-growth serialization closure branch
  byte-for-byte; another 59 matched after LF normalization. This established
  recoverable provenance for the large shared cohort instead of treating it as
  anonymous generated output.
- All 31 tracked deletions were copy/filter omissions: every path existed at the
  original head and relevant comparison refs. They were restored from the
  original head before recovery commits were made.
- Source, reviewed data, tool packages, games, visual/human capability labs,
  audit evidence and steward receipts were separated into bounded commits.
- Generated verifier logs, repetitive run telemetry, private attachments,
  machine-local state and raw recovery views were retained locally and excluded
  from Git.
- The sensitive-content review found no live credential in admitted changes.
  Its only quoted secret-shaped literal was an adversarial dummy value in a test
  that proves secret-like metadata is rejected.
- Machine-local path sanitization made 2,183 substitutions across 27 files. The
  original file digests remain in the local raw inventory; committed additions
  passed a separate machine-path scan.
- No uncertain material was moved to quarantine. No file was deleted to clean
  the checkout.

The compact curation record is `EVIDENCE_CURATION.json`. Its eleven local raw
artifacts were re-hashed at closeout with zero mismatches. The largest raw
derived view, `PROVENANCE_MAP.json`, remains local-only rather than adding 75 MB
of rebuildable history to Git.

## Recovery commits

- `be00cb6f19b18a90d5f7d14303758c0ffd95e0ae` — shared platform and source seams
  (366 files)
- `6ef7796921a19a7b019fb5868dadcf9b9a852a86` — game and universal-control
  packages (830 files)
- `24638ce93bc0baf2a1c0004a4088a044af9785ba` — human capability and challenge
  labs (1,251 files)
- `07d8510ac085fc7acc847efe14674abf48455adb` — asset and platform tool packages
  (252 files)
- `7ad35b307d0caff798f7886c5434e483bdb49fbc` — audit and steward evidence
  (165 files)
- `15e2b73cdcededa3e0f9d677a80743ec4aa7d640` — late Foundation Planet R62 notes
  (2 files)
- `f36b96cebde91dbc92ff3a5a9c1efdf4e0f34be1` — deterministic recovered tool
  catalog refresh (1 file)

The complete original-head-to-tested-tree range changes 11,733 files with
1,858,054 insertions and 11,671 deletions. This count includes the reconciled
Fabric/grounded-growth history brought in by the merge, not only the seven
recovery commits above.

## Preserved local-only material

These paths remain in `<AXM_WORKSHOP>` and are ignored. They were not committed,
executed or deleted:

- `.codex-remote-attachments/` — 15 private attachment files, 2,457,988 bytes;
  aggregate manifest digest
  `sha256:144b2f603b29f0f998b26dd7a122dea78de9b50ff1459593b94636fd13b3bc57`
- `.temp-asset-creation-matrix-runner.js`
- `.temp-asset-creation-matrix-worker.js`
- `AXM_UNIVERSAL_CONTROL_SYSTEM_v0_2_1_XBOX_BRAWL_INTEGRATED.zip`
- `AXM_VISUAL_HANDSHAKE_v0_3_0_MODULAR_2026-07-28.zip`
- `PRIVATE_VERIFICATION_REPORT_v0_2b.md`
- `PRIVATE_VERIFICATION_REPORT_v0_2c.md`
- `PRIVATE_ZIP_LAYOUT_AND_ADAPTER.md`
- `private-preview.js`
- `tools/aetherfx/runtime/reports/NPM_VERIFY_v1_3_0.log`
- `tools/aetherfx/runtime/reports/historical-v1.2/BROWSER_SMOKE_RUN_v1_2_0.log`
- `tools/aetherfx/runtime/reports/historical-v1.2/NPM_VERIFY_v1_2_0.log`
- `tools/aetherfx/runtime/reports/historical-v1.2/VISUAL_BASELINE_UPDATE_v1_2_0.log`
- `tools/aetherfx/runtime/reports/historical-v1.2/VISUAL_REGRESSION_RUN_v1_2_0.log`
- `exports/verification-spine-report.json`
- `logs/workshop.log`
- `bridge/bridge.log`
- `bridge/bridge-token.txt`
- the eleven exact raw/telemetry paths listed with byte counts and SHA-256
  digests in `EVIDENCE_CURATION.json`

`projects/README.txt` is byte-identical to the original canonical head. No
private project content was admitted.

## Verification

All ten checks required by `AGENTS.md` passed on the tested tree:

1. `node verify.js`
2. `node hub/hub-selftest.js`
3. `node hub/route-selftest.js`
4. `node hub/graft-selftest.js`
5. `node hub/skin-selftest.js`
6. `node hub/verify-plus.js`
7. `node tests/html-script-syntax-test.js` — 55 PASS, 0 FAIL
8. `node tests/tool-forge-package-test.js`
9. `node tools/agent-tool-forge/selftest.js` — 17 PASS, 0 FAIL
10. `node tools/evidence-desk/selftest.js` — 36 PASS, 0 FAIL

The required suite was run twice. After the first pass reported a stale
`tools-index.json`, the repository's trusted deterministic index entry point was
used without its selftest-execution option. `verify.js` then confirmed the index
matches 224 tools and 1,959 declared capabilities, and the full required suite
passed again.

Focused Fabric verification ran 24 selftests. Twenty-three passed, including
all current Fabric runtime suites, the schema-packet mirror verifier (130
checks), supporting detached/lineage tools and every receipt from hardening v1.4
through mirror verification v2.2. The old intake receipt selftest failed because
it pins `README.md` at 1,560 bytes while the later admitted native graft is 1,609
bytes. This is classified as a preserved historical-receipt drift failure, not
a v2.2 runtime or integration regression; the later receipt selftests pass. The
historical receipt was not rewritten.

Recovery checks passed:

- merge ancestry and exact merge parents
- syntax checks for all five recovery scripts
- eleven local curation digests with zero mismatches
- Git connectivity (`git fsck --connectivity-only --no-dangling`)
- zero diff-check findings in each of the seven recovery commits
- clean tracked status after repeated settling snapshots

The full original-head-to-tested-tree diff retains 10,394 whitespace findings
across 81 inherited/integrated paths. They are historical data, sealed receipts
and source from the reconciled lineage. Each new recovery commit is clean; the
historical material was left visible instead of silently normalized.

Browser render/click verification: **N/A — not run and not claimed**.

## Boundaries and pending decisions

- `tools/mirror-code-clone` remains **EXPERIMENTAL**. It and supplied
  experimental runtimes were not executed, installed, connected or promoted.
- Fabric capability declaration and TEST composition do not grant execution
  authority, permissions, activation, resources, accepted effects, promotion or
  CANON status.
- Fabric v2.3 is separately complete at
  `ce4c2e0c7aa986bbfb0cb3ae353001c647960f3a`. It is a pending handoff only and
  was not merged here. Its own final target drift receipt reports zero exact path
  overlap with the tested recovery tree and reserves the next merge decision for
  Mike.
- No remote push, publication, promotion or CANON change occurred.

## Four-root closeout

- **Truth:** counts, ancestry, digests, failures and warnings are recorded
  without upgrading TEST claims.
- **Agency / non-domination:** local/private state stayed local; no runtime,
  permission, merge-gate or promotion authority was inferred from capability.
- **Continuity:** the original canonical head and Fabric v2.2 tip are both direct
  parents of the integration merge; all admitted work is registered in the
  canonical repository branch.
- **Wisdom over speed:** uncertain/generated material was retained locally,
  historical failures were preserved and the newer Fabric rung remains a
  separate review decision.
