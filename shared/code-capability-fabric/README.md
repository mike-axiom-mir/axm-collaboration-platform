# Code Capability Fabric

Status: `TEST`

This is the first native, permissionless seam derived from the Code Capability
Fabric research intake. It plans an exact provider route. It does not load or
execute provider code, read a workspace, build context, mutate a candidate,
grant permissions, use a network, install anything, or decide `CANON`.

The core separation is:

```text
capability request
  + provider descriptors
  + exact host observations
  + explicit allowed authority
  -> deterministic route plan
  -> separate explicit executor and verifier gates
```

A provider declaration is not availability evidence. `ROUTE_PLANNED` requires
an exact descriptor digest to match a host observation with an executor
reference and at least one verification reference. Even then, the observation
is an input claim, not proof that execution occurred.

When several providers satisfy the same typed request, the Fabric returns
`SELECTION_REQUIRED` unless the request explicitly names a preferred provider.
It does not hide a values decision inside a numeric provider priority.

Possible results:

- `MISSING_HAND`
- `PREFERRED_PROVIDER_UNAVAILABLE`
- `SELECTION_REQUIRED`
- `HOST_OBSERVATION_REQUIRED`
- `HOST_OBSERVATION_STALE`
- `HOST_UNAVAILABLE`
- `AUTHORITY_HOLD`
- `ROUTE_PLANNED`

`ROUTE_PLANNED` means only that the request, descriptor, host observation, and
authority envelope align. It is never execution, verification, installation,
promotion, or proof of semantic correctness.

Run:

```powershell
node shared/code-capability-fabric/selftest.js
```

## Later bounded `TEST` rungs

The intake planner remains intact. Later files in this folder add separately
reviewable pure contracts for v2 routing, readiness, grounded consent,
assurance, inert blueprint composition and schema compilation, exact schema
packet comparison, and signed Git object-inventory comparison. None of those
contracts turns a plan into execution or grants ambient host authority.

The Git object-inventory comparator is documented in
`README-git-object-inventory-comparator-v1.md`. It compares only exact signed,
host-supplied object records. It does not open a repository, invoke Git, read
object bytes, prove enumeration completeness, connect the experimental mirror
runtime, merge, promote, or decide `CANON`.

Run its focused boundary suite with:

```powershell
node shared/code-capability-fabric/selftest-git-object-inventory-comparator-v1.js
```
