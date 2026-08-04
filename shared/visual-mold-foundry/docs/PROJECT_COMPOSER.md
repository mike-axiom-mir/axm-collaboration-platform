# PROJECT COMPOSER — v0.6 schema / v0.9.1 behavior

## Purpose

Project Composer turns individual visual mold instances into an ordered, reusable visual set without flattening their mold lineage.

## Project states

```text
DRAFT → APPROVED → ARCHIVED
```

An unchanged approved project remains approved. Any content, order, layout, or shared-theme change returns it to `DRAFT` and preserves a revision. Archiving an approved project preserves the explicit `ARCHIVED` state.

Missing, inactive, or incompatible mold/theme dependencies block approval.

## Limits

- 100 items per project;
- eight retained revisions;
- embedded media above roughly 6 MB produces a warning.

An over-limit project mutation, import, materialization, or export is rejected rather than silently sliced.

## Project item

Each item records:

- mold ID;
- semantic controls;
- variant selection;
- label and note;
- explicit order.

## Composition layouts

- **Gallery** — responsive visual collection.
- **Story flow** — vertically sequenced narrative.
- **Presentation deck** — one large visual per print/screen section.

## Revisions

Up to eight prior full project states are retained. Restoring a revision first requires its recorded fingerprint to be present and match the saved project state. A missing or mismatched fingerprint blocks rollback. A valid restore creates a new draft and first preserves the current state as a pre-rollback revision.

## Packages

A project package contains:

- project state and ordered items;
- validation evidence;
- local theme dependencies;
- local extension dependencies;
- deterministic integrity fingerprint.

Current project packages require a valid integrity fingerprint before dependency import or save. Imported records receive new local IDs. Imported local themes/extensions enter quarantine. Imported projects remain `DRAFT`.

Dependency arrays are capped at 100 records per type before import.

Persistence failure throws; a failed save is not followed by a success claim. A surrounding governed transaction rolls back.

## HTML export

The HTML export is self-contained, static, and script-free. It contains browser-rendered visual snapshots rather than an executable editor.

FNV-1a-32 packet and revision fingerprints are non-cryptographic and collision-prone. They are accidental-corruption evidence only, not signatures or proof of trusted origin.
