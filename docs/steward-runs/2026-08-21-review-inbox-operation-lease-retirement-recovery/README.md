# Review Inbox interrupted lease-retirement recovery v4.5 evidence

Status: `TEST`

This folder binds the bounded v4.5 seam at product commit
`e3c131254dd3d23fc053b2802d4bb39dd0a75a0f` and tree
`277940971097ee7114e0bbe7c0f7eee8138b8268`.

Exact v4.4 code was interrupted at both non-atomic retirement windows. One
fixture retained intent plus the matching lock; the other retained intent and
quarantined owner bytes but no result. v4.4 exported no recovery status or
method for either state.

v4.5 adds a bounded read-only classifier and an explicit host-local recovery
request. Intent-only recovery requires unchanged current owner bytes. Result
finalization requires exact quarantined owner bytes. Both require a second
closed action/id/digest/assertion/confirmation/reason request. Changed,
ambiguous, current-process, malformed, oversized, non-file, unrecognized, and
digest-mismatched evidence stays held.

Verification passed 69/69 scoped commands and 6,378 focused assertions. A clean
archived 594-file product slice passed 11/11 selected commands without changing
tracked files. The primary evidence commit independently passed its 158-check
selftest and 37-event seal replay from an exact 30-file compact archive. The
separate aggregate operations script remains a recorded
`FOREIGN_FAILURE`: its unchanged verification-proof service requires a curated
intake directory absent from both baseline and product Git trees.

This is not automatic stale-owner recovery. Holder termination and recovery
safety remain unproven, and a false assertion can violate serialization. There
is no API/browser recovery route or execution, adoption, promotion, merge,
Foundation mutation, or `CANON` authority. Mike Tobi / AXM remains the merge
and `CANON` gate. Incoming `AXM_MIRROR_SHADOW_SPECIALIST` packages were not
inspected or modified. The broad grounded-growth objective remains active.
