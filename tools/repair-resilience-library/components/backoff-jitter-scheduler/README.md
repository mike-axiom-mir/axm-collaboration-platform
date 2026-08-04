# axm.repair.backoff-jitter-scheduler

Spread bounded retries and periodic recovery work to avoid synchronized overload.

Maturity: PROTOTYPED after authored self-test only.

Overlap: ADAPTER_BETWEEN_EXISTING — Produces deterministic bounded jitter schedules so local callers do not synchronize.
