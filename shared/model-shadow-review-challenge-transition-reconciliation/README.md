# Model Shadow review challenge transition reconciliation

Status: `TEST`

This uninstalled and unpromoted read-only leaf follows the v0.8 caller-owned
transition ledger. It exact-rebuilds two complete presented histories in
memory—including every signature-bearing v0.7 transition package—then compares
their bounded entry-digest sequences.

```text
exact left v0.8 manifest + entries + transient caller packages
  + exact right v0.8 manifest + entries + transient caller packages
  -> exact replay, exact prefix, or typed co-presented contradiction
  -> no state write and no branch adoption
```

The presentation receipt retains only manifest, entry, transition, witness,
and head references. Public keys and signatures may occur transiently in the
caller packages required for exact rebuild, but they are not embedded in the
presentation or reconciliation receipts. Private keys are not accepted by any
declared field.

This leaf makes a real fork observable when both branches are presented. It
does not observe a third withheld root, compel disclosure, establish a total
order, authenticate a log authority, or turn pairwise prefix consistency into
global consistency. The selftest constructs a third independently valid
history and proves its unpresented head is absent from the pairwise receipt.

The receipts grant no host, identity, human, execution, evaluation, adoption,
installation, promotion, merge, Foundation, or `CANON` authority and prove no
external retention, protected monotonic state, rollback prevention, benefit,
or learning.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-reconciliation/selftest.js
```

