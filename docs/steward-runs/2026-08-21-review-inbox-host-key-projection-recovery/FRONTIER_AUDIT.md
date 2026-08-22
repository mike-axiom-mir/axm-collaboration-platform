# Grounded-growth frontier audit: signed Review Inbox projection recovery

Status: `TEST` · branch material only · merge and `CANON` gate: Mike Tobi / AXM

## Audited frontier

v4.1 established a host-configured Ed25519 authority view, but ordinary Review
Inbox state and authentication evidence were separate writes. A process failure
between them could leave an ordinary item or vote without its public signed
evidence. Authority failed closed, but the signed operation could not be
deterministically resumed. The highest-value bounded seam was therefore
intent-first projection with explicit recovery, without pretending two files
became one transaction.

## Bounded v4.2 advance

The v2 authentication ledger stores the closed signed operation before the
ordinary Review Inbox projection. New submissions precommit a deterministic
reserved review id. Signed vote projection uses the same order. An interruption
is typed `RECOVERY_REQUIRED`; the pending vote fills no authenticated seat.

Recovery is an explicit host-local service method guarded by the exact text
`RECOVER SIGNED REVIEW PROJECTION`. It revalidates the current policy, signature,
candidate or item bindings, and submitter/reviewer separation. Successful retry
is idempotent and appends no new authentication operation. No API or browser
recovery route exists, and no automatic replay occurs.

Older same-principal signed vote intents remain preserved as superseded. The
only accepted chain follows signed `issuedAt` values with envelope id as the
deterministic tie-breaker. Reversing unsigned supersession pointers makes the
evidence invalid and holds authority. A superseded vote cannot be recovered
over its replacement.

Finalized v1 ledgers remain readable. The next signed mutation writes v2 while
preserving exact v1 evidence. Closed Draft 2020-12 schemas cover the ledger,
authority view/index, recovery status, and recovery result; runtime exact-key
agreement is tested.

## Deliberate boundaries

- Intent-first single-process ordering is not cross-file atomicity or
  multi-process serialization.
- Local files are not protected monotonic storage, rollback prevention,
  external custody, or global history.
- No real host policy was installed and no real signed review occurred.
- Key possession proves no real-world identity, actual human participation,
  independent controller, or externally trusted time.
- Recovery grants no reconciliation, execution, adoption, permission, install,
  promotion, merge, Foundation mutation, or `CANON` authority.
- Ajv and Python `jsonschema` were unavailable and were not installed. Runtime
  schema identities and exact closed shapes pass; independent metaschema
  validation remains open.
- Browser verification used synthetic read-only localhost fixtures. It proves
  no assistive-technology compatibility, usability, benefit, or learning.
- The incoming specialist ZIP package lane was not inspected or modified.

## Next honest seam

A real host policy installation and an authorized signed review session remain
external steps. Stronger persistence would require a separately designed
single-store transaction or write-ahead protocol with multi-process locking and
rollback-resistant custody. Neither follows from v4.2. The broad grounded-growth
objective remains active.
