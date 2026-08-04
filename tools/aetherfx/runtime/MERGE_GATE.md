# Merge Gate

## Current decision

**ACCEPT FOR LOCAL INTAKE — VERIFIED WORKING v1.3.0 HANDOFF**

## Protected roots

- declarative portable modules and recipes
- stable module identity and semantic versions
- dependency visibility and cycle rejection
- no hidden guide output: generated stacks stay editable and inspectable
- import review before registry mutation
- raw validation before normalization, with explicit normalization review
- transactional package commit after complete graph validation
- bounded repair with a protection snapshot
- snapshots that include custom module definitions
- built-in replacement protection
- required SHA-256 integrity for sealed packages
- bounded renderer inputs, graph depth, and generated-layer counts
- explicit provenance, licence review, and integrity
- accessibility, photosensitive-safe behavior, and performance fallbacks
- local-first operation and portable exports
- derived and composite creation without flattening
- one canonical resolved-intent contract with explicit target support reporting

## Changes that require migration evidence

- schema identifiers or required fields
- module ID renames
- parameter removal or semantic change
- package integrity algorithm changes
- normalization behavior that could change a submitted recipe without review
- renderer behavior that executes package-supplied code
- adapter behavior that silently drops an unsupported operation
- repair logic that deletes custom definitions silently
- storage behavior that moves work off-device

## Next merge preference

Integrate the fabric into one real AXM product surface and report the adapter gaps found there. Regenerate verification whenever source changes. Prefer evidence, migration paths, and targeted repairs. Reject volume-only growth that weakens readability, performance, traceability, or user control.
