# Evidence routes

Status: `TEST`

## `v1.4_checkpoint_witness_compatibility`

Claim: the new adapter consumes the exact v1.4 possession checkpoint that the
existing v0.4 challenge-ledger witness cannot consume.

Kind: contract compatibility and deterministic behavior. Risk: medium.

Pass condition: the older witness rejects v1.4's possession-specific fields and
schema; v1.5 exact-validates the unchanged v1.4 checkpoint and binds its source
snapshot, configured identity, receiver policy and response set.

Primary surface: direct contract/schema inspection plus focused execution.
Counterevidence: a silent field-dropping translation, a modified v1.4 validator,
or acceptance without v1.4 exact rebuild.

Observed evidence: the schema incompatibility is reproduced and v1.5 composes
the unchanged v1.4 validator. Verdict: `PASS` for the additive adapter.

Named seam: the existing v0.4 witness remains unchanged and continues to serve
only its older challenge-ledger checkpoint contract.

## `detached_threshold_signature_verification`

Claim: one through ten distinct caller-policy seats can cover an exact threshold
with canonical detached Ed25519 signatures over the v1.4 checkpoint identity.

Kind: deterministic cryptographic behavior. Risk: high.

Pass condition: each signature verifies over checkpoint, source snapshot,
receiver/challenger identity, receiver policy, response-set digest, caller
policy, actor/key seat and validity window; insufficient, duplicate, unlisted,
non-Ed25519, private-key, expired and altered inputs fail.

Primary surface: native Ed25519 known-input execution and adversarial cases.
Counterevidence: one key fills multiple seats, a changed binding verifies, or a
private key is accepted by the verifier.

Observed evidence: two distinct seats verify and all named countercases fail.
Verdict: `PASS` for cryptographic signature validity, exact caller-policy
admission and configured signing-key possession.

Named seam: signing-key possession proves no real-world identity, independent
operator, authenticated human or actual participation.

## `checkpoint_modification_binding`

Claim: the original policy and detached signatures make later checkpoint-byte
modification detectable.

Kind: cryptographic integrity. Risk: high because a self-digest can be mistaken
for authenticated integrity.

Pass condition: modify a v1.4 checkpoint, recompute its internal entries and
checkpoint digests until it structurally exact-validates, then show the original
policy/signatures cannot be reused.

Primary surface: adversarial exact rebuild plus native signature verification.
Counterevidence: a modified self-digested checkpoint verifies under the original
witness package.

Observed evidence: the modified checkpoint remains structurally valid, the
original policy rejects its checkpoint reference, and a rebound policy cannot
reuse the original signatures. Verdict: `PASS` while the original policy and
witness inputs survive.

Named seam: the module stores none of those inputs and proves no external
retention.

## `witnessed_v1.4_continuity`

Claim: an exact witness must drive the unchanged v1.4 comparison in a fresh
process.

Kind: deterministic behavior and fresh-process persistence. Risk: medium.

Pass condition: exact state matches, a valid added response extends, deletion or
a different valid receiver-signed response is detected, and absence, invalidity
and configured identity drift remain typed holds with zero autonomous actions.

Primary surface: child-process disk recapture plus exact witness/audit rebuild.
Counterevidence: the audit bypasses witness validation, silently repairs state,
or converts a hold into match/extension.

Observed evidence: all six decision families pass, including fresh-process exact
and rollback cases. Verdict: `PASS` relative to the witnessed checkpoint.

Named seam: detection is not prevention, protected monotonic state, global
single-use or pre-checkpoint history.

## `caller_policy_replacement_counterexample`

Claim: valid witness signatures authenticate the caller policy as a host trust
root or prevent policy replacement.

Kind: authorization and identity. Risk: high.

Pass condition: independently administered host trust anchors and allowed/denied
policy replacement checks outside the caller's control.

Primary surface: host-native authorization and policy-continuity evidence.
Counterevidence: replace the checkpoint, policy and keys together and produce a
different cryptographically valid witness.

Observed evidence: that replacement-policy counterexample succeeds and both
receipts keep policy authority and replacement prevention false. Verdict: `FAIL`
as an authenticated-authority claim and intentionally outside v1.5 acceptance.

Named seam: the policy origin is exactly `CALLER_SUPPLIED_UNAUTHENTICATED`.

## `public_artifact_minimization_and_pure_runtime`

Claim: public witness/audit receipts are bounded and the runtime performs no I/O
or signing.

Kind: privacy, static structure and side-effect boundary. Risk: medium.

Pass condition: outputs stay under 512 KiB and omit raw actor labels, public
keys, signatures, attestation/key ids, configured party labels, state paths,
custody records, assessment receipts, private keys, private context and model
output; runtime imports only crypto and the v1.4 validator and opens no file,
network or process route.

Primary surface: serialized artifact inspection, source inspection and closed
schemas/contracts. Counterevidence: sensitive bytes, an I/O route or an authority
truth can be emitted.

Observed evidence: runtime, schema, contract, privacy and tamper checks pass.
Verdict: `PASS` for the bounded pure adapter.

Named seam: witness inputs necessarily contain caller public keys and detached
signatures; callers own their transport and retention.

## `external_retention_human_provider_outcome_and_canon`

Claim: v1.5 proves host trust, independent signers, an authenticated human,
network or other-host transport, external witness/checkpoint retention, trusted
time, protected monotonic storage, rollback prevention, provider execution,
evaluation, adoption, benefit, learning, promotion, merge or `CANON`.

Kind: identity, transport, persistence, human judgment, outcome and governance.
Risk: high.

Pass condition: native independently administered signer/host/storage/time,
human/provider/evaluation/outcome evidence and an explicit Mike Tobi / AXM gate
decision.

Primary surface: those absent native systems and decision records.
Counterevidence: one synthetic controller creates all keys, policy, timestamps,
checkpoint, witness inputs, processes and state.

Observed evidence: exactly that counterexample; none of the external actions or
decisions occurred. Verdict: `UNKNOWN` and outside v1.5 acceptance.

Named seam: Mike Tobi remains merge and `CANON` gate.
