# Grounded-growth frontier audit — Review Inbox retirement stage archival v5.1

Status: `TEST`

v5.0 made retirement JSON publication process-crash-consistent but left residual stages indefinitely active. Its aggregate status validated filenames only: 200 syntactically valid names remained visible, the 201st held the status, and `{}` payloads with valid names still appeared staged. There was no exact plan or archival entry point.

v5.1 adds an exact read-only plan for one lowercase stage filename. It validates the intent, decision, or result JSON against its retirement id, computes the exact digest, and classifies the authoritative target and archive. Conflicting, invalid, oversized, unreadable, missing, uppercase, and path-shaped evidence stays held.

Archival requires the exact plan digest, a closed publisher-terminated-or-abandoned assertion, a filename/digest confirmation, and a reason. It creates an exclusive same-filesystem hard link in a separate archive, verifies those exact bytes, and only then removes the active stage pathname. It never writes the authoritative target or owner lock. Nine real process exits exercise all three archive checkpoints for all three artifact types; reentrant and two-process callers converge.

This is lossless archival. It does not delete the bytes, reclaim space, bound archive retention, record durable authorization, authenticate the actor, infer liveness, or make a false assertion safe. A false assertion can interrupt a live publisher. There is no hard-link-free fallback, power-loss durability, cross-file atomicity, multi-host/network-filesystem safety, or noncooperating-writer exclusion.

All 21 scoped commands pass: eleven focused commands with 930 assertions or controls and the ten required AGENTS.md checks. A clean 108-file product slice replays all focused commands without tracked-byte mutation. Aggregate `npm run test:operations` remains `FOREIGN_FAILURE` after reaching the product checks because `intakes/verification-proof-99-v0.1` is still absent and unchanged by this lane.

The regenerated tools index keeps Review Inbox promotion `BLOCKED` because its persisted promotion result is stale for the changed v1.3 self-test digest. Passing scoped checks does not silently refresh or promote that evidence.

No browser-facing file changed and no browser render/click test is claimed. No real human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` evidence is claimed. Mike Tobi / AXM remains the merge and `CANON` gate, and the broad grounded-growth objective remains active.
