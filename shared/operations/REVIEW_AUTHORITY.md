# Review Inbox host-key authority path

Status: `TEST` · installed trust roots: none · merge and `CANON` gate: Mike Tobi / AXM

The ordinary Review Inbox route records exact-digest decisions under caller-
supplied actor labels. Those labels are useful attribution, but they are not
authentication. Distinct labels therefore cannot prove distinct people,
machines, organizations, or independent controllers.

`review-authority-service.js` adds a separate fail-closed path:

```text
host-local trust policy (not writable through the browser API)
  + exact normalized review candidate
  + detached Ed25519 submission envelope
  -> durably record signed intent
  -> project the reserved exact Review Inbox item

same policy
  + exact item identity, route, digest, verdict and note
  + detached Ed25519 vote envelope
  -> durably record signed intent
  -> project the attributed vote + separately reverified authority view
```

The server expects an explicitly installed policy at
`state/review-inbox/trusted-review-keys.json`. The committed
`review-trust-policy.example.json` is intentionally expired, has no keys, and
is not a usable policy. The policy is never created or changed by Review Inbox.
Its self-digest is SHA-256 over deterministic canonical JSON with the
`policyDigest` field omitted.

Envelope signatures are Ed25519 over deterministic canonical JSON with the
`signature` field omitted. Use the exported `policyDigest`, `sha256`,
`normalizeCandidate`, and `signingPayload` functions to prepare material in a
separate trusted signer. The Workshop runtime verifies signatures and stores
public evidence; it never receives or generates a private key.

The v2 authentication ledger is the durable intent and is written atomically
before any ordinary Review Inbox projection. A deterministic reserved review id
binds a new signed submission before its item exists. If projection is
interrupted, the signed intent remains visible as `RECOVERY_REQUIRED`, fills no
authenticated seat, and can be projected only through the host-local
`recoverProjection` method with the exact confirmation
`RECOVER SIGNED REVIEW PROJECTION`. Review Inbox exposes no browser recovery
route and never retries automatically. Older v1 finalized evidence remains
readable and migrates to v2 on the next signed mutation.

Review Inbox state and authentication intent still use separate local files;
they are not one filesystem transaction. Intent-first ordering prevents this
service from making an ordinary mutation before its signed evidence is durable.
An exclusive-create operation lease serializes cooperating `ReviewService` and
`ReviewAuthority` mutations on one host. Acquisition is bounded, nested calls
inside the same service instance are reentrant, and a held or invalid lease is
never stolen automatically. A crashed holder may leave mutations held for
explicit operator inspection; the browser has no release route.

`review-operation-lease-admin.js` is the separate explicit host-local
retirement entry point. Its inspect command returns an exact owner-byte digest
and digest-bound confirmation challenge without writing state. Retirement
requires that digest, the exact `HOLDER_TERMINATED_OR_ABANDONED` caller
assertion, the challenge, and a reason. The service records an intent, moves raw
owner evidence into the retirement evidence directory, and records a result.
Before the move it exclusively records a `PROCEED_RETIREMENT` decision bound to
the exact intent bytes and owner digest. It refuses a current-process owner. It
does not infer process liveness, prove termination or retirement safety, or
make a false assertion safe; retiring an active holder can violate
serialization. No automatic, API, or browser path is added.

If that local retirement is interrupted, `recovery-status` performs a bounded
read-only classification of at most 200 retirement-directory entries. An exact
intent-only record is recoverable only while the current owner bytes still
match; exact quarantined owner bytes without a result can be finalized. The
`recover` command requires a second closed request with the exact recovery
action, retirement id, owner digest, `HOLDER_TERMINATED_OR_ABANDONED`
assertion, action/id/digest-bound confirmation, and reason. Invalid, ambiguous,
changed, current-process, oversized, and unrecognized evidence stays held.
This recovery is not automatic or browser/API callable. The second assertion
still does not prove holder termination, recovery safety, identity, human
participation, or cross-file atomicity, and a false assertion can violate
serialization.

An exact intent-only record without a decision can instead be withdrawn with
the host-local `withdraw` command. It requires the retirement id, owner digest,
the exact `DO_NOT_CONTINUE_REVIEW_OPERATION_LEASE_RETIREMENT` assertion, a
20–500-character reason, and the status record's exact id/digest-bound
confirmation. Withdrawal exclusively records an append-only
`WITHDRAW_RETIREMENT_INTENT` decision bound to the exact intent bytes. It does
not delete the intent, release or rewrite the owner lock, or quarantine owner
bytes. Exact repeated withdrawal observes the existing decision. Each exact
undecided intent in an ambiguous set can be withdrawn separately, preserving
the evidence while allowing the remaining unwithdrawn intent to be classified
on its own.

Two cooperating callers on the same host can race after they independently
authorize the same exact recovery request. The lease-move and exclusive result
checkpoints therefore use a bounded observation window: only an exact
digest-verified quarantine can continue to finalization, and only an exact
schema-valid result bound to the original intent can converge to
`ALREADY_COMPLETE`. Corrupt, conflicting, or incomplete evidence after the
bound produces a typed held refusal. This proves neither general recovery
serialization nor cancellation safety and does not make the file sequence
atomic.

