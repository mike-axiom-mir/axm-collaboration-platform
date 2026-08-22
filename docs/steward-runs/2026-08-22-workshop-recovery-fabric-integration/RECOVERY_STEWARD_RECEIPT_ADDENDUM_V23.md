# Workshop recovery receipt addendum: Fabric v2.3 integration

Status: **TEST**

This append-only addendum supersedes only the earlier receipt's statement that
Code Capability Fabric v2.3 was pending. Mike subsequently directed that all
completed Workshop work be integrated. No other recovery evidence or boundary
in the original receipt is rewritten.

## Integration

Completed Fabric v2.3 tip
`ce4c2e0c7aa986bbfb0cb3ae353001c647960f3a` was integrated by merge commit
`5cdfa147e691cdfcb78128ec91d80cdb71198bbb` with these exact parents:

1. `d28cbe06f1782c6a579ab5e48b9693c9ae196043` — sealed whole-Workshop recovery
2. `ce4c2e0c7aa986bbfb0cb3ae353001c647960f3a` — completed Fabric v2.3 TEST tip

The common base was Fabric v2.2 tip
`a580f6496fa57c84f994447d03e9569119796b49`. The v2.3 source added 20 paths and
had zero exact path overlap with the 2,865 target-side paths changed since that
base. The audited merge-tree and the real merge were conflict-free.

The merged result adds the read-only signed Git object-inventory comparison
contract, schemas, implementation, selftest and steward evidence. It does not
add ref-set comparison, transport, clone-completeness or recovery-replay rungs.
It does not import or execute `tools/mirror-code-clone`.

Two historical handoff receipts contained machine-specific checkout paths. The
source branch was preserved unchanged; the merged final-tree copies use portable
`<AXM_WORKSHOP>` placeholders. The staged final-tree diff passed the separate
machine-path scan with zero findings.

## Verification

All ten `AGENTS.md` checks passed against the pending merge, including:

- `node verify.js` — tool index matches current structural source digest
- `node tests/html-script-syntax-test.js` — 55 PASS, 0 FAIL
- `node tools/agent-tool-forge/selftest.js` — 17 PASS, 0 FAIL
- `node tools/evidence-desk/selftest.js` — 36 PASS, 0 FAIL

Focused integration verification ran 17 checks. Sixteen passed, including:

- the signed Git object-inventory comparator — 174 checks passed
- the Fabric v2.3 steward receipt selftest
- the Fabric v2.2 mirror-verification receipt selftest
- all current Fabric runtime suites from the base planner through v2.3
- deterministic JSON, module-lineage and Workshop-updater support suites

The single failure remains the preserved historical Fabric intake receipt check:
it expects the earlier native-graft `README.md` byte count of 1,560 while the
integrated Workshop contains the later admitted 1,609-byte form. This is the
same historical-receipt drift recorded by the main recovery receipt. It is not a
v2.3 comparator, current Fabric runtime or merge regression, and it was not
concealed by rewriting old evidence.

Browser render/click verification: **N/A — not run and not claimed**.

## Boundaries

- No remote push, publication, promotion or CANON change occurred.
- No experimental runtime, package runtime or mirror clone was executed.
- Capability declaration and TEST composition did not grant execution authority,
  permissions, activation, accepted effects or promotion.
- Private/local ignored material listed in the main recovery receipt remains
  preserved in place and uncommitted.
