# Migration — Atlas v0.8.0 to v0.9.0

The shared Capability Record contract remains exactly v0.1.0.

## Why rebuild v0.8 public-registry cards

v0.8 could normalize sparse registry rows but did not bind provider/module
contracts into a deterministic evidence bundle.

v0.9 producer input identity includes enrichment context. Therefore cards built
from sparse public rows under v0.8 should not be relabeled as v0.9 RUN records.
Run the real repository through `axm-public-intake` and rebuild the affected
cards with v0.9.

## What remains stable

- capability IDs;
- original capability registry source hashes;
- evidence-state semantics;
- shared contract v0.1.0;
- Module One / Module Two field-authority boundary;
- no silent capability expansion.

## New sidecar evidence

- registry_context;
- enrichment_context;
- enrichment catalog/source seal hashes;
- provider/consumer join status;
- separate enrichment snapshot fingerprint.

These additions improve provenance/context without redefining the technical
capability itself.
