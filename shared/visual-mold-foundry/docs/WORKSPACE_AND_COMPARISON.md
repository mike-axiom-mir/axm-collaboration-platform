# WORKSPACE BACKUP AND COMPARISON — v0.6

## Workspace packet

A workspace export contains:

- local presets and Foundry candidates;
- local themes and extensions;
- snapshots and settings;
- currently selected mold, controls, and variants;
- schema/version, timestamp, and integrity fingerprint.

Arbitrary uploaded media binaries are not embedded.

## Merge-only import

- current local records remain present;
- incoming records receive new IDs;
- local theme IDs are remapped first;
- extension and preset references are then remapped;
- imported themes and extensions enter quarantine;
- unsafe, malformed, oversized, or fingerprint-mismatched packets are rejected.

This prevents a workspace packet from silently rewriting active local history.

## Snapshot comparison

The Preview Lab renders current and saved states side by side and produces a path-level structural diff. Comparison changes no state. Rollback creates a fresh `before-rollback` snapshot before restoration.

## Workspace versus family package

- **Workspace:** broad local-session backup.
- **Family package:** focused mold-centered transfer with related local growth.


## v0.6 workspace assembly records

Workspace packets now include visual projects and data batches. Their extension and theme references are remapped through the same merge-only import path. Imported projects and batches enter draft state.
