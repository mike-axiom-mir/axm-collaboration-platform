# Deterministic Run Integrator Core

This shared module turns one declared builder run into a bounded local Git
transaction:

1. create a clean worktree on `codex/run/<runId>` from one exact target head;
2. let an already-authorized builder work only in that lane;
3. inspect and hash every changed path against the explicit policy;
4. create one deterministic commit from the exact plan;
5. fast-forward the unchanged clean target and remove the integrated lane.

Target drift, dirty target state, undeclared paths, private/local paths,
secret-shaped content, symlinks, conflicts, renames, and undeclared deletions
produce a typed hold. Configured Git content filters are also refused so an
inspection cannot silently invoke an external filter process. The module does
not execute a builder or tests. It does
not fetch, push, rebase, reset, merge conflicts, write `main`, promote, alter
roots, or change CANON.

The pure policy, planning, digest, and verification logic lives in
`run-integrator-core.js`. Local filesystem and Git effects are isolated in
`run-integrator-host.js`.
