# Evidence routes

Status: `TEST`

## `v1.7_chain_and_v0.7_pattern_compatibility`

Claim: v1.8 consumes the exact v1.7 possession-specific separated chain while
adapting the v0.7 pairwise transition pattern without changing either source.

Kind: contract compatibility and deterministic behavior. Risk: medium.

Pass condition: the old ledger-based gate rejects the v1.7 package; v1.8
exact-rebuilds both unchanged v1.7 chains and their nested anchors. Primary
surface: direct contract inspection plus focused execution. Counterevidence:
silent field translation, bypassed upstream validation, or upstream mutation.

Observed evidence: incompatibility is reproduced and v1.8 composes exact v1.7
and v1.6 verifiers. Verdict: `PASS` for the additive adapter.

Named seam: v0.7 remains unchanged and serves only the older ledger chain.

## `pairwise_exact_replay_and_response_extension`

Claim: two exact presented chains classify as replay, or as a forward response
extension only when lineage is stable, time advances, every prior entry remains
exact, and at least one challenge is added.

Kind: deterministic behavior. Risk: high.

Pass condition: exact replay is non-forward; a valid added response is
pairwise-admissible; identity, policy, time, entry or metadata contradictions
become typed holds. Primary surface: adversarial focused execution plus exact
receipt rebuild. Counterevidence: a removed/replaced response or drifted policy
is admitted as extension.

Observed evidence: replay, extension and every named hold class pass. Verdict:
`PASS` for pairwise classification.

Named seam: pairwise admission grants no host action or adoption authority.

## `witness_policy_identity_and_digest_semantics`

Claim: a checkpoint-bound witness-policy digest may change while its id/schema
identity must remain stable.

Kind: contract semantics and deterministic behavior. Risk: high because digest
change could be mistaken for unrestricted policy replacement.

Pass condition: same identity plus an exactly rebuilt checkpoint-bound digest
is admitted; id/schema drift is held. Primary surface: focused extension and
policy-drift cases. Counterevidence: requiring the old digest makes every real
extension impossible, or accepting a new identity silently.

Observed evidence: forward extension has a changed digest under the same
identity; a different identity is held. Verdict: `PASS` for the bounded
semantics.

Named seam: identity continuity is not witness-policy authority or replacement
prevention; joint substitution remains possible.

## `pairwise_response_fork_detection_and_nonexclusion`

Claim: co-presented divergent response branches are detected, but unpresented
branches are excluded globally.

Kind: deterministic behavior and global-consistency boundary. Risk: high.

Pass condition for the bounded claim: two different candidates independently
extend one previous checkpoint, while comparing those candidates identifies
the omitted and added challenge digests and holds the transition.
Counterevidence to the broad claim: either independently admissible branch can
remain withheld from a different comparison.

Observed evidence: both forks independently pass and their co-presentation is
held. Verdict: `PASS` for co-presented fork detection; `FAIL` as global fork
exclusion, global uniqueness or withheld-branch observation.

Named seam: no globally coordinated transition log exists.

## `anchor_identity_epoch_and_checkpoint_contradictions`

Claim: pairwise comparison exposes anchor identity drift, lower self-declared
epoch, same-epoch anchor equivocation, checkpoint-id equivocation, alternate
separated chains, checkpoint time collision and metadata-only changes.

Kind: deterministic integrity. Risk: high.

Pass condition: each contradiction produces its exact hold and zero autonomous
actions. Primary surface: one-variable adversarial execution plus closed schema
inspection. Counterevidence: any contradiction becomes a forward extension.

Observed evidence: all named contradictions are held. Verdict: `PASS` relative
to the two presented chains.

Named seam: a higher presented epoch is not externally protected monotonic
state, trusted time or rollback prevention.

## `declared_party_and_receiver_policy_continuity`

Claim: receiver/challenger digest drift or receiver-policy reference drift is
silently treated as the same transition identity.

Kind: deterministic identity-reference comparison. Risk: high because a digest
is not an authenticated person.

Pass condition: each drift becomes a separate typed hold while principal
authentication remains false. Primary surface: focused one-variable cases and
truth-schema inspection. Counterevidence: drift is admitted or digest equality
is promoted to real-world identity.

Observed evidence: all three drifts are held and identity authentication stays
false. Verdict: `PASS` for declared-reference continuity only.

Named seam: no external principal mapping or authenticated human participated.

## `source_snapshot_reference_boundary`

Claim: exact rebuilding of two presented chains proves that their checkpoints
still describe current live source state.

Kind: persistence/currentness. Risk: high.

Pass condition: recapture both live source roots or present exact snapshot bytes
and compare them natively. Primary surface: live state recapture and fresh
process recovery. Counterevidence: the v1.8 input contains references only and
the runtime has no state-root or filesystem input.

Observed evidence: references are exact, but no source state is recaptured.
Verdict: `UNKNOWN` for current source truth and intentionally outside v1.8
acceptance.

Named seam: signed/checkpointed presentation is not currentness.

## `public_artifact_minimization_and_pure_runtime`

Claim: public artifacts are bounded and the runtime performs no I/O, signing or
autonomous action.

Kind: privacy, static structure and side-effect boundary. Risk: medium.

Pass condition: inputs/receipts remain within 512 KiB; outputs omit tested raw
actor/steward labels, keys, signatures, configured party labels, state paths,
custody records, assessment receipts, private keys, private context and model
output; runtime imports only exact upstream validators.

Observed evidence: privacy, source, schema, contract and bound checks pass.
Verdict: `PASS` for the bounded pure adapter.

Named seam: declared party digests and public references remain intentionally
present for pairwise comparison.

## `external_authority_retention_provider_outcome_and_canon`

Claim: v1.8 proves independent custody/controllers, authenticated identity,
anti-collusion, host trust, policy authority, external retention, trusted time,
protected state, rollback prevention, provider execution, evaluation, adoption,
human benefit, learning, promotion, merge or `CANON`.

Kind: identity, transport, persistence, authorization, outcome and governance.
Risk: high.

Pass condition: independently administered native systems, actual provider and
held-out outcome evidence, and an explicit Mike Tobi / AXM gate decision.

Observed evidence: none of those systems, actions or decisions were supplied.
Verdict: `UNKNOWN` and outside v1.8 acceptance.

Named seam: Mike Tobi remains merge and `CANON` gate.
