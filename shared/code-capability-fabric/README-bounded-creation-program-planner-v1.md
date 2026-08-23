# Bounded Creation Program Planner v1

Status: `TEST`

This pure provider-neutral planner broadens Code Capability Fabric from one
recipe or artifact type to a typed graph of artifacts across arbitrary domains.
It gives “create anything imaginable” an honest technical shape without
claiming the requested capabilities already exist.

```text
human-authored typed goal
  + artifact dependency graph
  + exact capability requirements
  + existing Fabric v2 route plans
  + permissions, network, resource, privacy, rights, and lifecycle settings
  + ordered four-root evidence references
  -> deterministic bounded creation program
  -> domain-native evidence routes (UNKNOWN / NOT_RUN)
  -> Hand Specification Foundry-compatible typed gaps
  -> separate consent, generation, execution, review, and Mike integration gates
```

Domains and artifact schemas are portable identifiers rather than a closed
hard-coded catalog. Software, games, entertainment, system, simulation, and
future-domain artifacts can therefore share one dependency graph. The planner
does not infer capabilities from free text: a human, Review Inbox adapter, or
future trusted compiler must supply the exact typed requirements.

## What is technically new

- Deterministic topological ordering with cycle, unknown dependency, depth,
  artifact-count, requirement-count, step-count, input-byte, and output-byte
  bounds.
- One exact Fabric v2 route plan per capability requirement. Provider ambiguity,
  stale or held routes, schema drift, forged digests, and route duplication fail
  closed or become typed gaps.
- A second permission, network, mutability, source-use, and resource
  intersection at the whole-program boundary. A route may fit its local request
  and still be refused by the human's broader creation settings.
- Evidence routing by claim kind. Static, deterministic, visual, motion,
  interaction, persistence, transport, authorization, performance, resource,
  learning, quality, and taste claims retain their native proof surfaces.
- Taste or meaning requires a human seat. Planning cannot replace that judgment
  with a machine verifier or score.
- Consequence and lifecycle mappings expose minimum new consent tiers from 1
  through 5. Higher tiers never inherit authority from planning or lower tiers.
- Typed missing-capability reports are directly accepted by the existing
  Workshop Hand Specification Foundry. A specification remains a draft and
  never pretends the hand is implemented.
- Durable program records omit raw goal, purpose, acceptance-statement, source,
  stdout, stderr, private-content, and machine-path text. They retain digests,
  identifiers, declared bounds, UNKNOWN evidence routes, and limitations.

## Truth and authority ceiling

The best v0.8 result is `READY_FOR_DETACHED_CANDIDATE_REQUEST`. It means only
that the typed graph and all supplied route-plan claims align with the bounded
settings. It is not semantic understanding, provider execution, artifact
generation, verification, authentication, resource enforcement, installation,
integration, publication, learning admission, model training, physical
actuation, promotion, or `CANON`.

Route plans and their host observations remain input claims; v0.8 does not
independently trust the observer or execute the provider. Optional AI is visible,
off by default, exact-provider-bound when enabled, uncalled, and untrusted.

Possible program statuses:

- `ROOTS_HOLD`
- `CAPABILITY_GAPS`
- `REUSE_RIGHTS_HOLD`
- `HIGHER_TIER_CONSENT_REQUIRED`
- `READY_FOR_DETACHED_CANDIDATE_REQUEST`

Mike remains the final merge gate after every technical and human review gate.

## Verify

```powershell
node shared/code-capability-fabric/selftest-bounded-creation-program-planner-v1.js
node tools/hand-specification-foundry/selftest.js
node shared/code-capability-fabric/selftest-v2.js
```

No visual surface changes in this rung. Browser testing is therefore N/A unless
a later integration adds a Review Inbox rendering for the new records.
