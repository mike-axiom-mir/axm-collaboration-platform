# Drift-aware handoff

Status: `TEST` · review only · no merge performed

## Source and target assumptions

- Source branch: `codex/code-capability-fabric-semantic-generator-v2.4`
- Bounded implementation commit: `94da36a7654cc1848a32896e56a07869a49fdf0c`
- Source base: `d98c4d25dd85553f131814a4a487c1272ba94ed5`
- Expected target branch: `codex/workshop-recovery-fabric-integration-20260822`
- Target `HEAD` at the final pre-receipt drift check: `d98c4d25dd85553f131814a4a487c1272ba94ed5`
- Target state at that check: busy with unrelated tracked and untracked work

The target commit has not drifted from the source base, but its checkout is not
clean. That is an integration hold. Do not merge into, clean, reset, or overwrite
that checkout as part of this run.

## Changed code paths

- `shared/code-capability-fabric/README.md`
- `shared/code-capability-fabric/README-semantic-candidate-generator-v1.md`
- `shared/code-capability-fabric/semantic-candidate-generator-v1.js`
- `shared/code-capability-fabric/selftest-semantic-candidate-generator-v1.js`
- `shared/code-capability-fabric/module-semantic-candidate-generator-v1.contract.json`
- `shared/code-capability-fabric/semantic-common.schema.json`
- `shared/code-capability-fabric/semantic-generation-request.schema.json`
- `shared/code-capability-fabric/semantic-candidate-packet.schema.json`
- `shared/code-capability-fabric/candidate-alternative-comparison.schema.json`
- `shared/code-capability-fabric/creation-review-card.schema.json`
- `shared/code-capability-fabric/semantic-candidate-test-plan.schema.json`
- `shared/code-capability-fabric/semantic-candidate-generator-profile.schema.json`
- `shared/code-capability-fabric/native-recipe-library.schema.json`
- `shared/code-capability-fabric/semantic-generation-capability-gap.schema.json`

This receipt directory is the only additional changed path group.

## Safe review action now

Run the following from the selected canonical Workshop checkout. It is read-only
and does not disturb that checkout:

```powershell
git diff --stat d98c4d25dd85553f131814a4a487c1272ba94ed5..codex/code-capability-fabric-semantic-generator-v2.4
git diff d98c4d25dd85553f131814a4a487c1272ba94ed5..codex/code-capability-fabric-semantic-generator-v2.4 -- shared/code-capability-fabric docs/steward-runs/2026-08-22-code-capability-fabric-semantic-generator-v2.4
```

## Conditional Mike-controlled integration

Immediately before any integration, re-run:

```powershell
git branch --show-current
git rev-parse HEAD
git status --short
```

Proceed only if Mike selects the target, its branch and `HEAD` match the reviewed
assumptions (or a new clean base has been explicitly reviewed), and the status is
clean. After that decision, the bounded no-auto-commit integration action is:

```powershell
git merge --no-ff --no-commit codex/code-capability-fabric-semantic-generator-v2.4
```

Review the staged merge, rerun every `AGENTS.md` check, and let Mike decide
whether to commit. This steward run does not execute that command.
