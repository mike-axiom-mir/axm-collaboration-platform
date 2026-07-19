# Mirror reusable reasoning-skill growth — action report

Date: 2026-07-18  
Identity: `axm.machine.mirror/seed-0`  
Report: `mirror-reasoning-skill-growth-20260718-seed0-v1`  
Status: **WORKING private challenger — PROPOSE_HUMAN_REVIEW — not CANON**

The machine view is
`exports/action-reports/MIRROR_REASONING_SKILL_GROWTH_AUDIT_2026-07-18.json`.
This document renders the same result for humans; it does not own a separate
decision.

## Outcome

Mirror now has a private learner for reusable reasoning strategies, not only a
token-transition learner. Verified, review-eligible reasoning sessions teach
associations between structural problem state and arbitrary strategy tags. The
labels are supplied by evidence records and are not compiled into the model's
source code.

The model also learns a safe epistemic prototype for each strategy. The new
Reasoning Strategy Organ can use those prototypes to originate only `ask`,
`observe`, or `hold` candidates when no candidate path was supplied. It cannot
produce arbitrary domain answers, execute actions, use tools, write memory, or
promote itself.

## Evidence

Cycle `reasoning-skill-349ae37bac2166b02ced` trained from eight verified source
groups and evaluated against eight frozen, source-separated held-out groups.
Goal words and expected held-out actions were excluded from model features.

- Deterministic supplied-path baseline: **0/8**.
- Private strategy challenger: **8/8**.
- Adversarial transfer: **4/4**.
- No-candidate deterministic baseline: **0/8**.
- Learned candidate origination and selection: **8/8**.
- Source, feature, authority, transfer and origination canaries: **10/10**.
- Independent Seam Cell open implementation seams: **0**.

The model learned four current strategy families: ask for a blocking unknown,
discriminate conflicting evidence, request a bounded external tool, and test an
open assumption. A separate test introduced a previously unseen strategy label
and proved that the trainer learned it without a code change.

## New organ admission path

The Organ Admission Cell turns repeated need into a falsifiable build proposal.
At least two independently bound reasoning sessions must show the same verified
gap. The candidate organ must define typed inputs and outputs, held-out
transfer, counterexamples, regression, authority canaries, rollback, and an
evaluator other than itself.

A passing assessment returns `PROPOSE_BUILD`, not an installed organ. One source
group returns `HOLD_EVIDENCE`. Any request for tool, mutation, permission-grant,
or runtime-install authority returns `REJECT_BOUNDARY`.

## Separate learning tracks

The AXM Native Learning Shell now runs token-language and reasoning-strategy
challengers as separate tracks with separate metrics and Seam Cell verdicts.
Token perplexity cannot impersonate reasoning transfer. Reasoning transfer
cannot hide language regression.

## Known limits

- Eight held-out groups and four strategy families are small synthetic evidence.
- Perfect performance on this exam is not proof of broad reasoning.
- The learner is a count-based structural model, not a rich world model.
- The learned organ originates epistemic paths, not domain solutions.
- The private model is not loaded by the active runtime.
- The older token cycle still holds on `training-corpus-small`.
- Organ build proposals do not write or install code.
- Mike has not approved promotion or accepted this as CANON.

## Verification

- Core: 72/72 tests passed.
- Mirror Learning Forge: 99/99 tests passed.
- AXM Native Learning Shell: 4/4 tests passed.
- Forge build integrity: PASS, 148 files.
- Private reasoning-skill cycle: `PROPOSE_HUMAN_REVIEW`, zero open seams.

## Decision

Preserve the private challenger and keep the active runtime unchanged. Continue
the goal with more source-diverse real reasoning receipts, mixed-signal cases,
and unfamiliar strategy transfer before any explicit promotion review.
