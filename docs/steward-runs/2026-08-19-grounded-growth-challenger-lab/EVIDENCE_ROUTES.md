# Evidence routes — Grounded Growth Challenger Lab

Status: `TEST`

| Claim | Kind / risk | Pass condition | Native evidence | Counterevidence |
|---|---|---|---|---|
| Plan binds a real direction | deterministic / high | Direction handoff verifies; selected direction digest and need digest match | native direction verifier + challenger plan rebuild | wait, unknown, changed, accepted or started direction accepted |
| Challenger is isolated | authorization / high | Shadow receipt hash, before/after digests, shadow-state digest and no-canonical-mutation flags all match | recomputed Shadow receipt | original changes or receipt claims canonical mutation |
| Evaluation is observation-only | authorization / high | Every Diagnostic receipt is hash-valid, shadow-only, fixture-unchanged and bound to case + artifact | recomputed paired receipts | mutation, wrong subject, wrong case or altered digest |
| Improvement is held out | learning improvement / high | At least one held-out AI case improves and held-out regressions do not fail | case manifest + paired results | no held-out AI gain, regression, unknown result or design-visible-only win |
| Test win is not adoption | authorization / high | strongest disposition remains review candidate with `NOT_AUTHORIZED` | evaluation receipt + tamper test | install, acceptance, merge, CANON or Foundation change |
| AI gain is not human benefit | quality / high | human and shared-growth claims remain false | evaluation truth boundary | AI-workflow pass silently becomes human benefit |
| Current work remains held | mixed / high | exact current four directions are waits and no plan/evaluation exists | current direction receipt + current challenger readiness | a wait direction starts a plan or participation pressure |

The broader goal of useful improvement remains open. This organ proves only a
bounded challenger-comparison contract, not general learning or real human
benefit.

