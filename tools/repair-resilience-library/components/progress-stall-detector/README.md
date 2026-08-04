# axm.repair.progress-stall-detector

Detect work that is alive but no longer making declared progress, including hangs, deadlocks, and stuck queues.

**Maturity:** PROTOTYPED after local self-test only. Not independently VERIFIED.

**Overlap decision:** EXTEND_EXISTING — Adds progress semantics distinct from liveness; no restart authority.

No mutation authority.
