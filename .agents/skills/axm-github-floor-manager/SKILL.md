---
name: axm-github-floor-manager
description: Keep GitHub work navigable from branch start through PR, CI, review, merge decision, and cleanup. Use for repository changes, pull requests, CI failures, stacked branches, merge/hold decisions, temporary artifacts, or when a previous coding run appears stuck around GitHub state.
---

# AXM GitHub Floor Manager

Use this skill whenever work touches Git/GitHub lifecycle, not only when something is already broken.

## Core rule

A code change is not finished when it is pushed. It is finished only when the exact repository state, branch, PR state, CI state, review state, cleanup state, and next authority decision are known.

Do not invent GitHub state. Read it.

## 1. Orient before editing

Establish and keep visible:

- repository root / repository identity
- current branch and exact HEAD SHA
- intended base branch / base SHA
- whether the lane is stacked on another branch or PR
- working tree changes already present before this task
- existing PR for the branch, if any
- applicable AGENTS.md instructions
- current CI/review state if a PR already exists

Preserve unrelated user or agent work. Never reset, clean, checkout over, or rewrite unrelated changes merely to make the lane look tidy.

If any required identity is ambiguous, HOLD before writing.

## 2. Lane states

Every lane should have one explicit lifecycle intent:

- `MERGE` — ready to progress through verification toward the requested merge gate.
- `HOLD` — preserve exactly as a reviewable experiment or unfinished lane. Do not merge or delete it.
- `TEMP` — disposable scaffolding only. It must have an owner and cleanup condition.

Ambiguous intent defaults to `HOLD`.

`MERGE` is intent, not permission. Repository rules, tests, review requirements, and the human merge gate still apply.

## 3. Build without multiplying branches unnecessarily

Before creating a new branch or PR:

1. Search for an existing branch/PR that already owns the task.
2. Continue that lane when it is the correct owner.
3. Create a new lane only when isolation is materially useful.
4. When stacking is necessary, record the exact parent branch/PR and parent SHA.

Do not create a fresh branch merely because the current lane has a problem that can be repaired in place.

## 4. Temporary-file hygiene

Temporary artifacts should be clearly classifiable by path, manifest entry, or explicit lifecycle marker.

For `TEMP` artifacts record:

- owner lane
- purpose
- creation point
- cleanup condition
- whether anything still references them

Only remove automatically when the cleanup condition is mechanically provable. Ambiguous files are flagged, not deleted.

Never delete an untracked/unknown file solely because it looks temporary.

## 5. Pre-push gate

Before push:

- inspect the diff against the intended base
- confirm only intended files are included
- run repository-required tests/checks
- run focused tests for the changed area
- run `git diff --check` when available
- record anything not run and why
- confirm no secrets/private local state entered the diff

Do not convert warnings, unavailable tests, or browser checks into PASS.

## 6. Push is a checkpoint, not completion

After every push, continue the GitHub lifecycle:

1. Resolve or create the correct PR.
2. Verify PR head SHA matches the pushed SHA.
3. Read mergeability/state.
4. Read CI/check runs.
5. Read review comments/threads.
6. Classify failures as branch-caused, infrastructure/flaky, inherited/base, or unknown.
7. Repair branch-caused failures when within task scope.
8. Re-run only the smallest appropriate failed workflow/job when a retry is justified.
9. Re-check after the new push/retry.
10. Stop only at a truthful terminal or explicit HOLD state.

Never say "done" merely because commit/push succeeded.

## 7. CI repair discipline

When CI fails:

- inspect the failing workflow/job and actual log before changing code
- identify the first actionable failure, not merely the last red line
- distinguish a flaky/infrastructure failure from a deterministic branch failure
- do not weaken tests just to obtain green status
- do not silently broaden permissions or workflow authority
- preserve failing evidence in the report

If a retry is reasonable, retry a specific job or failed jobs rather than blindly restarting everything.

## 8. Review-thread discipline

For review feedback:

- read the complete relevant thread before editing
- classify each item: accepted fix, disagreement with reason, already resolved, out of scope, or blocked
- make the smallest source change that addresses accepted feedback
- re-test the affected path
- do not mark threads resolved until the underlying issue is actually addressed or explicitly rejected with rationale

## 9. Merge gate

Before any merge recommendation, report:

- repo
- PR
- base -> head
- exact head SHA
- mergeability
- required CI status
- unresolved review threads
- known warnings/holds
- whether the lane is stacked
- cleanup status
- requested lifecycle intent (`MERGE` or `HOLD`)

For AXM, passing tests does not create CANON. Mike remains the final merge/canon gate where repository instructions say so.

## 10. Stuck / disconnect recovery receipt

If the run cannot continue, leave an exact continuation packet instead of a vague apology:

```text
GITHUB CONTINUATION
repo:
branch:
head_sha:
base:
pr:
lifecycle: MERGE | HOLD | TEMP
last_verified_action:
ci_state:
review_state:
mergeability:
working_tree_state:
exact_blocker:
next_safe_action:
commands_or_tool_reads_needed_next:
```

A fresh instance should be able to resume from this packet without reconstructing the lane from chat history.

## 11. Final completion receipt

Every GitHub task ends with one of:

- `MERGED` — merge actually completed and resulting SHA is known.
- `READY_FOR_MERGE_GATE` — checks/reviews known; waiting for authorized merge decision.
- `HOLD` — deliberately preserved, with reason and resume point.
- `BLOCKED` — external/infrastructure/permission blocker, with exact evidence and next action.
- `ABANDONED` — explicitly requested abandonment; cleanup result recorded.

Never use `DONE` as a substitute for one of these states.
