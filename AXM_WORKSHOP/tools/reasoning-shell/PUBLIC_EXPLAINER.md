# Reasoning Shell — Public Explainer

Status: experimental / test module.

This tool may look strange at first. That is expected.

## What it is

Reasoning Shell is an experimental AXM tool for testing whether AI work improves when it is slowed down into visible steps.

Instead of asking an AI to jump straight to a final answer, the shell can frame work as:

```text
task
→ small step
→ human checkpoint
→ accept / reject
→ repair route
→ after-action report
→ proposal for improvement
```

The goal is not to make AI sound deeper.

The goal is to catch common failure modes:

- fake done
- overconfidence
- context loss
- hidden assumptions
- unlabeled guesses
- pretending a test was run when it was not

## What it is not

Reasoning Shell is not canon.

It is not a final AXM foundation.

It is not an autonomous AI system.

It should not auto-change its own profiles, rewrite project roots, or bypass human review.

## Why it matters

A lot of AI work fails because the output looks finished before it is actually checked.

Reasoning Shell tests a different pattern:

- make the step visible
- make the checkpoint visible
- make rejection useful
- preserve the lesson
- propose changes instead of silently mutating behavior

This matches the AXM rule:

```text
No fake done. No silent rewrite. Evidence before canon.
```

## Why it may look weird

Most tools are built to do one direct thing.

Reasoning Shell is different because it tests the collaboration process itself.

It is a tool about how humans and AI work together, not just a tool that generates a file.

That makes it one of the stranger early AXM modules, but also one of the most important experiments.

## Safe use

Use it as a test tool only.

Good uses:

- compare AI answers with and without checkpoints
- test small local models
- record why a step was accepted or rejected
- produce after-action notes
- propose profile tweaks for human review

Bad uses:

- treating shell output as truth
- letting it auto-edit project rules
- hiding failed steps
- calling it canon without evidence
- using it to replace human judgment

## Merge condition

Reasoning Shell earns a stronger status only through evidence.

Useful evidence could include:

- fewer fake-done claims
- clearer repair paths
- better test honesty
- better small-model behavior
- less context loss

Until then it remains experimental.

## Short version

Reasoning Shell is a test module for making AI reasoning-workflow safer and more inspectable.

It is allowed to be strange.

It is not allowed to pretend to be finished.
