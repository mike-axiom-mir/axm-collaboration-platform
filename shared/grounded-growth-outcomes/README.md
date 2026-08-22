# AXM Grounded Growth Outcomes

Status: `TEST`

This adapter closes the truth gap between a capability becoming available and
an outcome actually helping someone.

```text
verified capability cycle
  -> claim-specific proof route
  -> human outcome / AI-workflow outcome / shared-system effect
  -> evidence closure
  -> digest-bound outcome receipt
  -> ancestry-checked longitudinal portfolio
```

It deliberately keeps three claims separate:

- a shared-system effect is deterministic behavior, not proof that a person
  benefited;
- a human benefit requires human-native observation, review or a representative
  user journey;
- an AI-workflow benefit requires a held-out or representative AI-workflow
  evaluation. It is not a model-weight-training claim.

The adapter validates and links supplied receipts. It does not perform a human
study, run an AI benchmark, inspect visual output, install a capability, grant a
permission, promote a module, change CANON or mutate Foundation. A claimed
`PASS` with the wrong proof surface, missing baseline/outcome references, or a
non-current evidence closure becomes `EVIDENCE_HOLD`.

Outcome states are:

`NO_NEW_INFORMATION` · `EVIDENCE_HOLD` · `REGRESSION_HOLD` ·
`REFRESH_REQUIRED` · `CYCLE_HOLD` · `CANDIDATE_ONLY` ·
`AVAILABLE_EFFECT_UNKNOWN` · `SYSTEM_EFFECT_ONLY` · `HUMAN_GROWTH_ONLY` ·
`AI_WORKFLOW_GROWTH_ONLY` · `GROUNDED_SHARED_GROWTH`

The portfolio is a derived view over exact receipts. For each capability, every
later outcome must name the preceding outcome ID and digest. This prevents an
updated summary from silently skipping a held or failed generation. A
`NO_NEW_INFORMATION` receipt records the latest check but carries the last
substantive outcome forward as the effective state; it is refused when the
capability-cycle digest changed or refresh is due.

Cloning, canonical comparison, and object digests reuse the strict
`deterministic-json-core`. JSON-safe historical receipts keep the same bytes;
undefined and other non-JSON-representable state is rejected before it can be
silently dropped or bound into an invalid digest.

Run:

```powershell
node shared/grounded-growth-outcomes/selftest.js
```
