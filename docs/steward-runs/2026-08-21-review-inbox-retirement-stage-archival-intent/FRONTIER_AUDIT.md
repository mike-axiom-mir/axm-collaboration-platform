# Grounded-growth frontier audit — Review Inbox archival intent v5.2

Status: `TEST`

v5.1 made residual retirement-publication archival exact and lossless, but its operator assertion and reason existed only in the immediate return value. The exact baseline reproduces that missing durable record: archival succeeds, the active stage disappears into the archive, and no intent or persisted reason exists.

v5.2 publishes a closed append-only archival intent before new archive linking or active-stage unlink. Its request digest binds the schema, stage filename and digest, assertion, confirmation, and reason; the record also carries artifact target and observed target classification. Complete intent bytes are fsynced in a private same-filesystem stage before exclusive hard-link publication. Conflicting, corrupt, unreadable, self-inconsistent, or over-bound evidence holds.

Six real process exits cover pre-intent-link and post-intent-link for intent, decision, and result stages. Nine inherited archive exits cover the three archive checkpoints. Reentrant and two real cooperating processes converge. Legacy v1.3 archives and archive-link checkpoints without intent remain authorization-unknown: no retrospective intent is fabricated, and an active legacy checkpoint stage is not unlinked.

The intent records a request; it does not authenticate its actor, establish consent or permission, prove publisher termination or liveness, or make a false assertion safe. Reasons should contain no secrets. The mechanism does not delete bytes, reclaim space, bound archive retention, provide protected or monotonic storage, offer a hard-link-free fallback, prove power-loss durability or cross-file atomicity, or exclude multi-host, network-filesystem, or external writers.

All 21 scoped commands pass: eleven focused commands with 1,110 assertions or controls and the ten required AGENTS.md checks. A clean dependency-slice replay passes all focused commands without tracked-byte mutation. The current Review Inbox promotion selftest digest passes and the tools index says READY_FOR_HUMAN_REVIEW; twelve other promotion selftests remain nonpassing. Aggregate test:operations remains FOREIGN_FAILURE at the unchanged absent curated verification intake.

No browser-facing file changed and no browser render/click test is claimed. No authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or CANON evidence is claimed. Mike Tobi / AXM remains the merge and CANON gate, and the broad grounded-growth objective remains active.
