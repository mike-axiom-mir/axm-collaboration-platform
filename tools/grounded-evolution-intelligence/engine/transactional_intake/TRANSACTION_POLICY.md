# AXM Transactional Three-Module Intake Policy

Package version: **0.6.0**
Status: **pre-merge rehearsal only**

## Core invariant

**OBSERVE -> VERIFY BYTES -> PREFLIGHT -> STAGE -> DIFF -> REVIEW -> COMMIT OR LEAVE BASELINE UNCHANGED**

A package may be useful signal even when it is not mergeable. The transaction layer therefore keeps two independent outcomes:

- **signal capture outcome** — may succeed for readable metadata or package structure;
- **active intake outcome** — may only advance when structural, contract, path, byte-integrity and collision gates pass.

## Atomicity rule

No canonical registry, graph, event history or CANON record is modified during rehearsal. A future commit implementation must write a complete new candidate state and swap it only after validation. Partial merge is forbidden.

## Package-byte rule

The SHA-256 declared by an intake manifest is never trusted by declaration alone. When an artifact is supplied, its actual bytes are hashed and compared. A mismatch rejects active intake but remains capturable as signal.

## Archive probe rule

ZIPs are inspected before extraction for:
- absolute paths;
- parent traversal (`..`);
- duplicate normalized paths;
- case-fold collisions;
- symbolic-link entries;
- encrypted entries;
- suspicious compression ratios;
- entry count and uncompressed-size bounds.

These checks reduce intake risk; they are not a security certification.

## Compatibility rule

The compatibility matrix reports exact contract compatibility, cross-module capability/interface resolution, module identity references, shared-record equality, collisions, and package-byte verification. Warnings are never silently upgraded into proof.

## Commit rule

Version 0.6.0 intentionally cannot commit the real three-module intake because Module 1 and Module 2 payload packages are not present in this checkpoint. `commit_eligible` therefore stays false in fixture rehearsals even when all current gates pass. This is deliberate no-fake-done behavior.
