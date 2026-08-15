# AXM Mirror organ-library handoff

Status: **TEST** (`NEEDS_REVIEW` before any runtime use)

This directory is the bounded, portable organ-library snapshot for the
`mirror` branch. It gives a platform builder an exact current organ map and
public source material without copying private Mirror state.

## Current snapshot

- Current organs: **115**
- Categories: **15**
- Export ID: `03f3d0cf0802a95bb5eccc8d42fc6c4422b85a1e5d3dc0373b4f3a3c6c13ab2a`
- Source catalog digest: `83438d8bb2fa2c16012c8ef8b0b97e8a816cf47a978cc1354595c00e79b5d6a2`
- Start at: `CURRENT.json`
- Library index: `packages/<export-id>/library.json`
- Human index: `packages/<export-id>/INDEX.md`
- Archive-module description and contract: `module/`

The platform's earlier 39-organ view was incomplete. This package supersedes
that view as a newer review snapshot, but it does not make any organ or module
canonical.

## Boundary

The package may be read, indexed, compared, and reviewed. It does **not** grant
authority to load, execute, connect, install, promote, canonize, or give an
organ permissions. Organ source files are inert material until a separate
review and explicit host authorization.

The export intentionally excludes specialist memory, private state,
checkpoints, historical versions, logs, receipts, raw verification output,
tokens, and secrets. The archive scan and export executed zero organs and made
zero runtime admissions.

One archived source (`code-clone-vm-executor-organ.js`) declares and exports a
static VM consent latch. It is a public sentinel rather than a credential, and
it does not override the required Linux marker, VM boundary checks, review, or
host authorization. Treat that organ as security-sensitive review material.

Repository-wide prose/status files can lag active work. For this handoff, use
`CURRENT.json` and the content-addressed package above as the exact snapshot.
Mike Tobi remains the merge and canon gate.
