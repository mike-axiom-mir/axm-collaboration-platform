# Review Inbox operation lease retirement v4.4 evidence

Status: `TEST`

This folder binds the bounded v4.4 seam at product commit
`309f0e397da6bb4c6a8fc409812f0bfc8c8db2c0` and tree
`5f11c51929a1424cea047313f21ffbb2443fb998`.

The seam adds an explicit host-local path for retiring exact Review Inbox
operation-lock evidence after an operator asserts that the holder terminated or
was abandoned. The plan is read-only. Retirement requires a closed request,
the current raw-owner digest, the exact digest-bound confirmation, and a
20–500-character reason. It writes intent evidence, rechecks the owner digest,
moves the raw lock bytes into evidence quarantine, verifies the digest, and
writes a typed result.

This is not safe automatic stale-owner recovery. The assertion is not an
authenticated fact; holder termination and retirement safety remain unproven,
and a false assertion can violate serialization. There is no browser or API
retirement route, process kill, liveness inference, execution, adoption,
promotion, merge, Foundation mutation, or `CANON` authority.

Verification passed 68/68 bounded commands with 6,253 focused assertions. A
clean archived 590-file product slice passed 10/10 selected commands without
changing tracked files. The primary evidence commit independently passed its
139-check selftest and 30-event seal replay from an exact compact archive. Mike
Tobi / AXM remains the merge and `CANON` gate.
Incoming `AXM_MIRROR_SHADOW_SPECIALIST` packages were not inspected or modified.
The broad grounded-growth objective remains active.
