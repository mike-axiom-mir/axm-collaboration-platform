# Source Control & Merge Workbench

This module lets the local computer perform the routine Git work for a public-safe AXM update without spending reasoning compute on copying, hashing, committing, or pushing files. The trigger is manual. A push is valid only for the exact dry-plan digest Mike reviewed.

It is deliberately separate from pull-request creation, review, merge, release, promotion, and CANON decisions.

## Current manual flow

1. AXM inventories the live Workshop with the Workshop Packager public-path policy.
2. It scans shareable text for sensitive patterns and hashes every included file.
3. It compares those bytes with a separate clean Git working copy on an `automation/...` branch.
4. The dry plan seals the source digest, repository HEAD, remote URL, branch, exact additions/updates, and advisory removals into one `planDigest`.
5. The Hub renders a bounded summary instead of injecting thousands of file records into the page. Mike can export the complete exact JSON plan for deeper review.
6. Mike verifies that exact digest and types `PUSH REVIEWED PUBLIC SNAPSHOT`.
7. Machine Host runs the fixed runner as a bounded background job, keeping the Hub responsive while preserving the exact job log.
8. The runner rebuilds the plan under a lock and refuses any digest, source, repository, branch, or remote drift.
9. It copies and stages only the reviewed additions/updates, commits with the plan and source digests, and pushes only the dedicated automation branch.
10. It writes a receipt and `state/github-sync/latest-pr-candidate.json`. Opening a draft PR remains a separate deliberate action.

A successful commit changes Git HEAD, so the same plan digest cannot be used for a second write. If there are no changes, the method records `NO_CHANGES` and does not push.

If the remote push fails after the local commit is created, the runner attempts to restore the exact clean pre-commit HEAD and working-copy bytes. The receipt distinguishes `PUSH_FAILED_ROLLED_BACK` from the exceptional `COMMITTED_NOT_PUSHED` state so recovery is never hidden.

## One-time local setup

1. Prepare a separate Git working copy outside `C:\axm workshop`. The module will not clone or initialize it.
2. Check out a dedicated branch such as `automation/workshop-sync`.
3. Keep its `origin` URL credential-free, for example `https://github.com/owner/repository.git`. Authentication remains in Git Credential Manager, SSH, or the existing Git installation.
4. Open **Deterministic GitHub push** in this module, enter that exact working-copy path, author identity, remote, and branch.
5. Enable planning and type `CONFIGURE MACHINE GITHUB SYNC`.
6. Build and inspect a dry plan before using the manual push control.

Unattended push is unavailable in this version. Configuration always stores `pushEnabled: false`.

## Computer commands

```powershell
npm.cmd run sync:github:dry
npm.cmd run sync:github:verify -- --plan-digest <reviewed-digest>
npm.cmd run sync:github:run -- --plan-digest <reviewed-digest> --confirmation "PUSH REVIEWED PUBLIC SNAPSHOT" --actor Mike
```

The browser screen performs the same fixed operations. The command-line confirmation is not a credential.

## Future Heartbeat seam

`future-heartbeat-verifier.json` is parked and off. It allows only `verifyPlan(planDigest)`, a deterministic read-only operation. It explicitly cannot copy files, commit, push, create a PR, merge, promote, or grant CANON. Wiring it into Heartbeat requires a separate Mike + Codex review.

## Refusals

- the live Workshop as the Git working copy;
- dirty or detached Git state;
- branches outside `automation/`;
- changed remotes after configuration;
- credential-bearing remote URLs or credential storage;
- public-safety findings or files over GitHub's 100 MB per-file limit;
- reviewed-plan, source, repository HEAD, branch, or remote drift;
- tracked-file deletion;
- unattended push or Heartbeat push authority;
- direct main push, automatic PR creation, merge, promotion, or CANON.

## Evidence

```powershell
node tools/source-control-merge-workbench/selftest.js
```

The selftest uses only a temporary local bare Git remote. It does not contact or push GitHub.
