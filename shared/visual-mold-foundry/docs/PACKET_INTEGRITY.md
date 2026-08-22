# PACKET INTEGRITY — v0.9.1

## Covered packets

Deterministic FNV-1a-32 fingerprints are attached to render, token, skin, mold, theme, extension, workspace, family, project, batch, safety-capsule, rescue, health, and other governed packets where applicable.

## Current import and restore requirement

v0.9.1 treats current workspace, family, project, batch, safety-capsule, and rescue packets as sealed: integrity verification must return `PASS`. A missing or mismatched fingerprint blocks import or restore before mutation.

Theme and extension packages retain their governed quarantine and validation rules. Rollback snapshots and Project Composer revisions verify their recorded fingerprint before restoring state.

## What a fingerprint proves

It can show that packet content no longer matches the content used to calculate the recorded fingerprint. This is useful evidence of accidental corruption.

## What it does not prove

FNV-1a-32 is non-cryptographic and collision-prone. It is not a digital signature and does not prove identity, authorship, trusted origin, or resistance against an attacker who can rewrite both content and fingerprint.

## Package-file integrity

`FILE_MANIFEST_SHA256.txt` is a separate release-file mechanism. Launch diagnostics verify each listed hash and exact coverage for the defined manifest scope; missing, changed, duplicate, unsafe, symlinked, or unlisted in-scope files fail diagnostics.

SHA-256 manifest checking still is not an authenticated signature by itself. Use a separately trusted signing/distribution workflow when authenticated provenance is required.
