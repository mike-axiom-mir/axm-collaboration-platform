# Identity and Relationship Integrity

The Atlas never treats repeated IDs as safe duplicates by default.

Identity groups are classified as:

- `single`
- `exact_duplicate`
- `revision_only`
- `revision_family`
- `conflicting_duplicate`
- `ambiguous_duplicate`

Canonical selection is a deterministic read-only proposal using lifecycle state, source confidence, proof rank, revision, completeness, and a deterministic tie-break. Every candidate remains preserved.

Aliases resolve only when one normalized alias has one target and does not shadow another canonical ID. Collisions are withheld.

The relationship graph records dependency, prerequisite, related, alternative, combination, and replacement edges. It reports missing targets, self-references, cycles, deprecated targets, roots, dependents, isolated records, and topological order.
