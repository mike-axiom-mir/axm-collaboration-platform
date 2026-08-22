# Model Shadow local possession continuity reference

Status: `TEST`

This uninstalled and unpromoted v1.4 read-only adapter follows the v1.3 local
possession challenge. It first closes an inventory precondition that a continuity
checkpoint needs: every response filename is re-derived from the signed challenge
and receiver identity before the response is admitted.

The motivating counterexample is concrete. The generic v1.3 reload accepts a
valid response copied under another well-formed 64-hex filename when the caller
presents the copied response's challenge. The signatures and content remain
valid, but that call alone does not prove the file occupies its deterministic
identity slot. v1.4 treats such a namespace as `INVALID` rather than silently
inventorying it.

```text
strict v1.3 response namespace scan
  -> derive every expected response and v1.2 custody filename
  -> run unchanged v1.3 custody/challenge/response reload verification
  -> privacy-bounded response-set snapshot
  -> caller may retain a self-digested checkpoint outside this module
  -> later strict snapshot + presented checkpoint
  -> exact / extends / absent-invalid hold / relative rollback-replacement hold
```

The module performs no writes and stores no checkpoint. Snapshots, checkpoints
and audits contain digests, references, fixed filenames, caller timestamps and
truth flags—not raw party labels, keys, signatures, custody records, assessment
receipts, private keys or machine paths. Scans are bounded to 64 responses and
artifacts to 512 KiB.

This is detection relative to the exact checkpoint a caller presents, not
prevention. The module does not prove that checkpoint was retained externally,
authenticate its authority or observer, trust caller time, protect either state
from deletion or rollback, or prove pre-checkpoint history. A controller that can
alter or withhold both local state and checkpoint can defeat comparison. No
independent party, host authorization, network, other host, external retention,
human review, provider execution, evaluation, adoption, benefit, learning,
promotion, merge or `CANON` is proved.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-continuity/selftest.js
```
