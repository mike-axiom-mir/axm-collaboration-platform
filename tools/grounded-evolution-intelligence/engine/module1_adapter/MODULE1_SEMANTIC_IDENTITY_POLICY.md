# Module 1 Semantic Identity and Collision Policy

Module 3 keeps three different digest roles:

1. **artifact digest** — exact ZIP/file bytes;
2. **semantic digest** — portable normalized source semantics, excluding relocation
   and verification-time fields;
3. **run/receipt digest** — exact historical generated card or receipt instance.

A fresh rebuild can change the run digest without changing the semantic digest.
Treating every full-card hash difference as a conflict would create false holds.

Deterministic pair classes:

- `exact_duplicate`
- `run_metadata_variant`
- `revision_only`
- `revision_family`
- `conflicting_duplicate`
- `ambiguous_duplicate`
- `separate_identity`

Different capability IDs never auto-merge based on similarity. Conflicting and
ambiguous duplicates always hold for explicit review.
