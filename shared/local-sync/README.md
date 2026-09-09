# AXM LEGO City Owner-Defined Local Sync

Status: **EXPERIMENTAL**

Local Sync is a pure candidate compiler. Every namespace must have an explicit
owner-defined merge rule. v0.2 supports append-only lists and a measured
grow-only set; it refuses generic “CRDT” claims. Immutable divergence conflicts,
last-writer selection is refused, and single-authority divergence waits for the
owner.

Foundation, CANON, root, and authority namespaces always produce a digest-bound
human reconciliation request. Results are never applied or persisted here.

## Sealed admission boundary

`snapshot()`, `rule()`, and `admission()` construct exact v1 envelopes. `merge()`
accepts only those sealed envelopes: it verifies the schema, complete field
set, SHA-256 digest, canonical parent ordering, and JSON-safe value domain
before choosing a merge path. Missing digests are not treated as legacy input,
and extra fields are not silently discarded.

This makes a merge rule part of the inspected input rather than a mutable
convention. The caller must pin the expected namespace and exact rule digest in
a separate `axm.merge-admission/v1` envelope. Changing a rule's owner,
namespace, semantics, or strategy—or substituting another valid sealed
rule—fails closed against that pin.

Callers upgrading from v0.1 must explicitly construct fresh snapshots, rules,
and an admission pin before merging. Local Sync does not infer or migrate
authority-bearing input. The pin proves exact selection, not that the claimed
rule owner authorized it; callers remain responsible for trusted rule
provenance.

Canonical values are plain JSON: finite numbers, strings, booleans, null,
dense arrays, and plain objects. Functions, `undefined`, symbols, non-finite
numbers, sparse arrays, class instances, and cycles are rejected because they
cannot have one portable JSON identity.
