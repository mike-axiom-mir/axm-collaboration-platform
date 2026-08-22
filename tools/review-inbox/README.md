# AXM Review & Promotion Inbox

Review Inbox is the Workshop's shared review surface. It deliberately presents
structural evidence, attributed decisions, and host-key evidence without
merging their authority:

- **Structural module evidence** comes from `shared/readiness/readiness-observer.js`. A candidate has a current manifest, contract and promotion self-test receipt ready for Mike to inspect. It is read-only here and has no vote action.
- **Exact-digest review items** are durable records in `state/review-inbox`. Attributed seats may approve, hold or reject the exact SHA-256 digest shown in the record.
- **Single-host mutation serialization** uses `state/review-inbox/operation.lock`
  across cooperating `ReviewService` and `ReviewAuthority` processes. Acquisition
  is bounded; held, unreadable, and invalid lease evidence all fail closed.
- **Host-key authority evidence** is a separate intent-first v2 ledger. Signed
  submission and vote envelopes are durably recorded before ordinary Review
  Inbox projection, then reverified against an explicitly installed host-local
  Ed25519 policy. Ordinary actor labels count as zero authenticated seats.
- **Held retention-audit items** receive a typed read-only view. The browser
  recomputes the embedded v2.9 artifact's canonical SHA-256 and requires it to
  match both artifact and item digests before voting is enabled. Raw JSON stays
  visible below the typed view.
- **Transition-history divergence items** receive a separate typed read-only
  view. The browser recomputes the embedded v4.0 artifact's canonical SHA-256,
  then shows both exact complete-history commitments and the earliest divergent
  normalized event. Raw JSON remains visible below it.

Structural readiness is not digest approval, promotion, CANON status, runtime proof or acceptance of a Workshop need. A structural candidate never enters the exact-digest queue automatically. If the shared tools index is stale, invalid or unavailable, the Inbox shows the hold and displays no structural candidates.

Exact-digest approval also does not apply an action. Legacy `APPROVED` means
only that the attributed label threshold was met. It is not host-key authority.
Every consuming service must verify the approved digest again and enforce its
own permission and confirmation gate.

The signed routes are `POST /api/reviews/authenticated-submit` with
`x-axm-review: authenticated-submit` and
`POST /api/reviews/authenticated-vote` with
`x-axm-review: authenticated-vote`. They accept detached public signature
evidence only. Review Inbox exposes no trust-policy write route and receives no
private key. See `shared/operations/REVIEW_AUTHORITY.md` for the exact policy,
payload, and signer boundary.

`GET /api/reviews` also returns a read-only projection-recovery status. A signed
intent whose ordinary item or vote projection was interrupted fills no
authenticated seat and is shown as recovery-required. Recovery is never
automatic and has no browser route. The host may invoke the service-local
`recoverProjection(envelopeId, 'RECOVER SIGNED REVIEW PROJECTION')` method,
which revalidates the current policy, signature, exact item bindings, and
submitter/reviewer separation before projecting. Same-principal older vote
intents are durably superseded and cannot be replayed over the newer vote.

Intent-first ordering and the operation lease serialize cooperating Review
Inbox mutations on one host; they are not a cross-file transaction. The lease
is never stolen automatically. A crashed holder may therefore leave the path
held until an operator inspects the local state outside the browser.

The explicit host-local retirement entry point is:

```powershell
node shared/operations/review-operation-lease-admin.js inspect --state-root <exact-state-root>
node shared/operations/review-operation-lease-admin.js retire --state-root <exact-state-root> --owner-digest <sha256-from-inspect> --assertion HOLDER_TERMINATED_OR_ABANDONED --reason "Operator's evidence and reason, at least 20 characters" --confirmation "RETIRE REVIEW OPERATION LEASE <sha256-from-inspect>"
```

Inspection creates no state. Retirement requires the closed assertion, exact
owner-byte digest, exact digest-bound confirmation, and reason. It records an
intent and an exclusive `PROCEED_RETIREMENT` decision before moving the raw
lock bytes into the local retirement evidence directory, then records a typed
result. It refuses evidence owned by the current process. It does not probe
process liveness, prove termination or retirement safety, or make a false
assertion safe; retiring an actually active holder can violate serialization.
There is no automatic, API, or browser retirement route.

Retirement itself has explicit interruption checkpoints because intent, raw
evidence quarantine, and result are separate files. Inspect them with:

```powershell
node shared/operations/review-operation-lease-admin.js recovery-status --state-root <exact-state-root>
```

