# Model Shadow review challenge transition declared disclosure

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows v0.9 pairwise
reconciliation. A caller declares two to sixty-four member labels and commits
each label to one exact v0.9 presentation digest. The assessment then:

- exact-rebuilds the caller-declared roster;
- exact-rebuilds every submitted presentation and its upstream packages;
- identifies declared members with no submission;
- identifies valid submissions that do not match the declared digest;
- reconciles every pair whose submissions match their commitments; and
- holds incomplete commitment coverage or any co-presented contradiction.

```text
caller-declared member labels + exact presentation commitments
  + zero or one exact submission package per declared label
  -> missing, mismatched, contradictory, or pairwise-compatible declared set
  -> no state write, adoption, execution, promotion, merge, or CANON authority
```

Completion is deliberately relative to the supplied roster. The roster is data,
not an authenticated root registry. A caller can omit an existing root from the
roster, one real controller can supply multiple labels, and a declared member
cannot be forced to disclose. The self-test retains an independently valid but
unlisted presentation and proves its reference is absent from a complete
declared-set receipt.

Receipts contain bounded references and classifications, not raw public keys,
signatures, private keys, raw model output, private context, or transient v0.9
packages. They prove no global log consistency, external retention, protected
monotonic state, rollback resistance, trusted time, human participation,
provider execution, evaluation, benefit, or learning.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-declared-disclosure/selftest.js
```
