# AXM Public Registry Evidence Enrichment — v0.9.0

## Problem

The generated public capability registry is a routing/inventory surface, not a
complete human teaching declaration. Its rows carry identity plus
provider/consumer relations and explicit truth limits.

Human Capability Cards need more context, but simply guessing from a capability
name would violate source integrity.

## Deterministic solution

For each normalized public capability record:

1. preserve the exact registry row;
2. take its declared provider/consumer module IDs;
3. resolve those IDs in `registry/modules.json`;
4. follow only the module registry's referenced manifest and contract paths;
5. hash the exact referenced bytes;
6. confirm the capability appears in the expected module registry relation;
7. confirm it appears in the referenced contract relation when available;
8. compare provider status surfaces;
9. preserve module metadata as context;
10. emit a deterministic enrichment hash and status.

## Enrichment states

### VERIFIED

The module exists and both the generated module registry and referenced module
contract agree on the provider/consumer relation.

This verifies declaration consistency only.

### PARTIAL

Some authoritative join evidence is missing or unresolved.

The available context is preserved, but downstream consumers must not pretend
the missing evidence exists.

### CONFLICTED

Credible checked sources disagree, such as a provider listed in the capability
registry but absent from that provider's referenced contract, or provider
status disagreement.

The contradiction is preserved rather than auto-resolved.

### NO_MODULE_RELATION

The capability row has no provider or consumer module relation. This can be
valid for protocol/media/runtime dependency identifiers. It is not silently
invented into a module relation.

## Non-promotion rule

Provider context is not capability semantics.

Module-wide:
- actions;
- accepts;
- produces;
- risk;
- permissions;
- lifecycle;
- handoffs;
- refusal boundaries

may explain the environment surrounding a capability, but these fields do not
become capability-specific KNOWN facts without capability-specific evidence.

## Change propagation

The enrichment hash is included in producer input identity.

If a provider manifest or contract changes while the sparse capability row does
not, a stale Capability Card receipt no longer matches. The affected card is
rebuilt.

Registry snapshots store a separate enrichment fingerprint so these changes are
visible without falsely labeling them as capability-ID semantic reuse.

## Module Two boundary

Module One exports the evidence context. Module Two may use it when choosing an
interface, but must continue respecting evidence states and the distinction
between module-wide and capability-specific facts.
