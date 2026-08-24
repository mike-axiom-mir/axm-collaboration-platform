# Integration handoff — strict SVG status badge specialist v2.15

Status: `TEST` review packet; no integration performed.

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/65>

## Exact source and target assumptions

- Source branch: `codex/code-capability-fabric-svg-status-badge-v2.15`
- Technical source commit: `52de17f30cbf429c926af48b4604dd2a0102e52e`
- Technical parent / required stacked target:
  `211fa5e0b1e8f3d54b5e772e8c9c049162fc3cab`
- Target branch: `codex/code-capability-fabric-bounded-css-stylesheet-v2.14`
- Target review: PR64
- At technical publication, the remote target and PR64 head both equalled the
  required stacked target exactly, and PR64 reported `CLEAN`.
- The canonical Workshop checkout was separately observed clean and was not
  switched, overwritten, merged, or modified by this run.

PR65 is intentionally stacked on PR64. Review or acceptance of PR65 must not
skip the still-separate decisions for its ancestors.

## Technical changed paths

Native contracts and implementation:

```text
shared/capability-fabric/README.md
shared/capability-fabric/builder-registry.js
shared/capability-fabric/recipes/catalog.json
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
tests/capability-fabric-svg-proof.js
tests/fixtures/capability-fabric-svg-proof.html
tools/capability-fabric/README.md
```

Regenerated official Workshop views:

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

Append-only requirements, before/after capability-gap evidence, test report,
receipt, and this handoff live under this steward-run directory.

## Safe drift check and review action

Run the following from a clean Workshop checkout. It fetches only the two named
remote refs, checks exact target identity and ancestry, and shows the reviewed
technical delta. It does not merge or modify tracked files.

```powershell
$expectedTarget = '211fa5e0b1e8f3d54b5e772e8c9c049162fc3cab'
$expectedSource = '52de17f30cbf429c926af48b4604dd2a0102e52e'
$targetRef = 'refs/remotes/origin/codex/code-capability-fabric-bounded-css-stylesheet-v2.14'
$sourceRef = 'refs/remotes/origin/codex/code-capability-fabric-svg-status-badge-v2.15'

git fetch origin `
  codex/code-capability-fabric-bounded-css-stylesheet-v2.14:$targetRef `
  codex/code-capability-fabric-svg-status-badge-v2.15:$sourceRef

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

The preferred action is review in PR65. Only after Mike accepts the preceding
stack and explicitly chooses an integration target may a clean branch whose
`HEAD` is exactly `$expectedTarget` be fast-forwarded to the technical source:

```powershell
if ((git rev-parse HEAD) -ne $expectedTarget) {
  throw 'Integration target drifted; stop and re-review.'
}
git merge --ff-only $expectedSource
```

That command is recorded for Mike's later decision; this steward run did not
run it. If the intended target is no longer exact, do not improvise a merge or
cherry-pick. Re-audit the new target and issue a new handoff.
