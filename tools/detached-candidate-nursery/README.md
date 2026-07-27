# AXM Detached Candidate Nursery

This integrated `TEST` module inventories detached candidates. It is installed and registered without new permissions or CANON authority.

## Why it exists

AXM can now keep growing locally while intake is deferred. That creates a useful new boundary: candidate folders should remain discoverable and byte-verifiable without silently entering Module Installer state.

The Nursery fills that pre-intake seam:

- Agent Tool Forge creates individual drafts.
- Growth Metrics records aggregate Workshop growth.
- Evidence Retention preserves evidence history.
- Foundation Intake Steward owns its bounded 100-piece catalog.
- Module Installer starts governed staging and review.
- The Nursery only inventories detached candidate folders before any of those intake effects.

## Candidate labels

- `DRAFT`: manifest and contract may exist, but no exact bundle is present.
- `NEEDS_REPAIR`: required data is invalid, unsafe, incomplete, or has drifted from its bundle.
- `REVIEW_REQUIRED`: structure passes but a missing or incomplete authority receipt needs attention.
- `READY_FOR_LATER_INTAKE`: manifest, contract, entry, receipt, and exact bundle match structurally.

Ready for later intake does not mean runtime-ready, visually approved, safe for deployment, promoted, or CANON.

## Read-only scan

```text
node nursery-cli.js --root /path/to/axm_module_candidates
```

Create portable registry files only when explicitly wanted:

```text
node nursery-cli.js \
  --root /path/to/axm_module_candidates \
  --exclude-folder detached-candidate-nursery \
  --exclude-archive AXM_Detached_Candidate_Nursery_EXPERIMENTAL_2026-07-25.zip \
  --output current-registry.json \
  --browser-output current-registry.js \
  --quiet
```

The detached Nursery excludes its own folder and final ZIP from the generated snapshot because a bundle cannot truthfully contain a verdict over its own final bytes or archive. Both exclusions remain explicit in the registry. Its exact bundle and ZIP are instead inspected externally by the established Module Installer and archive checks.

## What is checked

- safe top-level candidate folders;
- no followed symlinks;
- required manifest, contract, and entry;
- manifest-contract id, version, permissions, lifecycle, and boundary shape;
- `axm.module-bundle/v1` paths, encodings, sizes, and file digests;
- exact parity between every bundled file and the current candidate folder;
- explicit detached authority fields in `candidate.receipt.json`;
- sibling ZIP bytes and SHA-256 without archive extraction.

Candidate code is never executed during a nursery scan.

## Verification

```text
node selftest.js /path/to/axm_module_candidates
node build-bundle.js
```

The smallest later intake action is to let Mike accept or correct a candidate, then stage only its exact bundle through Module Installer. The Nursery never calls that action itself.
