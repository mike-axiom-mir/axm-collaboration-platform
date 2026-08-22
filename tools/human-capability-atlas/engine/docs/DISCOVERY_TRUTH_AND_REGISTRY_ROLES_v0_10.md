# Discovery Truth and Registry Roles — v0.10.0

## Why this layer exists

The AXM public discovery generator emits one registry row for every declared
provider/consumer identifier. This is valuable for machine routing, but it means
the row count includes both abilities AXM provides and dependencies AXM consumes.

Human-facing capability coverage needs a stricter distinction.

## Role classifier

The classifier uses only the row's declared provider/consumer arrays.

### PROVIDED_ONLY

At least one provider, no consumers.

Human-facing treatment: AXM capability.

### PROVIDED_AND_CONSUMED

At least one provider and at least one consumer.

Human-facing treatment: AXM capability that is also an interface/dependency
elsewhere.

### CONSUMER_ONLY_DEPENDENCY

No providers, at least one consumer.

Human-facing treatment: dependency/reference.

It remains indexed and source-bound but is excluded from provider-backed
Human Capability coverage.

### UNBOUND

No provider and no consumer.

Human-facing treatment: review hold.

## Discovery integrity gate

Before enrichment, v0.10 reconstructs the current generated public registry
contract from the supplied `tools-index.json`.

It checks exact parsed parity for:

- `registry/modules.json`
- `registry/capabilities.jsonl`
- `registry/public-status.json`
- `registry/proofs.json`

It also verifies:

- summary counts;
- duplicate IDs;
- module source path existence;
- declared module test path existence;
- declared promotion self-test SHA-256 where supplied;
- proof evidence path existence;
- generator/selftest evidence presence.

No writes are made to the repository.

## Upstream authority boundary

`tools-index.json` is an upstream source snapshot.

Module One does not run `scripts/generate-tools-index.js --verify` because that
path executes module self-tests and writes readiness/index state.

Module One records:

`SUPPLIED_TOOLS_INDEX_SNAPSHOT_NOT_REGENERATED`

This makes the boundary explicit instead of pretending that public-registry
verification also re-proved the entire upstream readiness system.

## Proof ceiling

The public status/proof surfaces are preserved in enrichment context.

Especially:

- declaration is not runtime proof;
- self-test is not human approval;
- automatic promotion is false;
- canon requires human Merge Gate;
- discovery-structure proof establishes static structure/registry consistency,
  not runtime behavior/usability/human approval.

## Humanization seed

The seed is deterministic and source-bound.

It may contain:

- readable ID label;
- role orientation;
- provider name/summary;
- consumer names;
- lexical action candidates;
- proof ceiling.

Action candidates are scored by token overlap and explicitly labeled:

`CONTEXT_CANDIDATE_NOT_CAPABILITY_FACT`

They can help future human wording, but cannot change a shared Capability Record
field from UNKNOWN to KNOWN.

## Coverage denominator

Public-registry human capability coverage counts provider-backed roles only.

Dependency/reference rows remain tracked separately because they matter for:

- integration;
- interfaces;
- compatibility;
- failure explanation;
- dependency maps.

## Evolution

Registry-role fingerprints make provider/consumer role changes first-class
events.

A consumer-only dependency becoming provider-backed is not merely wording drift.
It changes human presentation and requires:

- Capability Card re-evaluation;
- search/index update;
- learning-plan update;
- Module Two re-evaluation.
