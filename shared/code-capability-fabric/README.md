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

## First installed adventure content release

The following `TEST` rung preserves the exact first-game packet as a rollback
ancestor and deterministically seals one five-zone adventure content release.
It emits a non-writing installation plan for a separate trusted Game Hub shell;
it still runs no provider, runtime, generated source, network, or lifecycle
action. Mike's explicit internal-`TEST` direction is recorded without claiming
cryptographic identity proof or resolving public reuse rights.

See [README-deterministic-adventure-content-generator-v1.md](README-deterministic-adventure-content-generator-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-adventure-content-generator-v1.js
node tools/game-hub/game-library/020-four-roots-adventure/tests/package-selftest.js
```

## Deterministic game trailer planner

The next `TEST` adapter binds a silent, captioned 30-second trailer plan to the
exact adventure content and Game Hub manifest. Marketing claims are typed and
source-bound. It plans no publication or lifecycle action and grants no
authority; a separate trusted native renderer is required.

See [README-deterministic-game-trailer-planner-v1.md](README-deterministic-game-trailer-planner-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-game-trailer-planner-v1.js
```

## Deterministic gameplay-replay trailer

The following `TEST` rung replaces the abstract middle of that trailer with
frames reconstructed from exact states emitted by the reviewed Four Roots
native engine. A fixed complete-journey entrypoint produces 228 digest-linked
actions and 40 byte-bound visual checkpoints across all five zones. This is
explicitly replay reconstruction, not browser capture or live player input.

Only the exact engine bytes are accepted. Uploaded or generated runtimes,
arbitrary commands, providers, network access, publication, promotion,
Foundation mutation, and CANON remain refused.

See [README-deterministic-gameplay-trailer-planner-v1.md](README-deterministic-gameplay-trailer-planner-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-deterministic-gameplay-replay-v1.js
node shared/code-capability-fabric/selftest-deterministic-gameplay-trailer-planner-v1.js
node tools/game-hub/game-library/020-four-roots-adventure/media/trailer-selftest.js
```

## Current-Workshop shadow improvement draft

The next `TEST` rung adds one deterministic improvement recipe:
`refresh-tools-index-v1`. A trusted host adapter observes exact privacy-scoped
current Workshop state and may create an immutable, detached `tools-index.json`
draft. The pure Fabric planner performs no filesystem or provider action.

The source has no write path, the JSON candidate is never executed, and the
script-free review preview refuses stale scoped bytes. Receipts bind request,
snapshot, plan, candidate, resource measurements, and exact trusted generator
files without retaining raw source or machine paths. This is not a general code
improver and cannot recover missing repository files.

See `tools/sandbox/README-workshop-shadow-sandbox-v1.md` and run:

```powershell
node shared/code-capability-fabric/selftest-workshop-shadow-improvement-planner-v1.js
node tools/sandbox/selftest-workshop-shadow-sandbox-v1.js
```

## Legacy manifest contract-repair alternatives

The additive v0.6 `TEST` rung handles one evidence-supported declaration defect:
a legacy target manifest with both `schema` and `kind` absent, while its other
manifest and module-contract checks pass. It adds the fixed
`axm.tool-manifest/v1` schema and emits all five allowed `kind` values as equal,
byte-bound detached alternatives.

No alternative is ranked or selected. Static manifest/contract validation is
recorded separately from semantic fitness, which remains `UNKNOWN`. Exact test
commands are declared as inert argv records with status `NOT_RUN`. Candidate
execution, test execution, source write-back, installation, integration,
publication, promotion, and CANON remain outside this capability.

See `tools/sandbox/README-workshop-shadow-sandbox-v1.md` and run:

```powershell
node shared/code-capability-fabric/selftest-workshop-contract-repair-planner-v1.js
node tools/sandbox/selftest-workshop-contract-repair-sandbox-v1.js
```

## Exact human-declared candidate selection binding

The additive v0.7 `TEST` rung can bind one declared human review-seat choice to
the exact v0.6 candidate packet, exact selected alternative bytes, exact sealed
grounded-consent instance/evaluation, ordered four-root evidence references,
time window, nonce, and a declared replay-ledger snapshot.

The binder hashes the exact selected candidate bytes in memory against the
declared length and SHA-256, then retains only the reference. The result is
intentionally `AUTHENTICATION_REQUIRED` with effect
`INERT_REVIEW_BINDING`. A seat reference is not natural-person authentication;
the supplied clock and replay ledger are not independently trusted; live
revocation, informed understanding, host authorization, and semantic fitness
remain unproven. Consent for another candidate, stale or replayed declarations,
forged records, scope expansion, permissions, network, lifecycle authority, and
machine selection fail closed.

The binder reads no filesystem, writes nothing, and cannot execute tests or
candidates, install, integrate, publish, promote, or change CANON. A future
trusted authentication hand is a separate capability and Mike decision.

Run:

```powershell
node shared/code-capability-fabric/selftest-human-candidate-selection-binder-v1.js
```

## Cross-domain bounded creation programs

The additive v0.8 `TEST` rung compiles a human-authored typed artifact graph
across arbitrary domains into one deterministic, plan-only creation program.
Each exact capability requirement must bind one existing Fabric v2 route plan;
missing, ambiguous, stale, drifted, authority-expanding, or resource-expanding
routes remain typed gaps. Those gaps are emitted in the exact intake shape used
by Workshop's existing Hand Specification Foundry.

The planner assigns domain-native evidence surfaces, keeps every evidence
verdict `UNKNOWN` and every step `NOT_RUN`, orders dependencies, enforces
declared structural and byte ceilings, and exposes minimum consent tiers for
candidate generation, sandbox trials, library lessons, installation or
publication, and model training or physical actuation. Taste and meaning stay a
human seat.

It does not infer capabilities from prose, call providers, inspect a workspace,
retain raw goal or source text in its durable program, generate artifacts, run
verifiers, grant authority, execute a sandbox, learn, install, integrate,
publish, actuate hardware, promote, or change `CANON`.

See [README-bounded-creation-program-planner-v1.md](README-bounded-creation-program-planner-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-bounded-creation-program-planner-v1.js
```

## Consent-bound detached semantic candidate

The additive v0.9 `TEST` rung joins the existing semantic generator, Ed25519
trust-key contract, deterministic JSON core, and Detached Candidate Nursery.
It verifies one exact Tier-1 decision against a host-selected trust-policy
digest and a separately signed current revocation snapshot, reserves the
decision nonce exclusively, then writes one native Review-Card adapter
candidate into a new disposable direct-child root.

Every emitted byte is read back and statically inspected. The path-free receipt
measures candidate, replay, evidence, and total written bytes. Failed attempts
remove only their newly owned candidate root and leave the nonce spent.

Authentication is relative to the selected host policy; natural-person
identity, informed understanding, independently trusted time, and global replay
prevention are not claimed. Candidate code is never executed. AI challenger
materialization, arbitrary domain recipes, installation, integration,
publication, learning, training, physical actuation, promotion, and `CANON`
remain outside this capability.

See [README-semantic-candidate-materializer-v1.md](README-semantic-candidate-materializer-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-semantic-candidate-materializer-v1.js
```
