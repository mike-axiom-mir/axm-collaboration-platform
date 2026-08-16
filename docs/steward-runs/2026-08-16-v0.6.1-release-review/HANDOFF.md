# v0.6.1 release review handoff

Status: **TEST**  
Administration decision: **HOLD**  
Reviewed source: PR #36 head `cb77104a923ea6b4e682468430a117a6dff3a984`  
Corrective branch: `codex/v0.6.1-release-hardening-review-fix-v0.1`

This branch is review material. It is not CANON, it has not been pushed, and it has not changed GitHub repository settings or release state.

## Why this lane exists

The PR #36 release-administration proposal could not safely be applied as written:

1. It required two status-check contexts that the workflows do not emit.
2. It passed `is_template=false` as a string instead of a typed Boolean.
3. It required CODEOWNER approval while every current CODEOWNERS rule names only the repository owner. The author cannot independently approve their own pull request.
4. The workflow gave write permissions and persisted checkout credentials more broadly than the jobs required.
5. An administration attempt could report success without re-reading every requested live setting.

## Bounded corrections

- Repository safety now names the four exact emitted check contexts.
- Review ownership is explicitly `HOLD`; no reviewer or authority was invented.
- Repository mutation is refused until an independently authorized CODEOWNER is declared, covers every protected rule, differs from the repository owner, and has verified write-level access.
- The template mutation uses the typed `-F is_template=false` field.
- Job permissions are scoped, and all release-workflow checkouts set `persist-credentials: false`.
- A successful administration receipt requires a live API re-read of template state, branch protection, required checks, review rules, and the active `v*` tag ruleset.
- The focused hardening selftest now guards these contracts.

## Human decision still required

Before repository protection can move from HOLD to READY, Mike must explicitly choose one of these policies:

- authorize an independent reviewer, add that login to every protected CODEOWNERS rule, and set the reviewed safety request to READY; or
- explicitly decide not to require CODEOWNER review and revise the requested protection policy and verifier consistently.

Do not infer that Elektro8 or any other account has review authority from collaborator presence alone.

## Evidence run on 2026-08-16

All ten repository-required commands returned exit 0:

- `node verify.js`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js`
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js`
- `node tools/evidence-desk/selftest.js`

`node verify.js` remained `VERIFIED_WITH_LIMITS`: 0 failures and 43 known/open warnings, including a stale `tools-index.json` warning. Passing required checks does not erase that warning backlog.

PR-specific source evidence:

- PASS: `node tests/v0.6.1-hardening-selftest.js` — 27 checks
- PASS: Game Production Runner — 133 checks
- PASS: Hardware Research Registry — 15 checks
- PASS: Compute Substrate Lab — 16 checks
- PASS: Deterministic PR Publisher — 76 checks
- PASS: RepairBuddy — 77 checks
- PASS: `npm run discovery:verify`
- PASS: `npm run test:public-surface`
- FAIL on this Windows checkout: `npm test`

The aggregate failure is `archive-intake-cartographer: review-digest-mismatch`, observed as `HELD` where the selftest expects `READY`. The reviewed execution digest hashes raw working-tree bytes. Git reports the relevant files as `i/lf w/crlf` with `core.autocrlf=true`, while the recorded digest matches the LF execution surface used by Ubuntu CI. This is an unresolved Windows parity defect in the reviewed-digest test, not a change made by this branch. Test-generated tracked output was restored to its pre-test state.

Additional syntax evidence:

- PASS: `node --check tests/v0.6.1-hardening-selftest.js`
- PASS: `git diff --check` (with Windows line-ending conversion warnings)
- PASS: `bash -n` for both edited workflow shell blocks
- NOT RUN: `actionlint` or equivalent full GitHub Actions YAML validation; no validator was available locally
- NOT RUN: the GitHub workflow itself; this branch has not been pushed
- NOT RUN: browser render/click testing; the correction has no browser surface

## Live GitHub state observed read-only

- PR #36 was draft, cleanly mergeable, and had four passing checks but no review.
- The repository was still a template.
- `main` had no branch protection.
- No repository ruleset existed.

These observations are not permission to mutate that state.

## Remaining release risks outside this correction

- Publication is not atomic: a failure after creating the public prerelease can leave partial public state, while a rerun refuses an existing release.
- The receiver verifies asset names and nonzero sizes but does not download the published assets and compare their remote hashes with the local package receipt.
- The local Windows aggregate-test parity defect above remains open.

Review these separately before calling the release path WORKING. Only Mike's explicit merge decision can canonize any part of this material.
