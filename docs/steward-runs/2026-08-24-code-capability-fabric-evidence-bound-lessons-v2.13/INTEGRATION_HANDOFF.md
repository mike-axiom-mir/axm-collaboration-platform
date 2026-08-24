# Integration handoff

Status: `TEST`

## Exact stacked source and target assumption

- Review action: GitHub draft PR 63
- Source branch: `codex/code-capability-fabric-evidence-bound-lessons-v2.13`
- Exact technical source commit:
  `8190df1e31914718a5f46ab69983a0dc72175035`
- Required direct parent / PR 62 head:
  `386736aaae3993089dfaf970cf2360894959e3c0`
- PR 62 branch: `codex/code-creation-fabric-102-grammar-integration-v2.12`
- PR 62 base branch: `codex/code-work-context-dock-v1`
- Expected PR 62 base commit:
  `370af1c9a506807610c18561a711650a6cbfb8d6`

The technical source is a direct descendant of the exact PR 62 head. PR 63 is
therefore a stacked review, not a patch for an arbitrary Workshop checkout.
Review and decide PR 62 first. If either named remote ref drifts, repeat the
integration diff and all verification rather than reusing this receipt.

## Changed paths relative to PR 62

- Fourteen authored Fabric paths: implementation, selftest, module contract,
  two READMEs, and nine closed schema files under
  `shared/code-capability-fabric/`.
- Twelve official generated City/schema/twin views under `docs/generated/` and
  `registry/generated/`.
- This evidence-only steward-run directory follows the technical source.

## Safe review route

The exact safe action is to review draft PR 63 after PR 62. A reviewer can
recheck the remote assumptions without changing any checkout:

```powershell
$expectedParent = "386736aaae3993089dfaf970cf2360894959e3c0"
$expectedSource = "8190df1e31914718a5f46ab69983a0dc72175035"

git fetch origin codex/code-creation-fabric-102-grammar-integration-v2.12 codex/code-capability-fabric-evidence-bound-lessons-v2.13
$observedParent = git rev-parse refs/remotes/origin/codex/code-creation-fabric-102-grammar-integration-v2.12
$observedSource = git rev-parse refs/remotes/origin/codex/code-capability-fabric-evidence-bound-lessons-v2.13
if ($observedParent -ne $expectedParent) { throw "PR 62 target drifted; repeat integration review." }
git merge-base --is-ancestor $expectedSource $observedSource
if ($LASTEXITCODE -ne 0) { throw "PR 63 technical source is not the expected lineage." }
git merge-base --is-ancestor $expectedParent $expectedSource
if ($LASTEXITCODE -ne 0) { throw "Technical source is not a descendant of the expected PR 62 head." }
git diff --stat $expectedParent..$expectedSource
```

The branch may contain later evidence-only descendants of the technical source;
review those receipt files separately. Do not silently merge, overwrite a busy
canonical checkout, install, promote, or change CANON. After the technical diff
and evidence are accepted, Mike chooses the actual integration route and reruns
the focused Fabric suites plus all ten required checks on the then-current
target.

## Remaining decisions

- Reuse rights remain held by default; a byte-bound authority reference is not
  independent issuer verification.
- Authenticated Tier-3 lesson admission remains absent.
- A repaired general disposable executor remains unauthorized and unbuilt by
  this rung.
- PR 63 is `TEST`, not CANON. Mike remains final merge gate.
