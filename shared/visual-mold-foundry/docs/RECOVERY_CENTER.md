# Recovery + Intake — AXM Visual Mold Foundry v0.9.1

## Storage audit

Every managed browser-storage area is parsed and checked for its expected top-level shape. Malformed raw data remains untouched and is recorded in the recovery ledger.

Required persistence failures throw. A governed mutation does not report success after a failed write.

## Import transactions

Governed import routes capture managed storage and active state before mutation. Persistence, validation, or other uncaught failure restores the pre-import values and records `ROLLBACK`.

## Safety capsules

A safety capsule contains:

- full workspace;
- health report;
- storage audit;
- raw managed storage values except recursive rescue data;
- rescue summaries;
- session log;
- integrity fingerprint.

Current safety-capsule packets require valid integrity before restore. See `SAFETY_CAPSULE_RESTORE.md` for restoration behavior.

## Rescue points

The rescue ring retains the five newest compact points. A point excludes recovery, transaction, migration, and rescue ledgers. Current rescue packets require valid integrity before restore.

Snapshots and Project Composer revisions also verify their own recorded fingerprint before rollback.

## Explicit reset

A corrupt storage area can be reset only after its raw value is exported and the user types `RESET` exactly.

## Intake gate

The same area hosts the Intake Readiness Gate and local-intake handoff export. See `INTAKE_READINESS_GATE.md`.

## Local storage boundary

Browser storage and rescue points are origin-specific working state, not durable backups. Port 8765 is the stable default localhost origin; a non-default port and direct-file mode use separate workspaces. Export safety capsules to independent storage.

FNV-1a-32 integrity is non-cryptographic and collision-prone. It is accidental-corruption evidence only, not a digital signature.
