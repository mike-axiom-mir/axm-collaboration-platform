# AXM Discovery Root

This is the canonical public front door for understanding AXM Workshop. It is
written for people, researchers, search systems, and future steward runs.

## What AXM is

AXM is a local-first modular Workshop where human and machine users can create,
play, inspect, verify, repair, and coordinate through explicit contracts. It is
an experimental body of interoperable tools and shared systems, not a single
AI model, an autonomous authority, or a production-certified operating system.

## Five capability families

1. **Create and build** - assets, games, audio, film, motion, spatial work,
   documents, research, code recipes, and reusable components.
2. **Play and worlds** - local games, controllers, world state, simulation,
   rules, maps, and game-building foundations.
3. **Evidence, repair, and governance** - tests, readiness, provenance,
   diagnostics, recovery, rollback, review, permissions, and explicit stops.
4. **Human-machine collaboration** - optional AI seats, typed handoffs,
   identity boundaries, technical maps, and shared capability routing.
5. **Local operations and delivery** - packaging, publishing, heartbeat,
   updating, source-control review, resource metrology, and bounded automation.

These families are navigation aids, not claims that every member is complete.
Read each module's status, contract, tests, and limitations.

## Machine-readable discovery spine

- [`registry/public-status.json`](registry/public-status.json) - current public
  gates and deliberately unclaimed properties.
- [`registry/modules.json`](registry/modules.json) - module paths, manifests,
  contracts, tests, readiness, and blockers.
- [`registry/capabilities.jsonl`](registry/capabilities.jsonl) - declared
  provider/consumer relationships, one JSON object per line.
- [`registry/proofs.json`](registry/proofs.json) - claim-to-evidence routing and
  what each proof cannot establish.
- [`tools-index.json`](tools-index.json) - deeper generated readiness inventory.

For a compact human view, read [AXM Capability Map](AXM_CAPABILITY_MAP.md). AI
and research systems should then follow [AI Start Here](AI_START_HERE.md).

## Status language

AXM uses `EXPERIMENTAL`, `TEST`, `WORKING`, `CANON`, `SHELL`, and `BROKEN`.
Declarations and passing self-tests do not grant authority or canonize a
module. Mike Tobi remains the human merge gate for the public repository.

## Public/private boundary

The public snapshot excludes private state, logs, saves, sessions, backups,
projects, tokens, caches, downloaded runtimes, and raw operational history. A
deterministic public-safety scan is required for the exact outgoing digest.
Mirror's private learning state, corpus, weights, and training runtime are not
part of this public Workshop.

## Start and proof

- Windows start: [README](README.md#start-in-five-minutes-windows)
- Exact release gates and limitations: [STATUS](STATUS.md)
- Contributor rules: [AGENTS](AGENTS.md) and [Contributing](CONTRIBUTING.md)
- Security boundary: [Security](SECURITY.md)
- License boundary: [License Status](LICENSE_STATUS.md)

The public source is meant to be inspectable. Important architecture and proof
routes are plain Markdown and JSON rather than hidden only inside archives.
