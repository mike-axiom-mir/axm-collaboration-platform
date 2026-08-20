# Grounded Growth voluntary-choice frontier

Status: `TEST`

This permissionless leaf reconciles an exact current Grounded Growth state with
the exact current human-route coverage and catalog. It replaces stale
single-route guidance with a current neutral choice frontier while selecting
nothing.

Every ready route is available only after an explicit human request. Routes
have no priority, recommendation, or preselection; waiting and opting out remain
valid without penalty. Held routes remain visible but commandless until their
named external event occurs.

Native verification rebuilds the current state and route coverage from their
deep inputs and verifies the catalog digest, references, commands, portfolio,
and beneficiary counts. Detached verification checks integrity, count
coherence, neutral-selection rules, and authority boundaries while leaving
source truth/currentness `UNKNOWN`.

The leaf prompts nobody and performs no I/O, participation, execution, write,
network action, installation, permission grant, promotion, merge, `CANON`
decision, Foundation mutation, or model training.

Run:

```powershell
node shared/grounded-growth-voluntary-choice-frontier/selftest.js
```
