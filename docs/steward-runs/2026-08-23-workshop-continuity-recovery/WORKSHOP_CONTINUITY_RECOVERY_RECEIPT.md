# Workshop continuity recovery receipt

Date: 2026-08-23  
Branch: `codex/workshop-recovery-fabric-integration-20260822`  
Status: **TEST / WORKING — recovery material for Mike Tobi review; not CANON**

## Outcome

The Workshop source inventory lost by the bad integration tree has been restored and reconciled with the later Fabric and Observatory work. The active scan now reports:

- 23,945 active files: 16,724 text and 7,221 binary at the live browser observation
- 183,727,828 text characters
- 4,290,659 text lines, including 1,293,892 code lines
- 232 top-level tools, 20 games and 2 living worlds
- 2,031 unique provider-declared exact capabilities
- 2,256 provider capability declarations
- 2,200 exact provider-plus-consumer contract capability identifiers in the generated public discovery catalog

This is above the recovered pre-merge high-water inventory of 219 tools, 1,874 provider-declared exact capabilities and 2,096 provider declarations.

## What happened

Integration merge `ae291137` combined stale July visual parent `c6e79092` with Fabric parent `a580f649` without carrying the latest Workshop mainline tree. Git produced a valid merge, but the result silently omitted newer packages and source paths because no inventory-continuity invariant existed.

The later intake cleanup exposed the damage but did not cause the source loss. Its append-only receipt records 41,258 raw intake files moved to recovery storage and states that no source carriers were deleted. The large `-38,222` file delta in the old growth view primarily reflected raw intake carriers leaving the active-source counting scope. Separately, the bad merge caused a real capability regression: the damaged tree showed 224 tools, 1,778 provider-declared exact capabilities and 1,999 declarations.

Mike's recollection that the Workshop had more than 2,000 capabilities was correct for provider declarations. The two numbers had different meanings: the old UI's 1,778 was the deduplicated exact-provider count, while declarations had previously reached 2,096.

## Recovery performed

- Restored every path present at the pre-merge high-water revision but absent from the damaged tree, except raw `intakes/` carriers intentionally moved by cleanup.
- Verified that no non-intake high-water path remains absent.
- Restored missing deterministic PR, production, compute, hardware, Review Inbox, Browser LAN QA, RepairBuddy and Shadow Clone Steward packages.
- Restored Review Authority, phone QA, operations, continuity, verification and source-evolution seams.
- Reconciled restored modules with later Fabric, readiness, Observatory, source-catalog and identity changes instead of rolling those changes back.
- Regenerated readiness and public discovery outputs and repaired stale recovered tests that still described older, valid states.
- Moved five untracked AetherFX runtime logs into `local-data/recovery/workshop-recovery-20260823/aetherfx-omitted-logs/`; they were not deleted and no longer contaminate the distributable runtime.

## Prevention added

The Workshop now has a fail-closed inventory-continuity gate:

- `shared/continuity/workshop-inventory-continuity.js`
- `scripts/generate-workshop-continuity-baseline.js`
- `tests/workshop-continuity-gate-test.js`
- `registry/workshop-continuity-baseline.json`
- `registry/workshop-continuity-retirements.json`

The protected baseline is the union of the last complete Workshop mainline and the later Fabric integration. It protects path presence, tool IDs, exact provided capability IDs, provider bindings and consumer bindings. New files or capabilities cannot mask a disappearance.

A protected item may disappear only through a separate retirement-ledger record with `status: AUTHORIZED`, `authorizedBy: Mike Tobi`, a reason and a date. A module cannot retire itself. The baseline generator does not run automatically and refuses writes without the explicit `--confirm-mike-reviewed` flag. The gate runs in `verify.js`, readiness tests and the public-launch workflow.

## Verification record

Completed successfully during recovery:

