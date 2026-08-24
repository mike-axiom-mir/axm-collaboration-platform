# Integration handoff — bounded JavaScript string-record transform v2.16

Status: `TEST` review packet; no integration performed.

Draft review: <https://github.com/mike-axiom-mir/axm-collaboration-platform/pull/66>

## Exact source and target assumptions

- Source branch:
  `codex/code-capability-fabric-bounded-javascript-transform-v2.16`
- Technical source commit:
  `6287aadea5a2ab2a3f9af6d19adcfc96dd6544ad`
- Technical parent / required stacked target:
  `934be41cb21af5cdb561366e04050e727b691fb1`
- Target branch: `codex/code-capability-fabric-svg-status-badge-v2.15`
- Target review: PR65
- At technical publication, the remote target and PR65 head both equalled the
  required stacked target exactly. PR65 was open, draft, and mergeable.
- The canonical Workshop checkout was separately observed clean at
  `7dd800d09731607b2936b580ab972d8033801736` and was not switched,
  overwritten, merged, or modified by this run.

PR66 is intentionally stacked on PR65. Review or acceptance of PR66 must not
skip the still-separate decisions for its ancestors. The preferred integration
action is review in PR66 after confirming its displayed head equals the sealed
tip reported by the steward closeout.

## Technical changed paths

Native contracts, implementation, and documentation:

```text
shared/capability-fabric/README.md
shared/capability-fabric/builder-registry.js
shared/capability-fabric/composition-core.js
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

Append-only requirements, before/after capability inventories and gap evidence,
evidence route, test report, receipt, and this handoff live under this
steward-run directory.

## Safe drift check and review action

Run the following from a clean Workshop checkout. It fetches only the two named
remote refs, checks exact target identity and ancestry, proves that the remote
source still contains the reviewed technical commit, and shows the technical
delta. It does not merge or modify tracked files.

```powershell
$expectedTarget = '934be41cb21af5cdb561366e04050e727b691fb1'
$expectedTechnical = '6287aadea5a2ab2a3f9af6d19adcfc96dd6544ad'
$targetRef = 'refs/remotes/origin/codex/code-capability-fabric-svg-status-badge-v2.15'
$sourceRef = 'refs/remotes/origin/codex/code-capability-fabric-bounded-javascript-transform-v2.16'

git fetch origin `
  codex/code-capability-fabric-svg-status-badge-v2.15:$targetRef `
  codex/code-capability-fabric-bounded-javascript-transform-v2.16:$sourceRef

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

The preferred action is review in PR66 and use GitHub's displayed, immutable
commit identity for the sealed PR head. Only after Mike accepts the preceding
stack and explicitly chooses an integration target may a clean branch whose
`HEAD` is exactly `$expectedTarget` be fast-forwarded to that reviewed sealed
tip:

```powershell
$expectedSealedTip = '<copy the exact reviewed PR66 head commit>'
if ((git rev-parse HEAD) -ne $expectedTarget) {
  throw 'Integration target drifted; stop and re-review.'
}
git merge-base --is-ancestor $expectedTechnical $expectedSealedTip
if ($LASTEXITCODE -ne 0) {
  throw 'Sealed tip does not contain the reviewed technical source.'
}
git merge --ff-only $expectedSealedTip
```

The exact sealed tip is also reported in the steward closeout outside this
self-referential commit. These commands are recorded for Mike's later decision;
this steward run did not run them. If the intended target is no longer exact,
do not improvise a merge or cherry-pick. Re-audit the new target and issue a
new handoff.
