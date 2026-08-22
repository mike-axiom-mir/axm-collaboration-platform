# Grounded-growth frontier audit: host-trusted Review Inbox path

Status: `TEST` · branch material only · merge and `CANON` gate: Mike Tobi / AXM

## Audited frontier

The v4.0 frontier could create and render an exact-digest reconciliation-review
artifact, but Review Inbox voters were still caller-supplied strings. Distinct
labels could reach the legacy `APPROVED` state without proving distinct people,
machines, organizations, or controllers. Permission records also describe
declared actors; they are not an identity proof. Existing Model Shadow signature
modules explicitly use caller-supplied keys, so they were not a host trust root.

The repository did contain a bounded precedent in the Workshop updater: a host-
configured trust root that defaults empty. The next honest technical seam was
therefore a separate Review Inbox authority assessment rooted in explicitly
installed host public keys, while preserving legacy compatibility and refusing
to turn key possession into identity or action authority.

## Bounded v4.1 advance

`review-authority-service.js` verifies closed, self-digested host policies and
detached Ed25519 envelopes. A submit envelope binds the exact normalized review
candidate. A vote envelope binds the exact current item id, kind, source route,
artifact digest, verdict, note, and informed-explanation flag. Policies scope
keys by role and review kind, enforce active windows, collapse rotated keys by
declared principal digest, and may separate submitter and reviewer principals.

The signed-vote route requires a currently valid signed submission before it
mutates the ordinary Review Inbox record. Envelope identifiers cannot be reused.
Public authentication evidence persists separately and is reverified from the
current host policy and current Review Inbox item after reload. Policy changes,
expired evidence, malformed ledger state, signature tampering, route drift, and
item drift hold authority closed.

The existing `APPROVED` state remains for compatibility. It is now visibly
separate from `HOST_KEY_AUTHENTICATED_APPROVED`; ordinary actor labels count as
zero authenticated seats. No downstream execution, reconciliation, adoption,
permission, install, promotion, merge, Foundation, or `CANON` path consumes the
new authority state.

## Deliberate boundaries

- The branch installs no real host trust policy and performs no real signed
  submission or vote.
- Key possession does not prove a named person, actual human participation, or
  independent control of distinct principal digests.
- Local system time is not externally trusted.
- Review and authentication evidence are separate files, not one transaction.
  Authority fails closed if authentication persistence fails, but atomicity is
  not proven.
- Local files provide no protected monotonic storage, rollback prevention,
  external custody, or global history.
- The committed example policy is expired and has no keys. It cannot activate
  the route accidentally.
- The runtime generates or receives no private key and opens no provider or
  network connection.
- Draft 2020-12 schemas were runtime-shape tested, but Ajv and Python
  `jsonschema` were unavailable and were not installed; independent
  meta-validation remains open.
- Browser checks used synthetic read-only localhost states. They do not prove
  assistive-technology compatibility, usability, human benefit, or learning.

## Next honest seam

Host installation of a real policy and an authorized signed review session is
the next external step. Reconciliation or any consequential action must remain
a separately authenticated and authorized workflow. Stronger identity,
independent control, trusted time, atomic persistence, rollback resistance, and
external custody are distinct future capabilities, not implications of v4.1.
