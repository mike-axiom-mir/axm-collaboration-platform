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

## Semantic candidate generation

The later `TEST` semantic generator adds a native-only default, one optional
host-supplied AI challenger lane, detached candidate packets, an unranked
alternative comparison, and Creation Review Card data. It remains a pure data
transform and executes no generated source.

See [README-semantic-candidate-generator-v1.md](README-semantic-candidate-generator-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-semantic-candidate-generator-v1.js
```

## First deterministic game candidate

The next `TEST` rung adds one native, typed game recipe and a byte-bound game
candidate packet. It composes the existing Game Capability Atlas, Game Forge,
Sandbox, playtester, Review Inbox, Evidence Desk, Detached Candidate Nursery,
and deterministic JSON contracts. It is not a general game engine or executor.

See [README-deterministic-game-candidate-generator-v1.md](README-deterministic-game-candidate-generator-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-game-candidate-generator-v1.js
node tools/sandbox/selftest-disposable-candidate-sandbox-v1.js
```
