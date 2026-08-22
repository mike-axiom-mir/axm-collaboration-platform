# Signal-First Intake — Module 2 v0.6.0

## Purpose

Local intake should not be forced into a false binary where a record is either accepted or discarded. Module 2 now preserves a third outcome: **retain it as signal while refusing execution**.

This is useful for the three-module intake because Module 3 can learn where the ecosystem is incomplete, conflicted, brittle, or poorly documented without Module 2 pretending those observations are accepted capability facts.

## Authority layers

### 1. Authoritative deterministic path

The existing context preflight, provenance checks, shared-schema validation, cross-module gate, pattern scoring, beginner planning, and recommendation output remain authoritative for Module 2.

A blocked authoritative gate still blocks recommendation execution.

### 2. Quarantine signal path

`build_quarantine_signal_packet()` extracts observed intake facts such as:

- malformed handoff shape;
- missing/invalid runtime context;
- provenance or immutable-source failure;
- paired-boundary block;
- evidence gaps or conflicts;
- no-safe-match and conditional dependencies.

The signal packet explicitly declares:

- `execution_authority: false`;
- `automatic_canon: false`;
- `automatic_source_mutation: false`;
- `automatic_contract_change: false`;
- failed records are not promoted to facts.

### 3. Shadow analysis path

Synthetic counterfactual probes modify a bounded copy of the recommendation context and rerun the deterministic engine. They never modify the original capability or context.

Current probes may test:

- one skill step lower or higher;
- one tighter compute budget;
- one tighter attention budget;
- one tighter complexity budget;
- removal of one available device when alternatives remain;
- removal of declared supporting tools.

The total is capped at eight probes per record.

The output is explicitly synthetic. It is useful for questions such as:

- does one small context change switch the chosen interface pattern?;
- does a tighter resource budget move a direct recommendation to conditional?;
- is a recommendation stable across the bounded context surface we tested?

It is **not** empirical user evidence and does not prove global robustness.

## Module 3 handoff

Module 3 may consume quarantine and shadow signal packets as research input. It must retain their authority markers and source references.

Suggested interpretation:

- repeated evidence gaps may justify source/documentation research;
- repeated pattern sensitivity may justify better discriminating context fields or scoring research;
- repeated resource dependencies may justify new low-cost tooling;
- repeated boundary conflicts may justify contract/governance work;
- stable results across varied records may be positive evidence for preserving a rule.

None of those signals alone authorizes code changes or canon updates.

## Signal ledger preview

`signal-lab` creates a two-entry append-only hash-chain preview for the quarantine and shadow packets.

The preview exists to demonstrate a safe persistence shape for local intake. It is deliberately marked:

`NOT_WRITTEN_TO_LOCAL_LEDGER`

Module 2 does not claim to have written anything into the local AXM runtime.

## v0.6 assurance signal

Recommendation Assurance findings are emitted separately from the authoritative recommendation. `REVIEW` and `BLOCKED` assurance findings may become advisory Module 3 signals, but they cannot alter the recommendation, enable execution, or become canon automatically.
