# Session summary

Status: `TEST`

v2.3 adds a pure pairwise gate above the v2.2 anchored portable history
checkpoint. It exact-rebuilds the previous and candidate v2.2 packages, compares
normalized anchor and witness policy profiles, checks every v2.1 ledger identity
dimension, and compares the complete proposal and settlement reference histories.

The closed classifier distinguishes exact anchored-package replay, later
exact-history re-checkpoint, strict forward extension, anchor identity/profile
drift, witness identity/profile drift, ledger identity drift, presented time
rollback/collision, checkpoint-id equivocation, alternate anchoring of one
checkpoint, snapshot drift without history movement, strict history rollback,
and replacement or fork. Every classification was exercised by focused tests.

Two candidate ledgers were copied after one real settlement, then each received
a separately persisted second proposal/settlement with distinct identifiers.
Both candidates independently passed as forward extensions of the same previous
checkpoint. Comparing them directly exposed the fork. This proves that an
unpresented branch remains invisible and pairwise validity is not global
uniqueness or a globally consistent log.

A second counterexample replaced both checkpoint identities/digests, both
cryptographic policy layers, every key/signature, and both expected anchors. It
formed another internally valid forward pair. No authenticated original pin,
retention, protected monotonic state, rollback prevention, controller
independence, human participation, policy-rotation authority, or host authority
therefore follows.

All 39 recorded commands passed with 2,804 focused assertions, including all ten
AGENTS.md commands. Public receipts contain no raw keys, signatures, private
keys, or ledger paths. The runtime performs no writes, network calls, signing,
provider invocation, experiment, evaluation, permission change, adoption,
promotion, merge, or `CANON`. Browser verification is not applicable to this
nonvisual adapter.