The status emits and classifies at most 200 directory entries, reading only one
additional entry to prove truncation. It distinguishes exact complete,
intent-only, quarantined-without-result, superseded, invalid, ambiguous,
changed, current-process, and unrecognized evidence. It never changes state.
An exact intent-only record can be resumed only while the current lock bytes
still match. Exact quarantined bytes can have their missing result finalized.
Both actions require the status record's retirement id, action, owner digest,
the `HOLDER_TERMINATED_OR_ABANDONED` assertion, a new 20–500-character reason,
and its exact confirmation:

```powershell
node shared/operations/review-operation-lease-admin.js recover --state-root <exact-state-root> --retirement-id <uuid-from-status> --action <RESUME_RETIREMENT-or-FINALIZE_RESULT> --owner-digest <sha256-from-status> --assertion HOLDER_TERMINATED_OR_ABANDONED --reason "Operator's recovery evidence and reason, at least 20 characters" --confirmation "RECOVER REVIEW OPERATION LEASE RETIREMENT <action> <uuid> <sha256>"
```

An exact intent-only record with no decision may instead be withdrawn. The
status supplies a separate id-and-digest-bound withdrawal confirmation,
including for each exact intent in an otherwise ambiguous set:

```powershell
node shared/operations/review-operation-lease-admin.js withdraw --state-root <exact-state-root> --retirement-id <uuid-from-status> --owner-digest <sha256-from-status> --assertion DO_NOT_CONTINUE_REVIEW_OPERATION_LEASE_RETIREMENT --reason "Operator explicitly withdraws this exact retirement intent." --confirmation "WITHDRAW REVIEW OPERATION LEASE RETIREMENT <uuid> <sha256>"
```

Withdrawal exclusively creates an append-only `WITHDRAW_RETIREMENT_INTENT`
decision bound to the exact intent bytes and owner digest. It does not delete
the intent, release or rewrite `operation.lock`, or quarantine its bytes. A
matching repeated request observes `ALREADY_WITHDRAWN`. Among cooperating
single-host callers, the first exclusive decision create selects either
proceed or withdraw before quarantine, so both cannot report success for the
same exact intent. Withdrawing one ambiguous undecided intent can leave the
other as the sole recovery candidate without discarding either record.

Malformed, oversized, symlink/non-file, ambiguous, changed, current-process,
and digest-mismatched evidence stays held. Recovery is explicit and host-local;
it does not authenticate the assertion, infer liveness, prove holder death or
safety, or make a false assertion safe. There is no automatic, API, or browser
recovery route, and the sequence is still not cross-file atomic.

If two cooperating callers on the same host submit the same exact recovery
request concurrently, the lease-move and result-publication checkpoints use a
bounded observation window. A caller converges to `ALREADY_COMPLETE` only when
the competing result is schema-valid and digest-bound to the exact intent, or
continues finalization only when the exact quarantined owner bytes are present
and the result is still missing. Conflicting, partial after the bound, corrupt,
or digest-mismatched checkpoint evidence produces a typed held refusal. This is
checkpoint convergence, not general serialization, a cross-file transaction,
cancellation safety, multi-host safety, or protection from external writers.

The proceed/withdraw decision is likewise a bounded cooperating-single-host
arbitration point. It is not general retirement cancellation safety, holder
liveness or termination proof, cross-file atomicity, multi-host/network-
filesystem safety, or exclusion of noncooperating external writers. Withdrawal
is explicit and host-local; there is no API, browser, or automatic route.

Retirement intent, decision, and result JSON becomes authoritative through a
per-file publication boundary. Complete bytes are written and fsynced in a
private same-filesystem staging directory, then linked to the authoritative
name without overwrite. A process exit before the link leaves the authoritative
path absent; an exit after it leaves complete JSON. The bounded host-local
`publication-status` command exposes residual stages as non-authoritative but
does not delete or reclaim them. An operator can inspect one exact residual
stage and, after independently establishing that its publisher terminated or
abandoned it, archive it losslessly:

```powershell
node shared/operations/review-operation-lease-admin.js publication-stage-plan --state-root <exact-state-root> --stage-file <exact-stage-file-from-publication-status>
node shared/operations/review-operation-lease-admin.js publication-stage-authorization-status --state-root <exact-state-root> --stage-file <exact-stage-file>
node shared/operations/review-operation-lease-admin.js archive-publication-stage --state-root <exact-state-root> --stage-file <exact-stage-file> --stage-digest <sha256-from-plan> --assertion I_ASSERT_THE_RETIREMENT_PUBLICATION_STAGE_PUBLISHER_TERMINATED_OR_ABANDONED_THIS_STAGE --reason "Operator's publisher-abandonment evidence and reason, at least 20 characters" --confirmation "ARCHIVE REVIEW OPERATION LEASE RETIREMENT PUBLICATION STAGE <exact-stage-file> <sha256>"
node shared/operations/review-operation-lease-admin.js publication-stage-authorization-status --state-root <exact-state-root> --stage-file <exact-stage-file>
```

