# axm.repair.retry-budget-manager

Bound retries across layered callers to prevent retry storms and hidden load amplification.

Maturity: PROTOTYPED after authored self-test only.

Overlap: ADAPTER_BETWEEN_EXISTING — Bounds retries across global, dependency, and operation scopes to prevent layered retry storms.
