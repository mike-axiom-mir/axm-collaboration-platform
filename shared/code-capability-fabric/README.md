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

## Code Recipe Foundry context bridge

The additive v1.0 `TEST` bridge gives the Fabric bounded, deterministic access
to the installed 1,000-entry Code Recipe Foundry catalog. A caller must name
exact `CC-####` identities; the bridge does not rank or select recipes and does
not claim the caller is an authenticated human.

`REFERENCE_ONLY` emits metadata and snippet digests without source text.
`DETACHED_RESEARCH_CONTEXT` may include exact snippet text only for entries
without a structural hold whose installed synthetic audit is `SYNTAX_PASS`.
Both modes remain `RESEARCH_ONLY_HOLD`; source and license claims are
unverified, syntax is not runtime/correctness/security proof, and nothing is
executed.

The semantic generator can bind the exact selection packet into request,
candidate, and Review Card lineage. This first bridge deliberately does not
apply those snippets to generated candidate source. It is not Code Mirror or
RepairBuddy, and it grants no executor, install, integration, promotion, or
CANON authority.

See [README-code-recipe-fabric-bridge-v1.md](README-code-recipe-fabric-bridge-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-fabric-bridge-v1.js
```

## Installed recipe metadata discovery

The additive v1.1 `TEST` adapter accepts a bounded metadata query over the exact
installed 1,000-recipe Foundry catalog. It verifies the catalog, syntax audit,
and Foundry contract bytes through the v1.0 bridge, then returns separate
eligible and held evidence. Source snippets stay absent; exact snippet digests
and byte lengths remain visible. Discoverability is not copying permission:
reuse remains `RESEARCH_ONLY_HOLD` and direct reuse remains false.

Its score is only a deterministic mechanical match order. It performs no
semantic inference, recommendation, or automatic selection. Every packet has
`selection: null`. Using a result requires a new exact v1.0 selection request
and all later consent, candidate, sandbox, review, and integration gates.

See [README-code-recipe-discovery-v1.md](README-code-recipe-discovery-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-discovery-v1.js
```

## Consent-scoped recipe application planning

The additive v1.2 `TEST` adapter binds one exact blueprint, eligible discovery
evidence, a requester-specified `REFERENCE_ONLY` selection, explicit
recipe-to-step mappings, four-root evidence, and grounded consent scope. It
emits an inert independent-native-implementation outline and an all-`NOT_RUN`,
all-`UNKNOWN` acceptance plan.

The first fixture maps Foundry `map` and `filter` metadata onto two declared
steps of a small game-rule pure function. It does not copy or apply snippets,
infer semantic fitness, authenticate the requester, generate code, write a
candidate, execute tests, inspect a target workspace, install, integrate,
promote, or change `CANON`. Its next gate is exact human authentication followed
by a new detached-candidate request.

See [README-code-recipe-application-planner-v1.md](README-code-recipe-application-planner-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-code-recipe-application-planner-v1.js
```

## Atlas-backed native game-rule candidate draft

The additive v1.4 `TEST` generator takes that exact v1.2 map/filter application
plan one bounded step further. It independently emits one byte-bound,
nine-file JavaScript game-rule candidate bundle in memory and reuses the
existing semantic bundle/path validator. Atlas snippet bytes remain absent and
the candidate is not written or executed.

The draft stays `EXPERIMENTAL`; authentication over its exact bytes is the next
gate before any Detached Candidate Nursery write. Runtime behavior,
correctness, safety, reuse rights, installation, integration, promotion, and
`CANON` remain deliberately unresolved.

See [README-native-game-rule-candidate-generator-v1.md](README-native-game-rule-candidate-generator-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-native-game-rule-candidate-generator-v1.js
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

## Multi-axis code taxonomy and specialist routing

The additive v1.5 `TEST` rung categorizes exact, digest-bound artifact
observations before any code-specific knowledge is attached. Language/format,
artifact family, responsibility, runtime, framework, interface, authority, and
evidence axes remain separate. Extensions provide mechanical candidates only;
ambiguous `.m`, `.pl`, and `.v` paths require an explicit compatible language
declaration, while unknown axes emit typed capability gaps.

The router reuses exact method-mask references from Workshop's existing
Specialist Library and emits separate, non-merging technical organ lanes for
markup, style, browser behavior, application logic, data/schema, testing,
persistence, authority/security, build/package, shader/rendering, hardware
simulation, performance/resources, documentation, and audio. The catalog is
extensible and explicitly does not claim to enumerate every language.

All future knowledge lanes start `REFERENCE_ONLY_EMPTY`. The planner reads no
source bytes, loads no specialist knowledge, writes nothing, calls no provider,
runs no tests or candidate, grants no permission/network, and cannot learn,
install, integrate, publish, actuate hardware, promote, or change `CANON`.

See [README-code-specialization-router-v1.md](README-code-specialization-router-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-code-specialization-router-v1.js
```

## Exact specialist-lane → Organ Fabric intent binding

The additive v1.6 `TEST` rung connects one exact v1.5 artifact/specialist lane
to the canonical Deterministic Organ Fabric without pretending the profile or
file path supplies implementation semantics. The caller must provide the typed
ports, fixtures, invariants, boundaries, and bounded resources explicitly.

The adapter rebuilds the entire byte-bound v1.5 specialization plan, requires
one exact closed specialist lane and the exact
`software-workshop@1.1.0` field pack, appends the profile digest, empty
knowledge-lane state, evidence ceiling, and specialist refusals, then seals an
inert `axm.organ-intent/v1` for human review.

It does not generate an organ or candidate, run the Organ Fabric runtime, read
source/workspace content, load knowledge, execute tests, grant permission or
network, merge alternatives, install, integrate, publish, promote, or change
`CANON`. Unsupported implementation-organ semantics remain a typed future
field-pack gap.

See [README-code-specialist-organ-intent-adapter-v1.md](README-code-specialist-organ-intent-adapter-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-code-specialist-organ-intent-adapter-v1.js
```

## Registered code-family build profiles → detached candidates

The additive v2.0 `TEST` rung moves code-family binding out of hard-coded
builder branches and into an exact, digest-bound build-profile catalog. The
initial profiles connect `organ.code.data-schema` to the closed JSON Schema
validator recipe and `organ.code.markup-structure` to the bounded semantic
HTML-page renderer. It now also connects Python application logic to one
string-only record-transform recipe through a provider-neutral source layout.
Later or broader families require their own Code Atlas language, specialist
binding, source-reviewed recipe, builder digest, and evidence plan; unsupported
families produce typed gaps.

Four technical root passes, an exact v1.6 intent rebuild, an exact
human-reviewed build request, tier-1 consent bound to the profile catalog and
selected profile bytes, research-only reuse state, and closed resource ceilings
are all required before one detached `EXPERIMENTAL` candidate is generated in
memory.

Generated JavaScript uses `capability.js` and `selftest.js`; generated Python
uses `capability.py` and `selftest.py`. Every file remains inert data. They are
not run, written, installed, integrated, published, promoted, or canonized.
Runtime behavior remains `UNKNOWN`; HTML visual and interaction behavior also
remains `UNKNOWN`. Unsupported specialists remain typed recipe gaps rather
than inheriting a nearby admitted hand.

See
[README-code-specialist-build-profile-registry-v1.md](README-code-specialist-build-profile-registry-v1.md)
and [README-code-specialist-capability-builder-v1.md](README-code-specialist-capability-builder-v1.md),
then run:

```powershell
node shared/code-capability-fabric/selftest-code-specialist-build-profile-registry-v1.js
node shared/code-capability-fabric/selftest-code-specialist-capability-builder-v1.js
```

## 102-organ Creation Session Planner

The additive v2.12 `TEST` rung connects the stacked PR #50–#61 Creation Fabric
into one deterministic planning call. A caller supplies one exact goal, an
explicit primary language, explicit role/language bindings, bounded observation
data, draft count, variant axes, and finite production ceilings. A separate
four-root technical record must bind the exact request bytes and contain PASS for
Truth, Agency / non-domination, Continuity, and Wisdom over speed.

Only then does the planner compose the existing language organ, grammar profile,
specialist eye, discipline/template direction, machine-cheatcode guidance,
route/prebuild twin, machine keyboard, admission policy, production draft slots,
budget, Build Window state, and Work Context card. All 102 organs remain
available as alternatives, but the planner never silently chooses one.
Case-normalized language or role aliases are refused instead of being silently
collapsed, and request/root-gate verification performs an exact deterministic
rebuild so recomputing a digest cannot legitimize undeclared or contradictory
fields.

The result contains planning records and empty editable draft slots. It generates
no source, calls no provider, executes no candidate or tool, reads or mutates no
workspace, installs nothing, selects no winner, and cannot merge, promote, or
change CANON. Renderer, developer-relationship evidence, reasoning-trace review,
enforced sandbox execution, candidate admission, and integration remain typed
later seams with their own evidence and authority.

Run:

```powershell
node shared/code-capability-fabric/language-organs/selftest-code-creation-session-planner.js
```

## Evidence-bound capability lessons and release candidates

The additive v2.13 `TEST` rung can seal one privacy-safe lesson candidate for
any of the fourteen existing code-specialization knowledge lanes. It binds
typed rules to exact provenance, support, contradiction, unknown, reuse-rights,
four-root, resource, and human-direction references. Fixed regressions and
separately authored held-out goals remain distinct, unscored evidence.

A fully consistent packet may produce an immutable, inactive, exact-next-patch
library release candidate with its parent preserved as the rollback target. It
does not mutate the reference library, a running creation attempt, or any
workspace. Rights-authority identity is not independently verified here, so a
technical pass still requires that verification, an authenticated Tier-3 human
decision, and a separate trusted host admission. No reward loop, automatic
learning, installation, integration, publication, promotion, or CANON authority
is added.

See [README-capability-lesson-steward-v1.md](README-capability-lesson-steward-v1.md)
and run:

```powershell
node shared/code-capability-fabric/selftest-capability-lesson-steward-v1.js
```
