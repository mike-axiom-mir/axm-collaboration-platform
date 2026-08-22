# Module 1 Composite Evidence Adapter Policy

There is no standalone canonical record called `Evidence Tuple` in v0.10.0.
Module 3 therefore creates its own immutable observation index that references,
without rewriting, these Module 1-owned surfaces:

- `source_reference`
- `knowledge.field_states`
- `knowledge.inferences`
- `knowledge.unknowns`
- `knowledge.conflicts`
- normalized-source `observed_evidence`
- `registry_context`
- `enrichment_context`
- discovery integrity and enrichment sidecars
- producer receipts, batch receipts and the production manifest

## Receipt rule

Module 1 receipts are atomically replaceable during an explicit rebuild and are not
append-only by schema. Module 3 must therefore preserve each received receipt as an
immutable external observation keyed by its digest and run identity. It must not claim
Module 1 itself guaranteed append-only receipt history.

## Proof ceiling

The following never become runtime proof by themselves: declaration existence,
provider join `VERIFIED`, discovery verification `PASS`, schema/policy `PASS`, source
hash match, test-file existence, producer `RUN`, batch `PASS`, or
`COMPLETE_VERIFIED`.
