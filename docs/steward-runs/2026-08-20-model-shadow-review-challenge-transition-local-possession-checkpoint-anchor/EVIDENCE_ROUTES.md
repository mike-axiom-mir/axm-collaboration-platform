# Evidence routes

Status: `TEST`

## `v1.5_anchor_contract_compatibility`

Claim: the v1.6 adapter consumes the exact v1.5 possession checkpoint witness
that the existing v0.5 challenge-ledger anchor cannot consume.

Kind: contract compatibility and deterministic behavior. Risk: medium.

Pass condition: the older anchor rejects the possession-specific witness;
v1.6 exact-rebuilds the unchanged v1.5 witness and binds every v1.5 reference
and identity field without modifying either earlier module.

Primary surface: direct contract inspection plus focused execution.
Counterevidence: silent field dropping, a modified v1.5 validator, or acceptance
without an exact witness rebuild.

Observed evidence: incompatibility is reproduced and v1.6 composes the exact
v1.5 verifier. Verdict: `PASS` for the additive adapter.

Named seam: the v0.5 anchor remains unchanged and continues to serve only the
older challenge-ledger witness contract.

## `anchor_threshold_signature_verification`

Claim: one through ten distinct anchor-policy seats can cover an exact threshold
with canonical detached Ed25519 signatures.

Kind: deterministic cryptographic behavior. Risk: high.

Pass condition: each signature verifies over the anchor and expected digest,
witness policy, witness, checkpoint, source snapshot, configured receiver and
challenger identities, receiver policy, response entries, key seat and validity
window; insufficient, duplicate, unlisted, non-Ed25519, private-key, expired,
future and oversized inputs fail.

Primary surface: native Ed25519 known-input execution and adversarial cases.
Counterevidence: one key fills multiple seats, a changed binding verifies, or a
private key is accepted by the runtime.

Observed evidence: two distinct seats verify and every named countercase fails.
Verdict: `PASS` for signature validity, exact anchor-policy admission and
configured signing-key possession.

Named seam: key possession proves no real-world identity, independent operator,
authenticated human or actual participation.

## `possession_specific_anchor_binding`

Claim: each valid anchor authorization binds the complete v1.5 possession
identity rather than only the witness self-digest.

Kind: cryptographic integrity. Risk: high.

Pass condition: individually alter the witness policy, witness, checkpoint,
source snapshot, receiver identity, challenger identity, receiver policy or
entries digest, re-sign with a valid anchor key, and require refusal because the
authorization no longer matches the exact rebuilt witness.

Primary surface: field-by-field valid-signature adversarial execution.
Counterevidence: any changed possession field is accepted under its old value or
is absent from the authorization payload.

Observed evidence: all eight witness/possession fields plus both anchor digests
are independently altered, validly re-signed and refused. Verdict: `PASS`.

Named seam: the exact witness and anchor inputs remain caller controlled and are
not stored by this module.

## `relative_witness_policy_substitution_detection`

Claim: an original anchor package makes substitution of only the v1.5 witness
policy detectable.

Kind: integrity relative to a presented trust input. Risk: high because relative
integrity can be mistaken for authenticated policy continuity.

Pass condition: a different valid v1.5 witness policy cannot reuse original
anchor signatures; the original anchor keys can explicitly authorize it only
with new signatures.

Primary surface: replacement-policy execution under retained and newly issued
anchor signatures. Counterevidence: a replacement policy reuses the original
anchor authorizations.

Observed evidence: reuse fails on the policy digest; fresh original-anchor
authorizations succeed. Verdict: `PASS` only for substitution detection relative
to the exact presented anchor.

Named seam: this is not policy replacement prevention or host-authenticated
authority.

## `joint_anchor_pin_policy_substitution_counterexample`

Claim: v1.6 proves a host trust root or prevents replacement of the whole chain.

Kind: authorization and continuity. Risk: high.

Pass condition: independently administered host anchor/pin authority and
allowed/denied replacement checks outside the caller's control.

Primary surface: host-native authorization and protected policy-continuity
evidence. Counterevidence: replace the anchor, presented pin, witness policy,
witness and signatures together and produce another exact valid chain.

Observed evidence: that joint replacement succeeds; receipts keep anchor,
witness-policy and replacement-prevention authority false. Verdict: `FAIL` as an
authenticated-authority or prevention claim and intentionally outside v1.6
acceptance.

Named seam: both the anchor policy and expected pin are exactly
`CALLER_PRESENTED_PIN_UNAUTHENTICATED`.

## `anchored_v1.5_continuity`

Claim: an exact anchored witness must drive the unchanged v1.5 comparison in a
fresh process.

Kind: deterministic behavior and fresh-process persistence. Risk: medium.

Pass condition: exact state matches, a valid added response extends, deletion or
a different valid receiver-signed response is detected, and absence, invalidity
and configured identity drift remain typed holds with zero autonomous actions.

Primary surface: child-process disk recapture plus exact anchored-chain rebuild.
Counterevidence: the audit bypasses anchor verification, silently repairs state,
or changes a hold into match or extension.

Observed evidence: all six decision families pass, including fresh-process exact
and deletion checks. Verdict: `PASS` relative to the anchored checkpoint.

Named seam: detection is not prevention, protected monotonic state, global
single-use or pre-checkpoint history.

## `public_artifact_minimization_and_pure_runtime`

Claim: public receipts are bounded and the runtime performs no I/O or signing.

Kind: privacy, static structure and side-effect boundary. Risk: medium.

Pass condition: outputs remain under 512 KiB and omit raw steward labels, public
keys, signatures, authorization/key ids, configured party labels, state paths,
custody records, assessment receipts, private keys, private context and model
output; runtime imports only crypto and the v1.5 validator.

Primary surface: serialized artifact inspection, source inspection and closed
schemas/contracts. Counterevidence: sensitive bytes, I/O, signing or an
authority truth appears.

Observed evidence: runtime, schema, contract, privacy and tamper checks pass.
Verdict: `PASS` for the bounded pure adapter.

Named seam: callers own transport, retention and protection of the anchor,
policy, public keys, signatures and expected pin.

## `external_authority_retention_provider_outcome_and_canon`

Claim: v1.6 proves an authenticated anchor/pin, independent signers, an
authenticated human, other-host transport, external retention, trusted time,
protected monotonic storage, rollback prevention, provider execution,
evaluation, adoption, benefit, learning, promotion, merge or `CANON`.

Kind: identity, transport, persistence, authorization, human judgment, outcome
and governance. Risk: high.

Pass condition: native independently administered host/signer/storage/time,
human/provider/evaluation/outcome evidence and an explicit Mike Tobi / AXM gate
decision.

Primary surface: those absent native systems and decision records.
Counterevidence: one synthetic controller creates every anchor, pin, key,
policy, timestamp, witness, process and state.

Observed evidence: exactly that synthetic counterexample; none of the external
actions or decisions occurred. Verdict: `UNKNOWN` and outside v1.6 acceptance.

Named seam: Mike Tobi remains merge and `CANON` gate.
