# v3.6 anchored review-outcome history pairwise-ledger evidence

Status: `TEST` / `DEGRADED`

This folder binds the v3.6 source snapshot, deterministic capability comparison,
54-command verification receipt, five claim-to-evidence routes, and a sealed
ordered session segment. It retains semantic outcomes and digests rather than
raw command logs, synthetic ledger state, public keys, signatures, paths,
private context, or model output.

The bounded result serializes only exact v3.5 forward receipts beneath one
explicit caller-owned local root. Successful return requires exclusive sequence
creation, file `fsync`, and exact postwrite reload. The evidence also directly
shows the limit: independent roots can accept divergent branches, deletion or
rollback can reopen an older head, and a failed file `fsync` can still leave an
inspectable entry.

This is local serialization evidence only. It is not authenticated host, actor,
human, policy, or origin evidence; external retention, protected monotonic
state, directory or hardware durability, global uniqueness, withheld-branch
exclusion, benefit, learning, execution, adoption, promotion, merge, or `CANON`
evidence.

Browser verification is not applicable because no browser surface changed.
Independent Draft 2020-12 schema meta-validation is unrun because no validator
is installed; focused tests cover exact runtime validation and recursively
closed local schema topology.

Mike Tobi / AXM remains the merge and `CANON` gate.
