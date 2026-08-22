# Evidence routes

Status: `TEST`

## `complete_presentation_rebuild`

Claim: every presented v0.8 entry and upstream transition package is exact
before its bounded reference enters a presentation receipt.

Kind: deterministic behavior and static structure. Risk: medium.

Pass condition: exact manifests and packages rebuild; entry tampering, package
tampering, broken order, early time, and oversized presentations are refused.

Primary surface: focused deterministic assertions. Counterevidence: a tampered
item produces a valid presentation or raw package material appears in receipt.

Observed evidence: exact cases pass and adversarial cases fail. Verdict:
`PASS` for caller-presented packages up to declared bounds.

Named seam: presentation does not prove caller filesystem retention.

## `pairwise_history_relation`

Claim: two exact presentations are classified as replay, left prefix, right
prefix, or a typed co-presented contradiction.

Kind: deterministic behavior. Risk: medium.

Pass condition: exact histories produce the expected relation and exact common
prefix/divergence sequence; receipt rebuild is deterministic.

Primary surface: focused fixture matrix. Counterevidence: wrong relation,
wrong common-prefix count, or missing divergence references.

Observed evidence: replay, both prefixes, first- and second-entry forks,
entry-id equivocation, alternate records, log drift, and genesis drift pass.
Verdict: `PASS` for the two presented histories.

Named seam: prefix consistency grants no adoption authority.

## `fresh_process_rebuild`

Claim: a fresh process rebuilds the same reconciliation from serialized caller
data.

Kind: persistence/reload of caller-retained data. Risk: medium.

Pass condition: child process rebuild and verification pass with identical
receipt digest.

Primary surface: separate Node process. Counterevidence: failed verification
or digest mismatch.

Observed evidence: child rebuild and digest equality pass. Verdict: `PASS` for
the serialized package.

Named seam: no independent receiver or external retention receipt exists.

## `all_root_fork_exclusion`

Claim: pairwise reconciliation proves no other root or history exists.

Kind: transport and global consistency. Risk: high.

Pass condition: authenticated multi-party disclosure or a transparent globally
consistent log accounts for every authorized root.

Primary surface: independent receiver/log receipts. Counterevidence: a third
valid history exists but is not presented.

Observed evidence: the third history exact-rebuilds and its head is absent from
the A-C versus A-D receipt. Verdict: `FAIL` as a global claim; intentionally not
a v0.9 acceptance condition.

Named seam: withheld roots remain invisible.

## `authority_and_outcomes`

Claim: reconciliation authenticates a host or human, adopts a branch, or
improves outcomes.

Kind: authorization, human participation, learning improvement, and quality.
Risk: high.

Pass condition: independent allowed/denied host evidence, actual steward
review, explicit adoption decision, held-out evaluation, and voluntary human
outcome evidence.

Primary surface: host audit trail, real review/adoption receipt, provider
evaluation, and human outcome evidence. Counterevidence: synthetic fixtures and
zero external actors.

Observed evidence: none was supplied or invoked. Verdict: `UNKNOWN`.

Named seam: Mike Tobi remains merge and `CANON` gate.

