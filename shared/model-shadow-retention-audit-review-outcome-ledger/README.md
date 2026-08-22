# Model Shadow local retention-audit review-outcome ledger

Status: `TEST` · installed: `false` · promoted: `false`

This explicitly invoked local persistence adapter continues v3.1 without
widening its review or execution authority:

```text
exact v3.1 caller package + minimized outcome + explicit confirmation
  -> exclusive-create file-fsync append-only local record
fresh process + ledger root only
  -> complete chain validation + exact minimized outcome reload
```

The ledger stores `APPROVED`, `HOLD`, and `REJECTED` observations. Every stored
record binds a fixed manifest, contiguous sequence, previous record, exact v3.1
outcome digest, caller time, classification, and self-digest. Duplicate record
ids, outcome ids, or outcome digests; non-forward time; corruption; gaps;
unexpected files; stale locks; root overlap; oversized inputs; and concurrent
duplicate writers fail closed.

Only the minimized v3.1 output is persisted. The complete v3.1 input, raw Review
Inbox item, raw actor strings, vote notes, discussion, configured paths, raw
model output, and private context are not retained. Capture exact-rebuilds the
complete v3.1 package before writing, so actor-digest derivation is checked at
that boundary. Reload validates the stored pseudonymous artifact and chain; it
does not independently reconstruct raw actors or re-prove their digest
derivation after the capture input is absent.

The ledger root must be a caller-owned real directory distinct and nonnested
from the upstream v2.8 observation root. A fresh process can reload records
after that upstream root is unavailable. This is bounded local continuity, not
continuous Review Inbox monitoring, independent custody, external retention,
protected monotonic storage, or deletion prevention. File `fsync` proves neither
directory-entry nor device, hardware, cache, power-loss, or global durability.
A controller that can replace every local ledger byte can construct another
internally exact history, so self-consistent full rewrites are not detectable
tamper evidence or proof of the original history.

The service also exposes a read-only `readAll()` operation that validates and
returns the complete record chain from one bounded ledger load. This supports
later portable-history adapters without repeated quadratic reloads; it adds no
write, retention, or authority.

An explicit confirmation string authenticates no host, actor, human,
organization, or policy. Persisting `APPROVED` does not resolve the retention
hold, choose remediation, authorize execution or adoption, invoke a provider,
perform an evaluation, prove benefit or learning, install, promote, merge,
mutate the Foundation, or grant `CANON`.

Run:

```powershell
node shared/model-shadow-retention-audit-review-outcome-ledger/selftest.js
```

Mike Tobi / AXM remains the merge and `CANON` gate.
