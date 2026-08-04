# axm.repair.heartbeat-lease-monitor

Treat heartbeats as expiring leases with missed-beat coalescing, clock-skew tolerance, and false-alarm controls.

**Maturity:** PROTOTYPED after local self-test only. Not independently VERIFIED.

**Overlap decision:** EXTEND_EXISTING — Encodes expiring-lease semantics, coalesced missed beats and clock-skew tolerance beneath the existing Heartbeat surface.

No mutation authority.
