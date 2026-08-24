# Integration handoff — bounded CSS token stylesheet v2.14

Status: `TEST` review packet; no integration performed.

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/64>

## Exact source and target assumptions

- Source branch: `codex/code-capability-fabric-bounded-css-stylesheet-v2.14`
- Technical source commit: `420bdc3dbcd159d6445b8cfea7c963ce729c5e38`
- Technical parent / required stacked target:
  `b9955f285ad7500a8693267bff64463b8e3248e7`
- Target branch: `codex/code-capability-fabric-evidence-bound-lessons-v2.13`
- Target review: PR 63
- At publication, remote target head and PR 63 head both equalled the required
  stacked target exactly.
- The canonical Workshop checkout was separately observed clean and was not
  switched, overwritten, merged, or otherwise modified by this run.

PR 64 is intentionally stacked on PR 63. Review or acceptance of PR 64 must not
skip the still-separate decisions for its ancestors.

## Changed paths

Native contracts and implementation:

```text
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
tests/capability-fabric-package-test.js
tools/capability-fabric/README.md
tools/capability-fabric/selftest.js
tools/capability-recipe-admission-gate/selftest.js
tools-index.json
```

Regenerated Workshop views:

```text
docs/generated/LEGO_CITY_BEGINNER_MAP.md
docs/generated/LEGO_CITY_MAP.md
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
```

Append-only run evidence is under this steward-run directory. The exact test and
warning record is in `TEST_REPORT.md`.

## Safe drift check and review action

Run the following from a clean Workshop checkout. It fetches named remote refs,
checks both immutable commit expectations, checks ancestry, and shows the exact
technical delta. It does not merge or modify tracked files.

```powershell
$expectedTarget = 'b9955f285ad7500a8693267bff64463b8e3248e7'
$expectedSource = '420bdc3dbcd159d6445b8cfea7c963ce729c5e38'
$targetRef = 'refs/remotes/origin/codex/code-capability-fabric-evidence-bound-lessons-v2.13'
$sourceRef = 'refs/remotes/origin/codex/code-capability-fabric-bounded-css-stylesheet-v2.14'

git fetch origin `
  codex/code-capability-fabric-evidence-bound-lessons-v2.13:$targetRef `
  codex/code-capability-fabric-bounded-css-stylesheet-v2.14:$sourceRef

if ((git rev-parse $targetRef) -ne $expectedTarget) {
  throw 'Target drifted; stop and re-review the stack.'
}
git merge-base --is-ancestor $expectedTarget $expectedSource
if ($LASTEXITCODE -ne 0) {
  throw 'Expected target is not an ancestor of the technical source.'
}
git merge-base --is-ancestor $expectedSource $sourceRef
if ($LASTEXITCODE -ne 0) {
  throw 'Remote source no longer contains the reviewed technical source.'
}

git diff --check $expectedTarget $expectedSource
git diff --stat $expectedTarget $expectedSource
git diff $expectedTarget $expectedSource
```

The preferred action is review in PR 64. Only after Mike accepts the preceding
stack and explicitly chooses an integration target may a clean branch whose
`HEAD` is exactly `$expectedTarget` be fast-forwarded to the technical source:

```powershell
if ((git rev-parse HEAD) -ne $expectedTarget) {
  throw 'Integration target drifted; stop and re-review.'
}
git merge --ff-only $expectedSource
```

That command is recorded for Mike's later decision; this steward run did not run
it. If the intended target is no longer exact, do not improvise a merge or
cherry-pick. Re-audit the new target and issue a new handoff.
