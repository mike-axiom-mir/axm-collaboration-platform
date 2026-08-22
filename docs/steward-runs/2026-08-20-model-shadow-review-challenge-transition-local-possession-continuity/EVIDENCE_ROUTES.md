# Evidence routes

Status: `TEST`

## `strict_response_namespace_identity`

Claim: every admitted v1.3 response occupies the deterministic filename derived
from its signed challenge and receiver identity.

Kind: deterministic identity and local filesystem behavior. Risk: high because
a well-formed filename is not itself identity evidence.

Pass condition: re-derive each response filename from the embedded signed
`challengeId` and `receiverId`; reject a valid artifact copied under a different
well-formed 64-hex name, unexpected entries, symlinks, noncanonical or oversized
files and duplicate challenges.

Primary surface: focused local filesystem execution and exact canonical rebuild.
Counterevidence: the generic v1.3 single-file reload accepts a valid copied
artifact when the caller supplies that artifact's challenge.

Observed evidence: the counterexample is reproduced, then the same namespace is
`INVALID` under v1.4 strict inventory. Verdict: `PASS` for deterministic response
slot identity and a bounded inventory of at most 64 entries.

Named seam: v1.3 remains unchanged; v1.4 closes the inventory precondition only.

## `strict_v1.3_reload_composition`

Claim: each admitted inventory entry still satisfies the full v1.3 possession
reload chain.

Kind: deterministic cryptographic and persistence behavior. Risk: medium.

Pass condition: after filename derivation, run unchanged v1.3 reload so v1.2
custody, v1.1 policy, challenge, receiver/challenger keys, exact references and
both signatures are verified; any failure makes the whole snapshot `INVALID`.

Primary surface: focused known-input execution plus native Ed25519 verification.
Counterevidence: an entry is inventoried from its name alone or after a failed
custody, policy, challenge or response check.

Observed evidence: valid entries load and all named corruption, key, policy,
canonicality, size and reference cases fail closed. Verdict: `PASS` for one
caller-owned local v1.3 response namespace.

Named seam: configured labels and keys authenticate no legal or organizational
identity.

## `read_only_snapshot_and_checkpoint`

Claim: v1.4 creates a privacy-bounded response-set snapshot and an exact portable
checkpoint without writing runtime state or storing the checkpoint.

Kind: deterministic structure, privacy and side-effect boundary. Risk: medium.

Pass condition: snapshot and checkpoint exact-rebuild, self-digests validate,
canonical entry order and counts match, public artifacts remain under 512 KiB,
and runtime source opens no write, network or process route.

Primary surface: artifact/schema inspection, source inspection and focused
read-only execution. Counterevidence: hidden writes, checkpoint persistence,
noncanonical acceptance or sensitive fields in public artifacts.

Observed evidence: exact rebuild, tamper, byte-bound, privacy and read-only
checks pass. Verdict: `PASS` for caller-retainable self-digested data.

Named seam: self-digests are corruption checks, not authenticated integrity;
snapshot origin, checkpoint authority and independent retention remain unproved.

## `fresh_process_relative_continuity`

Claim: a fresh process can recapture the strict response set and classify an
exact match or extension relative to one exact caller-presented checkpoint.

Kind: fresh-process persistence and deterministic comparison. Risk: medium.

Pass condition: a distinct child process reloads disk state; exact state matches,
an added valid response extends, and the audit performs zero autonomous actions.

Primary surface: child-process filesystem reload plus checkpoint comparison.
Counterevidence: comparison depends on parent memory, silently repairs state or
accepts identity drift.

Observed evidence: exact and extension paths pass in a distinct process; identity
drift yields a typed hold. Verdict: `PASS` relative to the checkpoint presented
by the caller.

Named seam: PID distinction is harness evidence, not an independently operated
observer or authenticated host entrypoint.

## `relative_rollback_and_replacement_detection`

Claim: a missing checkpoint response or a different valid receiver-signed
response for the same challenge is detected relative to the presented checkpoint.

Kind: state comparison. Risk: high because detection can be overstated as
prevention.

Pass condition: deletion names the missing challenge digest; a valid changed
response names both prior and current digests; both classify as a review hold
with zero repair or other autonomous action.

Primary surface: adversarial local filesystem mutation followed by fresh or
strict recapture. Counterevidence: deletion/replacement is accepted as exact or
the module claims protected monotonic state.

Observed evidence: both cases are detected against the extended checkpoint.
Verdict: `PASS` for relative detection only.

Named seam: a controller able to alter or withhold both state and checkpoint can
defeat comparison. No rollback prevention, global single-use or pre-checkpoint
history proof exists.

## `absence_invalidity_and_authority_holds`

Claim: missing, invalid or identity-drifted current state remains visibly
distinct and grants no wider authority.

Kind: failure classification and authorization. Risk: high.

Pass condition: absence is not called empty history, invalidity is not called
absence, identity drift holds, and every result reports zero autonomous actions
and false execution, adoption, promotion, merge and `CANON` authority.

Primary surface: focused failure cases plus closed schemas and contract.
Counterevidence: a fail-open match/extension, hidden action or authority flag.

Observed evidence: all typed hold and truth-boundary checks pass. Verdict: `PASS`
for the bounded local route.

Named seam: caller time is untrusted and no host or party authentication exists.

## `external_retention_human_provider_outcome_and_canon`

Claim: this local checkpoint comparison proves independent retention or parties,
network or other-host transport, trusted time, durable protected storage, human
review, provider execution, evaluation, adoption, benefit, learning, promotion,
merge or `CANON`.

Kind: identity, transport, persistence, human judgment, outcome and governance.
Risk: high.

Pass condition: native evidence from the independently administered holder,
protected storage, trusted clock, human/provider/evaluation/outcome seats and an
explicit Mike Tobi / AXM gate decision.

Primary surface: those absent native systems and decision records.
Counterevidence: one synthetic controller owns state, checkpoint, keys, times and
processes and can remove both compared artifacts.

Observed evidence: exactly that counterexample; none of the external actions or
decisions occurred. Verdict: `UNKNOWN` and outside v1.4 acceptance.

Named seam: Mike Tobi remains merge and `CANON` gate.
