# AXM AI-Team Collaboration — curated local intake

This lane preserves the useful, current portion of the supplied Steward Runs 01–101 archive without importing its repeated historical batches into AXM.

## Retained

- the complete cumulative v0.7 deterministic proof harness;
- the original 100-seed source;
- the final Run 101 records and manifest;
- final coverage, lineage, action-report, archive-audit, and checksum provenance.

The retained source set contains 395 files (9,533,583 bytes). It keeps only 58 bytes of duplicate placeholder output because the latest cumulative harness expects those historical evidence paths. The full source archive contained 1,621 redundant copies across 355 hash groups (18,161,477 redundant bytes).

## Integrated AXM surface

`tools/ai-team-steward-lab` provides a searchable 100-seed catalog, builds bounded review-only stewardship plans, executes deterministic local contract preflight, and exposes fifty-eight useful read-only collaboration operations. The preflight runtime reuses all 100 retained passing fixtures, all 100 retained unsafe fixtures, and the ten source family-validator semantics. The operation runtime ports retained authority, handoff, deadlock, merge, resource, privacy, join, recovery, proof, offline, compatibility, contestability, freshness, quorum, revocation, topology, reconciliation, migration, observability, human-gate, impact-planning, incident, queue, compare-and-swap, proof-graph, orchestration, and saga implementations to portable JavaScript. It is embedded as a view in the existing AXM AI Team.

Each seed can now return a real local `PASS` or `HOLD` with error codes and repair guidance for a supplied collaboration packet. The fifty-eight operation results are calculations, proposals, or bounded one-request in-memory simulations and are never automatically applied or persisted. The integration does not start agents, contact providers or connectors, grant authority, apply a plan, approve a merge, judge result quality, change CANON, or claim that the 100 seeds are live agent implementations. Preflight responses never echo private payload values; the explicit privacy-filter operation returns only fields allowed by its supplied policy.

Runner, registry, scenario, fixture, and test-only plumbing remains source evidence rather than public operations. Filesystem/archive mutation, secret-bearing signing, persistent stateful runtimes without an AXM lifecycle owner, and internal helpers already composed inside higher-level operations are deliberately held instead of being exposed through the browser workbench.

`CAPABILITY_GAP_REPORT.json` records the remaining boundary. Required local intake use and safety requirements are `READY`; live provider-backed agent execution remains an optional external gap that needs separately configured providers, sender/receiver receipts, explicit authority, and its own verification.

## Verification

```powershell
npm.cmd run test:ai-team-steward
npm.cmd run test:ai-team-steward:source
```

The first command includes a 200-fixture runtime parity check (100 passing fixtures and 100 held unsafe fixtures) plus 111 independent READY/HOLD comparisons between the JavaScript operation runtime and the retained Python implementations. The second command runs the source v0.7 finalization harness and all 154 source unit tests. These tests prove deterministic local contract behavior only; they do not prove live model, connector, device, network, human-team, result quality, or production behavior.
