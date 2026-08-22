# Model Shadow local possession challenge reference

Status: `TEST`

This uninstalled and unpromoted v1.3 reference follows the v1.2 local receiver
custody adapter. It exercises the next persistence proof surface available on
one machine:

```text
exact signed 32-byte nonce challenge for one v1.2 custody record
  -> exact explicit answer confirmation
  -> receiver re-reads and exact-verifies the v1.2 record and policy
  -> receiver verifies the configured challenger signature and declared window
  -> receiver signs and exclusively persists one data-minimized response + fsync
  -> the same logical challenge is refused while that response file exists
  -> fresh process reloads both files and verifies both signatures
```

Challenges are pure signed artifacts. Answering is the only new side effect and
requires the exact confirmation phrase. A challenge is bound to one custody
record, policy, receiver, challenger key fingerprint, 32-byte nonce, and a
caller-declared window no longer than 24 hours. It must be declared later than
the custody receipt and expire within the receiver policy.

The persisted response contains the signed challenge and bounded references,
not the full v1.2 custody record or stored assessment receipt. Public answer and
reload receipts contain only references, digests, fixed filenames and exact
truth flags; they omit raw receiver/challenger labels, keys, signatures,
assessment receipts and machine paths. Private keys are transient.

This proves only that a local receiver process re-read the exact record, verified
one configured-key nonce challenge, signed a response, fsynced its response file,
and later reloaded it. The challenger, receiver, keys, timestamps, processes and
root remain controlled by one synthetic test. Caller timestamps are not trusted
time. Existing-file refusal is not deletion or rollback resistance: deleting or
rolling back the caller-owned response directory can permit reuse. No independent
party, network, other host, external retention, retention duration, durability
beyond reported file fsync, protected monotonic state, human review, provider
execution, adoption, benefit, learning, promotion, merge or `CANON` is proved.

Run:

```powershell
node shared/model-shadow-review-challenge-transition-local-possession-challenge/selftest.js
```
