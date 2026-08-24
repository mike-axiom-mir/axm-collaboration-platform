# Integration handoff — strict closed-object contract adapter v2.17

Status: `TEST` review packet; no integration performed.

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/67>

## Exact source and target assumptions

- Source branch:
  `codex/code-capability-fabric-closed-object-adapter-v2.17`
- Technical source commit:
  `ddc95e8d21b76d85133e310e8d362ac04d817cba`
- Technical parent / required stacked target:
  `72d74569ea569f229e8d768ac3a7a62a6ac92ee9`
- Target branch:
  `codex/code-capability-fabric-bounded-javascript-transform-v2.16`
- Target review: PR66
- At technical publication, the remote target and PR66 head both equalled the
  required stacked target exactly. PR66 was open, draft, and clean/mergeable.
- The canonical Workshop checkout was separately observed clean at
  `7dd800d09731607b2936b580ab972d8033801736` and was not switched,
  overwritten, merged, or modified by this run.

PR67 is intentionally stacked on PR66. Review or acceptance of PR67 must not
skip the still-separate decisions for its ancestors. The preferred integration
action is review in PR67 after confirming its displayed head equals the sealed
tip reported by the steward closeout.

## Exact technical changed paths

```text
docs/generated/LEGO_CITY_BEGINNER_MAP.md
docs/generated/LEGO_CITY_MAP.md
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/CAPABILITY_GAP_AFTER.json
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/CAPABILITY_GAP_BEFORE.json
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/CAPABILITY_INVENTORY_AFTER.json
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/CAPABILITY_INVENTORY_BEFORE.json
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/CAPABILITY_REQUIREMENTS.json
docs/steward-runs/2026-08-24-code-capability-fabric-closed-object-adapter-v2.17/EVIDENCE_ROUTE.md
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
shared/capability-fabric/README.md
shared/capability-fabric/builder-registry.js
shared/capability-fabric/recipes/catalog.json
shared/capability-fabric/schemas/candidate-package.schema.json
shared/capability-fabric/schemas/capability-recipe.schema.json
shared/capability-fabric/selftest.js
shared/code-capability-fabric/README-code-specialist-build-profile-registry-v1.md
shared/code-capability-fabric/README-code-specialist-capability-builder-v1.md
shared/code-capability-fabric/README.md
shared/code-capability-fabric/code-specialist-build-profile-catalog-v1.json
shared/code-capability-fabric/code-specialist-build-profile-registry-v1.js
shared/code-capability-fabric/code-specialist-capability-build-request.schema.json
shared/code-capability-fabric/code-specialist-capability-builder-v1.js
shared/code-capability-fabric/code-specialist-capability-candidate.schema.json
shared/code-capability-fabric/module-code-specialist-capability-builder-v1.contract.json
shared/code-capability-fabric/selftest-code-specialist-build-profile-registry-v1.js
shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js
tests/capability-composition-package-test.js
tests/capability-fabric-closed-object-adapter-proof.js
tests/capability-fabric-package-test.js
tests/capability-recipe-foundry-package-test.js
tools-index.json
tools/capability-fabric/README.md
tools/capability-fabric/manifest.json
tools/capability-fabric/module.contract.json
tools/capability-fabric/selftest.js
tools/capability-recipe-admission-gate/README.md
tools/capability-recipe-admission-gate/selftest.js
tools/capability-recipe-foundry/README.md
tools/capability-recipe-foundry/selftest.js
```

The append-only `STEWARD_RECEIPT.md`, `TEST_REPORT.md`, and this handoff are
closeout-only paths added after the technical commit.

## Safe drift check and review action

Run the following from a clean Workshop checkout. It fetches only the two named
remote refs, checks the exact target identity and ancestry, proves that the
remote source contains the reviewed technical commit, and shows the technical
delta. It does not merge or modify tracked files.

```powershell
$expectedTarget = '72d74569ea569f229e8d768ac3a7a62a6ac92ee9'
$expectedTechnical = 'ddc95e8d21b76d85133e310e8d362ac04d817cba'
$targetRef = 'refs/remotes/origin/codex/code-capability-fabric-bounded-javascript-transform-v2.16'
$sourceRef = 'refs/remotes/origin/codex/code-capability-fabric-closed-object-adapter-v2.17'

git fetch origin `
  codex/code-capability-fabric-bounded-javascript-transform-v2.16:$targetRef `
  codex/code-capability-fabric-closed-object-adapter-v2.17:$sourceRef

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

The preferred action is review in PR67 and use GitHub's displayed immutable
commit identity for its sealed head. Only after Mike accepts the preceding
stack and explicitly chooses an integration target may a clean branch whose
`HEAD` is exactly `$expectedTarget` be fast-forwarded to that reviewed sealed
tip:

```powershell
$expectedSealedTip = '<copy the exact reviewed PR67 head reported at closeout>'
if ((git rev-parse HEAD) -ne $expectedTarget) {
  throw 'Integration target drifted; stop and re-review.'
}
git merge-base --is-ancestor $expectedTechnical $expectedSealedTip
if ($LASTEXITCODE -ne 0) {
  throw 'Sealed tip does not contain the reviewed technical source.'
}
git merge --ff-only $expectedSealedTip
```

The exact sealed tip is reported outside this self-referential closeout commit.
These commands are recorded for Mike's later decision; this steward run did not
run them. If the intended target is no longer exact, do not improvise a merge or
cherry-pick. Re-audit the new target and issue a new handoff.