The plan validates the exact intent, decision, or result JSON in the stage and
classifies its authoritative target and archive as absent, exact, conflicting,
invalid, or unreadable. Before either archive linking or active-stage
unlinking, the closed request is persisted as an append-only archival intent.
The v2 intent records the exact stage filename and digest plus the artifact and
target classification; its request digest binds the closed schema, stage,
digest, assertion, confirmation, and SHA-256 digest of the exact raw reason.
The raw reason is not persisted in a new intent or returned in a v3 result.
Instead, both expose the digest and either a diagnostic-redaction summary or a
fixed withheld marker when no recognized pattern changed the input. The intent is written and fsynced
in a private same-filesystem stage, then published without overwrite through a hard link in
`operation-lease-retirement-publication-archival-intents`. Only an exact
matching intent authorizes continuation; conflicting, corrupt, unreadable, or
self-inconsistent intent evidence holds the operation. Matching retries and
cooperating single-host callers converge on the exact intent.

The archive checkpoint then hard-links the exact staged bytes without overwrite into
`operation-lease-retirement-publication-archives`, verifies the archive
checkpoint, and only then unlinks the active stage path. It never mutates the
authoritative target or owner lock. Matching repeated and cooperating
single-host callers converge through the exact archive checkpoint.

This is lossless archival, not deletion or storage-space reclamation: the bytes
remain in the unbounded host-local archive. The durable intent commits to the
submitted request; it does not authenticate its actor, establish consent or
permission, prove publisher termination, show live-publisher safety, or prove
human participation. Redaction covers labeled credentials, recognized token
fingerprints, private-key blocks, and machine paths, but does not prove absence
of arbitrary, encoded, or novel secrets. CLI arguments and host shell history
are outside the emitted-JSON claim, so reasons still must not contain secrets.
Existing v1 intents remain readable and retryable as explicitly typed legacy
raw-reason records; they are not rewritten, migrated, or deleted. Residual private
intent-publication stages are bounded and visible through
`publication-stage-authorization-status`, remain non-authoritative, and are
never reclaimed automatically. A legacy v1.3 archive or archive-link checkpoint
with no intent remains explicitly authorization-unknown; no retrospective
intent is fabricated, and an active stage at such a checkpoint is not unlinked.
Publication and archival require same-filesystem hard-link support and prove
neither power-loss durability nor cross-file atomicity. They provide no
hard-link-free fallback, protected or monotonic storage, bounded archive
retention, multi-host/network-filesystem guarantee, or external-writer
exclusion, and have no automatic, API, or browser route.

This does not exclude noncooperating writers or prove multi-host/network-
filesystem safety, protected or monotonic storage, rollback prevention, or
external custody. `GET /api/reviews` exposes the bounded lease status but no
release route.

Host-key verification proves possession of a key selected by this local host.
It does not prove real-world identity, actual human participation, independent
controllers, or externally trusted time. Even a host-key authenticated review
grants no reconciliation, execution, adoption, installation, promotion,
merge, Foundation, or `CANON` authority.

For a held retention audit, approval does not resolve the hold. The typed view
authenticates no submitter or reviewer and grants no execution, adoption,
promotion, merge, Foundation, or `CANON` authority. A malformed, oversized, or
digest-mismatched claimed held audit stays on an integrity hold and cannot be
voted through the browser UI.

For a transition-history divergence, approval does not reconcile either
history or resolve the divergence. The typed view authenticates no submitter,
reviewer, steward, root controller, custody provider, or human participation.
It proves no globally consistent history, execution authority, adoption,
promotion, merge, Foundation mutation, benefit, learning, or `CANON`. A
malformed, oversized, authority-inflated, or digest-mismatched claimed v4.0
artifact stays on an integrity hold and cannot be voted through the browser UI.

## Evidence

```powershell
node tools/review-inbox/selftest.js
node tools/review-inbox/retention-audit-review-view-selftest.js
node tools/review-inbox/history-reconciliation-review-view-selftest.js
node tools/review-inbox/discovery-seam-review.js
node shared/readiness/readiness-observer-selftest.js
node shared/operations/review-authority-service-selftest.js
node shared/operations/review-projection-recovery-selftest.js
node shared/operations/review-authority-api-selftest.js
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

The live route is `/tools/review-inbox/index.html`; its data comes from `GET /api/reviews`.
