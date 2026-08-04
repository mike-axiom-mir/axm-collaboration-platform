# axm.repair.circuit-breaker

Stop repeated calls to an unhealthy dependency and probe for recovery without flooding it.

Maturity: PROTOTYPED after authored self-test only.

Overlap: ADAPTER_BETWEEN_EXISTING — Provides a bounded state machine; callers must explicitly route calls through it.
