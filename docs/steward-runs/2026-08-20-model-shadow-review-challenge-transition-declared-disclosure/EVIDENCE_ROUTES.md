# Evidence routes

Status: `TEST`

## `declared_roster_commitments`

Claim: a caller roster deterministically binds each unique declared member label
to one unique exact v0.9 presentation reference.

Kind: static structure and deterministic behavior. Risk: medium.

Pass condition: two-to-sixty-four member inputs exact-rebuild; order normalizes;
duplicate labels, duplicate references, wrong schemas, and oversized inputs are
refused.

Primary surface: focused deterministic assertions. Counterevidence: two distinct
inputs with the same normalized roster alter the digest, or a duplicate is
accepted.

Observed evidence: exact rebuild, duplicate/schema refusals, 64-member maximum,
and canonical-byte refusal pass. Verdict: `PASS` for caller-declared data.

Named seam: the caller roster is not an authenticated root registry.

## `declared_commitment_coverage`

Claim: missing declared submissions and valid submissions that differ from their
declared presentation commitment are separately observable.

Kind: deterministic behavior. Risk: medium.

Pass condition: absence lists the exact declared label; a valid alternate
presentation lists both expected and submitted references; either causes a hold.

Primary surface: focused missing/mismatch fixture matrix. Counterevidence: an
absent or mismatched commitment produces complete coverage.

Observed evidence: missing and mismatched cases produce distinct bounded fields
and the same typed incomplete-coverage hold. Verdict: `PASS` relative to the
supplied roster.

Named seam: absence does not prove intentional withholding and no disclosure is
actually compelled.

## `declared_set_all_pairs`

Claim: every unordered pair of matching declared commitments is reconciled by
the v0.9 exact presentation route.

Kind: deterministic behavior. Risk: medium.

Pass condition: `n` matching submissions produce `n*(n-1)/2` pair references;
prefix-compatible sets remain bounded-compatible and any v0.9 contradiction
creates a declared-set hold.

Primary surface: two- and three-member semantic fixtures plus the 64-member
bound. Counterevidence: a pair is omitted, a fork becomes compatible, or the
maximum produces other than 2,016 pairs.

Observed evidence: one-pair prefix, one-pair fork, three-member mixed matrix, and
64-member/2,016-pair replay matrix pass. Verdict: `PASS` for matching submitted
commitments within declared bounds.

Named seam: pairwise compatibility is not consensus, total order, or branch
adoption.

## `unlisted_root_exclusion`

Claim: complete declared commitment coverage proves no unlisted root exists.

Kind: transport, authorization, and global consistency. Risk: high.

Pass condition: an authenticated append-only registry and independently received
disclosures account for every authorized root.

Primary surface: independent registry and receiver receipts. Counterevidence: an
exact valid presentation exists but its commitment is absent from the roster.

Observed evidence: the unlisted presentation exact-rebuilds and its digest is
absent from a complete compatible receipt. Verdict: `FAIL` as a global claim;
intentionally not a v1.0 acceptance condition.

Named seam: callers can omit roots before constructing the roster.

## `fresh_process_rebuild`

Claim: a fresh process rebuilds the same roster and assessment from serialized
caller-retained data.

Kind: persistence/reload of caller-retained data. Risk: medium.

Pass condition: child-process roster and receipt verification pass with identical
classification and assessment digest.

Primary surface: separate Node process. Counterevidence: failed verification or
digest/classification mismatch.

Observed evidence: all four fields match. Verdict: `PASS` for the serialized
caller package.

Named seam: no independent receiver or external retention receipt exists.

## `authority_and_outcomes`

Claim: this receipt authenticates members, compels disclosure, authorizes a host,
adopts a branch, proves benefit, or records learning.

Kind: authorization, human participation, learning improvement, and quality.
Risk: high.

Pass condition: independent allowed/denied identity evidence, authenticated
registry and receiver receipts, actual steward review/adoption, provider
evaluation, and voluntary held-out human outcome evidence.

Primary surface: host/registry audit trails, independent receiver receipts, real
review/adoption receipt, provider evaluation, and human outcome evidence.
Counterevidence: synthetic fixtures and zero external actors.

Observed evidence: none was supplied or invoked. Verdict: `UNKNOWN`.

Named seam: Mike Tobi remains merge and `CANON` gate.
