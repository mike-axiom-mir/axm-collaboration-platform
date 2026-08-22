# Evidence routes

Status: `TEST`

## `caller_receiver_policy`

Claim: a caller policy deterministically binds the exact v1.0 assessment to a
bounded set of distinct declared receiver labels and canonical Ed25519 keys.

Kind: static structure and deterministic behavior. Risk: medium.

Pass condition: two through ten receivers exact-rebuild; label and key
fingerprints are unique; threshold is at least two and no greater than enabled
receivers; assessment, issue and expiry bindings are exact.

Primary surface: focused deterministic assertions. Counterevidence: duplicate
labels/keys, a non-Ed25519 key, invalid threshold, changed assessment or changed
truth metadata is accepted.

Observed evidence: exact rebuild and all listed refusals pass. Verdict: `PASS`
for caller-supplied policy data.

Named seam: the policy authenticates neither receiver identity nor real-world
receiver independence.

## `signed_acknowledgement_binding`

Claim: each presented acknowledgement is an exact statement under the declared
Ed25519 key for one policy, assessment, roster, receiver label, time and scope.

Kind: cryptographic and deterministic behavior. Risk: medium.

Pass condition: exact payload verifies; altered references, policy, scope,
retention claim, time, algorithm or signature are refused.

Primary surface: adversarial signature matrix. Counterevidence: any altered
payload verifies or the signature can be moved to another receiver.

Observed evidence: exact acknowledgements pass and all alterations are refused.
Verdict: `PASS` for the supplied key/payload relation.

Named seam: key possession does not establish legal identity, organizational
role, independent operation, host authorization or trusted time.

## `declared_acknowledgement_threshold`

Claim: zero or one exact acknowledgement per enabled declared receiver is
counted against the caller threshold, with a typed hold below threshold.

Kind: deterministic behavior. Risk: medium.

Pass condition: two of three meets a threshold of two; one or zero produces
`HOLD_DECLARED_RECEIVER_ACKNOWLEDGEMENT_THRESHOLD_INCOMPLETE`; duplicates and
disabled or unknown receivers are refused.

Primary surface: complete, threshold, incomplete and empty fixtures.
Counterevidence: duplicate counting, below-threshold success, or autonomous
action.

Observed evidence: the fixture matrix passes. Verdict: `PASS` for the declared
policy threshold; no execution or adoption authority follows.

## `receiver_independence_delivery_and_retention`

Claim: distinct keys and a met acknowledgement threshold prove independently
operated receivers, actual delivery, receiver read/application, persisted bytes
or independent external retention.

Kind: transport, persistence and identity. Risk: high.

Pass condition: independently operated receiver endpoints emit native receipts,
with sender and receiver transport correlation, retained-content verification,
restart/reload evidence and a declared retention interval.

Primary surface: receiver-native audit and persistence receipts. Counterevidence:
multiple keys controlled and signed in one process.

Observed evidence: the same-process fixture meets threshold while all broad
truth flags remain false, and each signed statement says
`NO_DURABLE_RETENTION_CLAIM`. Verdict: `FAIL` as a broad delivery/independence/
retention claim; intentionally not a v1.1 acceptance condition.

Named seam: a future route needs independently operated receiver transport and
durable retention receipts or a protected monotonic store.

## `fresh_process_rebuild`

Claim: a fresh process rebuilds the same witness from serialized caller-retained
data.

Kind: caller-package reload. Risk: medium.

Pass condition: child-process verification returns the same witness digest,
classification and acknowledgement count.

Primary surface: separate Node process. Counterevidence: verification, digest,
classification or count mismatch.

Observed evidence: all fields match. Verdict: `PASS` for the caller-retained
serialized package.

Named seam: fresh-process caller reload is not independent external retention.

## `authority_humans_provider_and_outcomes`

Claim: the witness authorizes a host, authenticates receivers, records human
review, invokes a provider, adopts a branch, proves benefit or learning, or
establishes `CANON`.

Kind: authorization, human participation, execution, learning and quality.
Risk: high.

Pass condition: independent allowed/denied authorization evidence, real receiver
identity/operation evidence, actual steward review/adoption receipt, provider
evaluation and voluntary held-out human outcome evidence.

Primary surface: host and receiver audit trails, human review/adoption receipt,
provider evaluation and human outcome evidence. Counterevidence: synthetic
fixtures and zero external actors.

Observed evidence: none was supplied or invoked. Verdict: `UNKNOWN`.

Named seam: Mike Tobi remains merge and `CANON` gate.
