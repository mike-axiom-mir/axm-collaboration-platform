# Safety Capsule Restore — v0.9.1

## Stage first

Loading a capsule performs no write. Staging checks:

- supported schema;
- outer packet integrity;
- embedded workspace presence;
- each restorable raw area;
- raw fingerprints;
- JSON validity and expected shape;
- current-versus-capsule differences.

Current `axm.safety-capsule/0.8` packets require valid outer and raw-area FNV-1a-32 fingerprints before restore. Legacy `0.7` records may be recognized for compatibility, but they do not represent the current sealed-packet guarantee and should be replaced with a current export.

## Merge mode

Merge mode passes the embedded workspace through the normal workspace importer. The current workspace packet must have valid integrity. Imported extensions and themes remain quarantined; projects and batches remain drafts where their import rules require it.

## Replacement mode

Replacement mode writes capsule values into the current v0.9 restorable keys:

- presets;
- candidates;
- snapshots;
- extensions;
- themes;
- projects;
- batches;
- settings.

It does not replace recovery, transactions, migration, or rescue records.

## Rescue before restore

Both restore modes create a compact rescue point first. Current rescue packets require valid integrity. Rescue restoration creates another guard rescue point before applying the selected point.

## Failure behavior

If integrity, raw validation, required persistence, or post-restore health fails, the managed storage transaction restores the pre-restore state and reports failure. It does not continue with a false success claim.

## Backup and trust boundary

FNV-1a-32 is non-cryptographic and collision-prone; it is accidental-corruption evidence, not a signature. Rescue points and browser storage share the active browser profile and origin. Export capsules to independent storage because neither browser storage nor the rescue ring is a durable backup.
