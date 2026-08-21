# Code Capability Fabric

Status: `TEST`

The explicit v2 entry point is `code-capability-fabric-v2.js`, with
`module-v2.contract.json` as its authority contract. The intake-pinned v1 entry
point and files remain byte-identical beside it.

This provider-neutral seam plans an exact code-capability route. It does not
load or execute provider code, read a workspace, build context, mutate a
candidate, grant permissions, use a network, install anything, write evidence,
promote, or decide `CANON`.

The v2 contract separates:

```text
declared capability route + canonical descriptor digest + parent references
  != observed host availability
  != planned least-authority/resource envelope
  != externally verified assurance
  != authorized execution
  != proven output
```

`ROUTE_PLANNED` requires all of the following:

- one provider, or an exact provider id/version/descriptor-digest selection;
- one time-bounded, self-digesting host observation, or an exact observation
  record-digest selection;
- an observer reference included in the request's explicit trust policy;
- exact request/provider/host permission, network, mutability, and source-use
  intersections with no overbroad host executor envelope;
- exact host resource ceilings matching provider needs and staying within the
  request ceiling;
- opaque references for every provider/request assurance, including a resource
  enforcement verification reference;
- an exact workspace-boundary reference when the provider needs workspace
  access; and
- a declared reuse-rights reference before a provider may plan byte copying or
  transformation.

These are planning facts, not execution proof. The planner does not dereference
observer, executor, assurance, rights, artifact, or boundary references. It
therefore cannot prove observer authenticity, sandbox confinement, measured
resource enforcement, legal sufficiency, artifact bytes, destination absence,
append-only persistence, or output correctness. Those remain external host,
Verification Spine, Evidence Retention, Nursery, Module Evolution Ledger, and
Mike review gates.

## Portable workspace boundary

`buildWorkspaceBoundaryRef()` is a pure validator for a small portable path
profile. It rejects absolute, drive, UNC, alternate-data-stream, traversal,
reserved-device, trailing-dot/space, Unicode-normalization, case-fold, nested,
and source/output/evidence overlap aliases. It returns only an id, schema, and
digest; raw paths are not copied into route plans.

The validator performs no filesystem reads. A passing declaration does not
prove that a destination is absent, that symlinks or junctions are safe, or
that an executor will respect it. An authorized external boundary verifier
must still inspect the real host immediately before any future execution.

## Version continuity

The v1 implementation, selftest, README, contract, and schema files from the
intake commit remain byte-identical historical contracts. The explicit v2
entry point emits and accepts v2; it does not silently reinterpret v1 records.
v2 closes the unsafe capability/input/output Cartesian match, permits multiple
visible versions, and requires exact selection instead of hidden ranking.

Possible v2 results:

- `MISSING_HAND`
- `SELECTED_PROVIDER_UNAVAILABLE`
- `SELECTED_PROVIDER_STALE`
- `SELECTION_REQUIRED`
- `HOST_OBSERVATION_REQUIRED`
- `HOST_OBSERVATION_AMBIGUOUS`
- `HOST_OBSERVATION_STALE`
- `HOST_OBSERVATION_UNTRUSTED`
- `HOST_UNAVAILABLE`
- `BOUNDARY_HOLD`
- `ASSURANCE_HOLD`
- `AUTHORITY_HOLD`
- `RESOURCE_HOLD`
- `REUSE_RIGHTS_HOLD`
- `ROUTE_PLANNED`

Run:

```powershell
node shared/code-capability-fabric/selftest-v2.js
```
