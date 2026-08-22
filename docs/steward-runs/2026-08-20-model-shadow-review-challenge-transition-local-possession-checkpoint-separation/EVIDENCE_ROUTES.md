# Evidence routes

Status: `TEST`

## `v1.6_anchor_and_v0.6_pattern_compatibility`

Claim: v1.7 consumes the exact v1.6 possession anchor while adapting the v0.6
observable-separation pattern without changing either upstream module.

Kind: contract compatibility and deterministic behavior. Risk: medium.

Pass condition: the old ledger-based separator rejects the v1.6 anchored
witness; v1.7 exact-rebuilds the unchanged v1.6 and nested v1.5 receipts.
Counterevidence: silent field translation, bypassed upstream verification or an
edit to either prior runtime.

Observed evidence: the old separator rejects the possession anchor and v1.7
composes both exact upstream validators. Verdict: `PASS` for the additive
adapter.

Named seam: v0.6 continues to serve its older `ledgerRef` contract only.

## `cross_layer_key_fingerprint_nonoverlap`

Claim: the exact presented witness and anchor layers share no verified public
key fingerprint.

Kind: observable cryptographic identity comparison. Risk: high because key
non-overlap can be mistaken for independent custody.

Pass condition: collect fingerprints only after the exact upstream rebuild,
refuse any exact intersection, and retain zero overlap plus domain-separated
set digests and counts. Counterevidence: the same verified key appears in both
layers and the receipt still builds.

Observed evidence: v1.6 alone admits a shared key across layers; v1.7 refuses
that exact chain. Verdict: `PASS` for observable key-fingerprint non-overlap.

Named seam: distinct keys do not prove distinct controllers or independent key
custody.

## `cross_layer_declared_principal_nonoverlap`

Claim: the exact presented witness and anchor layers share no declared actor or
steward digest.

Kind: deterministic declared-identifier comparison. Risk: high because a
caller-declared digest is not authenticated identity.

Pass condition: refuse an exact cross-layer digest intersection and retain only
domain-separated set digests and counts. Counterevidence: an identical declared
digest is accepted or a raw declared principal is retained.

Observed evidence: v1.6 alone admits the same declared digest across layers;
v1.7 refuses it and public receipts retain no raw digest set. Verdict: `PASS`
for observable declared-digest non-overlap.

Named seam: declared principal digests have no external identity attestation.

## `domain_separated_set_commitments`

Claim: witness and anchor key/principal sets are represented by four stable,
domain-separated digests without exposing the sets.

Kind: deterministic integrity and data minimization. Risk: medium.

Pass condition: sorted exact sets drive four distinct domain tags; reordering
does not change a digest, while a changed member does. Counterevidence: a shared
domain, order-dependent digest or retained raw set.

Observed evidence: focused deterministic and privacy cases pass. Verdict:
`PASS` for bounded set commitments.

Named seam: a digest is not external retention, timestamping or an authority
record.

## `same_controller_nonindependence_counterexample`

Claim: observable non-overlap proves independent real-world controllers,
custody or anti-collusion.

Kind: identity, governance and authorization. Risk: high.

Pass condition: independently administered custody and controller evidence
outside the caller's control. Counterevidence: one synthetic controller creates
distinct witness/anchor keys and distinct declared digests and still passes.

Observed evidence: that one-controller chain passes while all independence and
anti-collusion truths remain false. Verdict: `FAIL` as an independence,
identity or anti-collusion claim and intentionally outside v1.7 acceptance.

Named seam: v1.7 proves syntactic non-overlap only.

## `separated_v1.6_continuity`

Claim: an exact separation receipt must drive the unchanged v1.6 continuity
comparison, including in a fresh process.

Kind: deterministic behavior and fresh-process persistence. Risk: medium.

Pass condition: exact state matches, a valid addition extends, deletion or
replacement is detected, and absence, invalidity and configured identity drift
remain typed holds with zero autonomous actions. Counterevidence: the audit
bypasses separation verification, repairs state or changes a hold into a match.

Observed evidence: all decision families pass, including fresh-process exact
and deletion checks. Verdict: `PASS` relative to the exact presented separated
checkpoint.

Named seam: detection is not prevention, protected monotonic state or global
single-use.

## `public_artifact_minimization_and_pure_runtime`

Claim: public receipts are bounded and the runtime performs no I/O or signing.

Kind: privacy, static structure and side-effect boundary. Risk: medium.

Pass condition: inputs and outputs remain within 512 KiB; outputs omit raw
principals, keys, signatures, configured party labels, state paths, custody
records, assessment receipts, private keys, private context and model output;
the runtime imports only crypto and exact upstream validators.

Observed evidence: runtime, schemas, contract, privacy, tamper and bound checks
pass. Verdict: `PASS` for the bounded pure adapter.

Named seam: callers own transport, retention and protection of all inputs.

## `external_identity_authority_retention_provider_outcome_and_canon`

Claim: v1.7 proves independent custody/controllers, authenticated identity,
anti-collusion, host trust, policy authority, other-host transport, external
retention, trusted time, protected state, rollback prevention, provider
execution, evaluation, adoption, benefit, learning, promotion, merge or
`CANON`.

Kind: identity, transport, persistence, authorization, human judgment, outcome
and governance. Risk: high.

Pass condition: native independently administered identity, custody,
controller, host, storage and time evidence; actual provider/evaluation/outcome
records; and an explicit Mike Tobi / AXM gate decision.

Observed evidence: none of those systems, actions or decisions were supplied.
Verdict: `UNKNOWN` and outside v1.7 acceptance.

Named seam: Mike Tobi remains merge and `CANON` gate.
