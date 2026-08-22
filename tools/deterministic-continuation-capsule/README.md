# AXM Deterministic Continuation Capsule

This CLI turns a small explicit declaration and exact linked source digests into
a path-independent continuation capsule and compact resume card. It is intended
to reduce context reconstruction for later local AXM/Codex instances without
turning conversation logs or hidden memory into authority.

The declaration classifies every source. `PRIVATE_OR_USER_SOURCE`, raw or
repetitive telemetry, temporary captures, and unclassified material are refused.
Source content and machine input paths are never copied into the capsule.
The adapter cannot independently prove that manually declared semantic text is
non-private, so declarations still need privacy review before wider sharing.

Volatile GitHub, process, or workspace facts must be marked
`REPROBE_REQUIRED`. Reverification proves stored files still match; it
deliberately does not convert that into external freshness.

The module references `axm.memory.reentry-capsule` and
`axm.memory.session-handoff-packet` from the Memory & Continuity Garden. Those
remain reference-only candidates. This adapter grants no `memory.handoff`,
action, permission, promotion, roots, or CANON authority.
