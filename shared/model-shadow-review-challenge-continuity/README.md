# Model Shadow review challenge continuity

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows the Model Shadow review
challenge ledger. It creates a privacy-bounded snapshot of the exact ledger and
can compare later state with a caller-retained checkpoint.

```text
validated ledger state -> self-digested checkpoint retained by caller
later ledger state + presented checkpoint -> exact / extends / hold
```

The comparison detects missing or replaced challenge entries, ledger identity
drift, invalid state, or whole-namespace absence relative to the checkpoint the
caller presents. Fresh-process tests exercise these states.

This is detection, not prevention. The module does not store the checkpoint,
prove that it was retained outside the ledger, authenticate its authority, or
authenticate who ran the snapshot observer. Caller timestamps are not trusted
time. The module does not protect either artifact from deletion or rollback. A
caller able to alter or withhold both the ledger and checkpoint can defeat the comparison. Global
single-use, host authorization, pre-checkpoint history, real human review,
provider execution, benefit, learning, promotion, merge, Foundation mutation,
and `CANON` remain unproven or unauthorized.

Run:

```powershell
node shared/model-shadow-review-challenge-continuity/selftest.js
```