- Root verifier: 0 failures; known-open phone/game warnings remained visible.
- All ten checks required by `AGENTS.md`.
- Readiness suite and both old and new continuity selftests.
- All 24 recovered shared-module suites and 11 critical restored-tool suites.
- Operations, modular intake, AI Team Steward and cognitive-resource suites.
- Foundation controls: 23/23.
- District Party: 229/229.
- Asset Hands: 45 executable creation providers, 0 curated gaps; completion and upgrade suites passed after the runtime-log boundary was restored.
- Foundation Planet's final read-only rerun passed its 2,500+ assertions after its concurrent R67–R69 edits settled.
- All remaining workspace suites passed.
- The complete top-level `npm test` command then passed end to end and exited with code 0.

An intermediate Foundation Planet run saw an alkalinity-route audit failure while its separate R67–R69 files were changing concurrently. The recovery did not edit or revert that lane, and the final rerun passed.

Final generated views are exact at:

- City graph: `81d66360e9e85078d4a7eb9d7f82441bafbe97f2c580f711240cf7537ab723d6`
- City schema registry: `23452d5f3f7f22dbe0a0aa20ab1ee3a7faf2de23a78551ffba68f367f1d2289d`
- City twins: `110518bf165499511e38383f4bc2e5496c8c3dc84aa3ea9028e253d14374a602`

The final required-check run passed all ten `AGENTS.md` commands. `node verify.js` reported 0 failures and 21 visible known-open warnings. The continuity audit passed with 20,387 protected paths, 232 tools, 2,031 exact provided capabilities and no unauthorized disappearance.

Live browser verification used a fresh local server and headless Chrome at 1440 × 1200. A real click on the visible **Workshop Observatory** navigation opened the overlay; the page rendered 23,945 files, 232 tools, 2,031 exact provider capabilities, 2,256 provider declarations, the current lifecycle/evidence map and five opportunity classes. The page/API values agreed and the browser reported no exceptions. The retained screenshot is `local-data/qa/workshop-recovery-20260823/workshop-observatory-live.png`.

## Scope-transition trust closure

The Growth page no longer depends on recollection to explain the 2026-08-22 cleanup. A tracked transition ledger binds the retained rules-v0 snapshot, the first comparable rules-v2 baseline, the external archive manifest, the recovery inventory and a fresh full archive-verification receipt:

- `registry/workshop-scope-transitions.json`
- `shared/growth/scope-transition-receipts.js`
- `state/workshop-growth/archive-verification.json` (local verification state; not distributable source)

The fresh local audit rehashed all 21 reviewed archive roots: 41,258 files and 1,441,627,208 bytes, with zero inventory or evidence mismatches. The stable archive-manifest SHA-256 is `64937e914d7631b2ae9e4435392067bfceb01c15695daace696061f29f9bd9d7`; each local audit receipt is self-hashed and replaced only by a passing audit.

The receipt remains visible on Growth after later compatible snapshots. On each server run, and again after the audit freshness window, the page reports `VERIFYING` until an isolated worker has rehashed the archive. If the old snapshot, new baseline, archive manifest or sealed full-audit receipt is missing or changed, the page reports `BROKEN` instead of silently accepting the transition. The reviewed intake-archive entry point validates every planned root before movement, verifies every destination afterward and rolls the exact roots back if post-move reconciliation fails. The normal Growth request now returns Workshop measurements first while Mirror and the archive audit run through separate polling routes.

The fail-closed fixture suite covers missing receipts, changed receipts, restart/history loss, pre-move mismatch, post-move mismatch and rollback. A live browser click at 1440 × 1200 rendered the transition as `VERIFIED`, showed all 21 archive destinations and had no page exceptions or horizontal overflow. The retained screenshot is `local-data/qa/workshop-recovery-20260823/growth-scope-transition-live.png`.

## Truth boundary

This receipt proves source presence and the named automated checks only. It does not turn TEST or WORKING material into CANON, does not replace Mike's review, and does not claim physical-device QA or browser behavior without a separate live observation.
