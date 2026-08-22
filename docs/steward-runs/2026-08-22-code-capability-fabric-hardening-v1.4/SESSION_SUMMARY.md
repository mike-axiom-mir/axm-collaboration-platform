# Session summary

The Code Capability Fabric now has an additive v2 `TEST` planner without
disturbing the byte-pinned v1 intake. v2 closes concrete planning defects:
route tuples cannot be synthesized from unrelated arrays; provider and host
records are strict and digest-bound; multiple provider versions and host
observations require exact selection; observation freshness is explicit;
overbroad authority and resource envelopes are held; and direct byte reuse
defaults to a rights hold.

A pure workspace-boundary preflight rejects the named Windows and overlap
aliases while returning only an opaque digest reference. Artifact, parent,
observer, executor, assurance, reuse-rights, and boundary data remain references
instead of private source, machine paths, stdout, or stderr.

The planner does not dereference those references. It therefore does not prove
host-observer authenticity, artifact bytes, legal sufficiency, live path
confinement, sandboxing, measured resource enforcement, append-only runtime
evidence, or output correctness. No executor was added or authorized.

Implementation commit `356a37dacac4d8522fc81fcd4c89292df4f6dd2a`
passes all ten required checks and five focused suites. Both Workshop verifier
paths report the unchanged 41-warning baseline and zero failures. Browser
testing was not applicable because no visual surface changed.

The observed canonical checkout is a divergent, heavily dirty worktree and is
not a safe in-place integration target. The result remains on
`codex/code-capability-fabric-hardening-v1.4` for read-only review and later
integration through a new clean worktree only after Mike chooses a target and
accepts the diff. Nothing was merged, installed, promoted, or made `CANON`.

Mike decisions still open:

1. whether the supplied generated source has sufficient direct-reuse rights;
2. whether any repaired future executor may run in a disposable sandbox; and
3. which target ref should receive the reviewed intake-plus-hardening lineage.