The same exclusive decision file arbitrates proceed against withdrawal among
cooperating callers on one host before owner quarantine. It does not prove
general cancellation safety, holder liveness or termination, cross-file
atomicity, multi-host/network-filesystem safety, or external-writer exclusion.
Withdrawal has no automatic, API, or browser route.

Retirement intent, decision, and result JSON uses a per-artifact host-local
publication boundary: complete staged bytes are fsynced before an exclusive
same-filesystem hard link makes the authoritative name visible. The bounded
`publication-status` CLI can report residual stages but treats them as
non-authoritative and performs no automatic reclamation.

The host-local `publication-stage-plan` command validates one exact residual
intent, decision, or result stage and classifies its authoritative target and
archive. `publication-stage-authorization-status` reports whether the exact
stage has no archival intent, an exact durable intent, conflicting or invalid
intent evidence, or a legacy archive whose authorization is unknown.
`archive-publication-stage` requires the exact stage filename and digest, the closed
`I_ASSERT_THE_RETIREMENT_PUBLICATION_STAGE_PUBLISHER_TERMINATED_OR_ABANDONED_THIS_STAGE`
assertion, a filename/digest-bound confirmation, and a 20–500-character reason.
Before it changes the active stage path, it writes and fsyncs an archival-intent
stage and exclusively hard-links an append-only intent to
`operation-lease-retirement-publication-archival-intents`. The v2 intent records
the exact stage bytes plus artifact and target classification, while its request
digest binds the closed schema, stage, digest, assertion, confirmation, and the
SHA-256 digest of the exact raw reason. New intents and v3 results omit the raw
reason and expose only its digest plus either a diagnostic-redaction summary or
a fixed withheld marker when no recognized pattern changed the input. Only exact
intent evidence can continue; conflicting, corrupt,
unreadable, or self-inconsistent evidence holds. It then exclusively hard-links the exact stage bytes into
`operation-lease-retirement-publication-archives`, verifies that checkpoint,
then removes the active stage path without changing the authoritative target or
owner lock. Exact matching retries and cooperating single-host callers converge
through both checkpoints.

Archival is lossless: it does not delete the bytes or reclaim storage, and the
archive has no retention bound. The durable intent commits to the submitted
request but authenticates no actor and proves no consent, permission, publisher
termination, liveness, live-publisher safety, or human participation. A false
assertion can interrupt a live publisher. Diagnostic redaction covers labeled
credentials, recognized token fingerprints, private-key blocks, and machine
paths; it does not prove absence of arbitrary, encoded, or novel secrets. CLI
arguments and host shell history remain outside the emitted-JSON claim, so
reasons must not contain secrets. Existing v1 intents remain readable and
retryable as explicitly typed legacy raw-reason records and are never rewritten,
migrated, or deleted automatically.
Residual intent-publication stages are reported with a bound, remain
non-authoritative, and are never reclaimed automatically. A legacy v1.3 archive
or archive-link checkpoint without an intent remains authorization-unknown; the
system never fabricates a retrospective intent or unlinks the active stage at
such a checkpoint. Publication and archival remain same-filesystem hard-link
mechanisms for process-crash consistency, not protected or monotonic storage,
power-loss durability, cross-file atomicity, hard-link-free portability,
multi-host/network-filesystem safety, or exclusion of external writers. No
automatic, API, or browser intent-status or stage-archival route exists.

This does not exclude noncooperating external writers or prove cross-file atomicity,
multi-host/network-filesystem safety, protected storage, rollback prevention,
or external custody. Older signed votes from one declared principal are
retained as superseded evidence and cannot be recovered over the newer signed
vote.

The separate authority view reaches `HOST_KEY_AUTHENTICATED_APPROVED` only when
the current host policy revalidates the exact submission and enough distinct
principal digests have valid approval envelopes for the current item. Legacy
attributed votes can still produce the legacy item state `APPROVED`, but they
never satisfy this authority view. A policy can also prevent a submission
principal from reviewing its own item.

This path proves possession of keys explicitly trusted by this local host. It
does not prove that a key belongs to Mike or any named person, that its holder
is human, that different principal digests are independent controllers, that
the host clock is externally trusted, or that a review occurred with informed
human participation. It grants no reconciliation, execution, adoption,
permission, installation, promotion, merge, Foundation, or `CANON` authority.

Run:

```powershell
node shared/operations/review-authority-service-selftest.js
node shared/operations/review-projection-recovery-selftest.js
node shared/operations/review-operation-lease-selftest.js
node shared/operations/review-operation-lease-retirement-selftest.js
node shared/operations/review-operation-lease-retirement-publication-selftest.js
node shared/operations/review-operation-lease-retirement-publication-stage-archival-selftest.js
node shared/operations/review-operation-lease-retirement-recovery-selftest.js
node shared/operations/review-operation-lease-retirement-recovery-convergence-selftest.js
node shared/operations/review-operation-lease-retirement-recovery-process-convergence-selftest.js
node shared/operations/review-operation-lease-retirement-intent-withdrawal-selftest.js
node shared/operations/review-operation-lease-retirement-decision-process-selftest.js
```
