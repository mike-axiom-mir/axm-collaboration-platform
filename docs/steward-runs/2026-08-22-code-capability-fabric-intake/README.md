# Code Capability Fabric intake

Status: `TEST`

This run treats the supplied Code Capability Fabric v0.1 and v0.2 ZIPs plus
the Atlas refresh note as data. Their archive structure, exact bytes, embedded
module bundles, JavaScript syntax, JSON syntax, declared lineage, and overlap
with the current Workshop were inspected without loading or executing package
modules.

The research is useful. The Workshop already has recipe, atlas, search,
candidate, verification, repair, evolution, and installation organs, but it
does not have the package's exact provider-neutral Code Fabric contract. That
is a real composition gap, not a greenfield-platform gap.

The supplied v0.2 runtime remains held. Static review found that it replaces
prior candidate and evidence directories, permits output/source overlap,
retains full context and test output, declares rather than enforces its memory
budget, inherits the host environment for test execution, and binds its parent
by id/version rather than exact parent bytes. These are repairable prototype
limits, but they conflict with AXM continuity, privacy, and execution
boundaries.

The safe technical disposition is therefore:

```text
v0.1 exact bytes -> superseded research baseline
v0.2 exact bytes -> native repair and evaluation planning input
runtime execution/install -> held
provider-neutral capability contract -> validated missing glue
```

A bounded native graft now closes the planning portion of that gap at
`shared/code-capability-fabric/`. It is a zero-permission `TEST` module that
binds requests, provider descriptors, exact host observations, and allowed
authority into a deterministic route plan. It deliberately has no executor,
workspace reader, context packer, mutation Hand, installer, or promotion path.

This run does not claim that the package self-tests passed independently, that
resource ceilings were enforced, that untrusted code is isolated, or that any
human/model/system consciousness or self-improvement was established.

Run the committed evidence checks with:

```powershell
node docs/steward-runs/2026-08-22-code-capability-fabric-intake/selftest.js
node shared/code-capability-fabric/selftest.js
node tools/detached-candidate-nursery/selftest.js
```

No browser surface changed, so browser render/click testing is not applicable.
Mike remains the merge and `CANON` gate.
