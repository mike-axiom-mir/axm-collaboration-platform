# Integration handoff — bounded portable FSM definition v2.19

Status: `TEST` review packet; no integration performed.

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/69>

## Exact source and target assumptions

- Source branch:
  `codex/code-capability-fabric-portable-fsm-v2.19`
- Technical source commit:
  `0a3af63d2e8118a6a66bf1df88afd0c85cf0f0bf`
- Technical parent / required stacked target:
  `c0d57d4ea0403b5d0932e4abf177d207bc87791b`
- Target branch:
  `codex/code-capability-fabric-bounded-record-query-v2.18`
- Target review: PR68
- Immediately before technical publication, the remote target and PR68 head
  both equalled the required stacked target exactly. PR68 was open, draft, and
  clean/mergeable.
- The canonical Workshop checkout was separately observed clean at
  `7dd800d09731607b2936b580ab972d8033801736` and was not switched,
  overwritten, merged, or modified by this run.

PR69 is intentionally stacked on PR68. Review or acceptance of PR69 must not
skip the still-separate decision for PR68. The preferred integration action is
review in PR69 after confirming its displayed head equals the sealed tip
reported at steward closeout.

## Exact technical changed paths

```text
docs/generated/LEGO_CITY_BEGINNER_MAP.md
docs/generated/LEGO_CITY_MAP.md
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/CAPABILITY_GAP_AFTER.json
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/CAPABILITY_GAP_BEFORE.json
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/CAPABILITY_INVENTORY_AFTER.json
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/CAPABILITY_INVENTORY_BEFORE.json
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/CAPABILITY_REQUIREMENTS.json
docs/steward-runs/2026-08-25-code-capability-fabric-portable-fsm-v2.19/EVIDENCE_ROUTE.md
registry/generated/city-authority-map.json
registry/generated/city-capabilities.jsonl
registry/generated/city-dependencies.json
registry/generated/city-graph.json
registry/generated/city-graph.receipt.json
registry/generated/city-modules.json
registry/generated/city-proof-map.json
registry/generated/city-schemas.json
registry/generated/city-twins.json
registry/generated/city-unresolved-edges.json
shared/capability-fabric/builder-registry.js
shared/capability-fabric/recipes/catalog.json
shared/capability-fabric/schemas/candidate-package.schema.json
shared/capability-fabric/schemas/capability-recipe.schema.json
shared/capability-fabric/selftest.js
shared/code-capability-fabric/README-code-specialist-build-profile-registry-v1.md
shared/code-capability-fabric/README-code-specialist-capability-builder-v1.md
shared/code-capability-fabric/README.md
shared/code-capability-fabric/code-specialist-build-profile-catalog-v1.json
shared/code-capability-fabric/code-specialist-capability-build-request.schema.json
shared/code-capability-fabric/code-specialist-capability-builder-v1.js
shared/code-capability-fabric/code-specialist-capability-candidate.schema.json
shared/code-capability-fabric/module-code-specialist-capability-builder-v1.contract.json
shared/code-capability-fabric/selftest-code-specialist-build-profile-registry-v1.js
shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js
tests/capability-fabric-bounded-record-query-proof.js
tests/capability-fabric-package-test.js
tests/capability-fabric-portable-fsm-proof.js
tools-index.json
tools/capability-fabric/README.md
tools/capability-fabric/manifest.json
tools/capability-fabric/module.contract.json
tools/capability-fabric/selftest.js
tools/capability-recipe-admission-gate/selftest.js
```

The append-only `STEWARD_RECEIPT.md`, `TEST_REPORT.md`, and this handoff are
closeout-only paths added after the technical commit.

## Safe drift check and review action

Run the following from a clean Workshop checkout. It fetches only the two named
remote refs, checks exact target identity and ancestry, proves that the remote
source contains the reviewed technical commit, and shows the technical delta.
It does not merge or modify tracked files.

```powershell
$expectedTarget = 'c0d57d4ea0403b5d0932e4abf177d207bc87791b'
$expectedTechnical = '0a3af63d2e8118a6a66bf1df88afd0c85cf0f0bf'
$targetRef = 'refs/remotes/origin/codex/code-capability-fabric-bounded-record-query-v2.18'
$sourceRef = 'refs/remotes/origin/codex/code-capability-fabric-portable-fsm-v2.19'

git fetch origin `
  codex/code-capability-fabric-bounded-record-query-v2.18:$targetRef `
  codex/code-capability-fabric-portable-fsm-v2.19:$sourceRef

if ((git rev-parse $targetRef) -ne $expectedTarget) {
  throw 'Target drifted; stop and re-review the stack.'
}
git merge-base --is-ancestor $expectedTarget $expectedTechnical
if ($LASTEXITCODE -ne 0) {
  throw 'Expected target is not an ancestor of the technical source.'
}
git merge-base --is-ancestor $expectedTechnical $sourceRef
if ($LASTEXITCODE -ne 0) {
  throw 'Remote source no longer contains the reviewed technical source.'
}

git diff --check $expectedTarget $expectedTechnical
git diff --stat $expectedTarget $expectedTechnical
git diff $expectedTarget $expectedTechnical
```

The preferred action is review PR69 and use GitHub's displayed immutable commit
identity for its sealed head. Only after Mike accepts PR68 and explicitly
chooses a clean integration target whose `HEAD` is exactly `$expectedTarget`
may that target be fast-forwarded to the reviewed PR69 head:

```powershell
$reviewedSealedTip = git rev-parse $sourceRef
if ((git rev-parse HEAD) -ne $expectedTarget) {
  throw 'Integration target drifted; stop and re-review.'
}
git merge-base --is-ancestor $expectedTechnical $reviewedSealedTip
if ($LASTEXITCODE -ne 0) {
  throw 'Reviewed source does not contain the tested technical commit.'
}
git merge --ff-only $reviewedSealedTip
```

These commands are recorded for Mike's later decision; this steward run did not
run the merge. Before any use, compare `$reviewedSealedTip` with the exact PR69
head reported at closeout. If the intended target or remote source differs, do
not improvise a merge or cherry-pick. Re-audit the new target and issue a new
handoff.
