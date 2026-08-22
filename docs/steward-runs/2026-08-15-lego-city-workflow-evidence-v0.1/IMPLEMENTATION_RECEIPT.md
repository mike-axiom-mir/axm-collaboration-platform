# LEGO City Workflow Transit and Evidence Grid v0.1 receipt

Status: **EXPERIMENTAL — WORKING IN FOCUSED TESTS**

- City graph: `81d0602ccd49bbcc16abee4d00f0202efc49f46beedef3736af80726d6f909be`.
- Schema registry: `04136437a662b6b9648cec11e9788f557a849ee597e2b14725f509c5916325dd`.
- Workflow Transit assertions: 16 passed.
- Evidence Grid assertions: 13 passed.

Proven here: identical locked routes reproduce the plan digest; duplicate,
missing, and cyclic steps fail; profiles cannot add steps or raise attempt
budgets; unverified success enters HOLD; retry cannot exceed the locked budget;
and checkpoint drift fails. Evidence receipts fail on field drift, go stale on
source or time drift, retain conflicting PASS/FAIL evidence, preserve UNKNOWN,
and bind warning baselines to source plus verifier version.

Workflow Transit does not execute. Evidence Grid does not authenticate a
verifier, prove a claim merely from a digest, persist receipts, renew a baseline,
or grant authority. No promotion, merge, or CANON claim is made.
