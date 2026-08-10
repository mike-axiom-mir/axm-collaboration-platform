# Deterministic PR checkpoint core

`checkpoint-core.js` is the dependency-free Node core behind the AXM PR checkpoint gate. It composes the existing strict deterministic JSON primitive with read-only Git object inspection.

The semantic digest excludes filesystem roots and timestamps. Changed content is read from committed Git blobs, not from mutable working-tree files. Dirty state is counted and held without retaining the dirty paths.

The core has no network, command-execution, repository-write, push, pull-request, merge, promotion, or CANON authority.
