# axm.repair.write-ahead-journal

Record intended repair steps before execution so interrupted repair can resume, compensate, or roll back.

Maturity: PROTOTYPED after authored local self-test only.

Overlap: ADAPTER_BETWEEN_EXISTING — Adds a caller-scoped hash-chained intent journal; existing systems remain storage and recovery authorities.
