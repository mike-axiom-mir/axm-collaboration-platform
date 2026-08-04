# axm.repair.idempotent-retry-wrapper

Retry only operations proven or guarded to avoid duplicate side effects.

Maturity: PROTOTYPED after authored self-test only.

Overlap: ADAPTER_BETWEEN_EXISTING — Retries only explicit idempotent operations and reuses a successful keyed result instead of duplicating side effects.
