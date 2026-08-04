# LINEAGE, COMPARISON, AND ROLLBACK — v0.6

## Root and sparse package molds

Root manifests contain complete protected contracts. A sparse child source records its parent plus identity, provenance, preview, and explicit overrides. The registry builder resolves children deterministically and rejects missing parents or inheritance cycles.

## Presets

Presets reference a mold and store sparse instance overrides. Saving a preset does not rewrite the mold source.

## Candidates, themes, and extensions

- candidates preserve parent lineage and remain experimental until explicit approval;
- local themes preserve base-theme lineage and start in quarantine;
- promoted or imported extensions preserve origin evidence and start in quarantine;
- activation remains a separate release decision.

## Snapshots

Snapshots contain mold ID, controls, variants, timestamp, reason, and a stable state fingerprint. They are treated as immutable local records.

## Comparison

The Preview Lab compares current and saved states through:

- side-by-side visual rendering;
- a structural path diff with before/after values.

## Rollback

Restoring a snapshot first records the current state as `before-rollback`, so the rollback does not destroy the point from which the user returned.

Snapshots targeting inactive extensions remain intact but are blocked from restoration until that extension is active again.

## Portable lineage

Workspace and family imports remap incoming local theme and extension IDs, update dependent references, preserve lineage evidence, and quarantine imported growth. No imported record silently replaces an existing local ID.
