# Code Capability Fabric policy binding v1.7 steward run

Status: `TEST`

This append-only receipt covers implementation commit
`8c6f311eebe18eda5f6318dbd8aaad7f7d37631d` on branch
`codex/code-capability-fabric-policy-binding-v1.7`, based on verified v1.6 tip
`8086599979e3382a99009365e418e8d8077af1cf`.

The run closes one narrow contract gap: the existing v2 request can now be
joined to an exact independent-assurance trust policy through a strict,
self-digesting policy-binding envelope. The envelope binds the complete
normalized request digest, exact trust-policy reference, assurance-schema set,
four-root order, and a bounded time window that must precede the assurance
signatures it governs.

The four AXM roots remain the technical acceptance gate in order: truth,
agency/non-domination, continuity, and wisdom over speed. Mike remains the
later human Git and policy-decision gate. The Fabric does not claim it can
authenticate Mike or infer consent from a file.

A valid result stops at `AUTHENTICATED_HUMAN_DECISION_REQUIRED` with authority
`NONE`. Structural binding proves relationships among exact records; it does
not prove requester authorship, human acceptance, organizational independence,
resource enforcement, or execution safety.

No existing Fabric source was modified. Six additive `TEST` files were added.
No supplied runtime, provider, executor, real private workspace, network,
installation, promotion, merge, or `CANON` path ran. Generated-source reuse
rights and any repaired disposable-sandbox executor remain deferred.

The receipt preserves the initial timestamp-parser test failure and the later
retrospective-binding audit finding. Repeated successful output is compacted to
command, count, warning, and verdict records rather than raw logs.
