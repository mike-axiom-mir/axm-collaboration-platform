# Deterministic Continuation Capsule

This bounded adapter compiles declared goals, decisions, open loops, authority
boundaries, and exact source digests into a compact local continuation capsule.
It embeds no source content and marks volatile external facts
`REPROBE_REQUIRED` even when their stored digests still match.

It references the Memory & Continuity Garden's `axm.memory.reentry-capsule` and
`axm.memory.session-handoff-packet` candidates. It does not activate them,
implement private memory, grant `memory.handoff`, or claim CANON.
