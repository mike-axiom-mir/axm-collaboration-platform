# AXM Mirror Local

Mirror is an experimental AXM-native machine reasoning body. Its internal
contract is structured state: observations, evidence, unknowns, constraints,
candidate actions, consequences, permissions, decisions, and repair notes.
Human language is an equal collaboration surface rendered from the same trace;
it is not a hidden replacement for the machine record.

Current release: `0.0.0-seed`

Current status: **EXPERIMENTAL KERNEL — NO LEARNED WEIGHTS**

Seed-0 can:

- run locally with Node.js and no package installation;
- open explicit bounded sessions;
- evaluate supplied candidate actions with a deterministic Principle Cell;
- preserve unknowns, contradictions, evidence lineage, and permission holds;
- return both a machine trace and a plain-human explanation;
- publish a finite presence heartbeat to a running AXM Workshop;
- stop without affecting the Workshop;
- accept reviewable, rights-cleared teacher artifacts as unpromoted future
  compression candidates.

Seed-0 cannot:

- generate open-ended answers or plans;
- learn, train, see, use tools, write Workshop files, or access the internet;
- claim consciousness, general intelligence, completion, or safety proof;
- harvest private chain-of-thought or silently train on provider output.

## Start

Double-click `START_MIRROR_LOCAL.bat`.

Default runtime: `http://127.0.0.1:8818`

Public read-only endpoints:

- `GET /health`
- `GET /capabilities`
- `GET /v1/models`

Reasoning endpoints require the local bearer token stored in
`state/runtime-token.txt`. Browser clients should use the Workshop's same-origin
proxy so the token never enters browser code.

When the AXM Workshop is running, Mirror appears in AI Team as a background
machine-native research body. It is registered after every existing connector,
so Seed-0 is visible and selectable but never becomes the default language
route. The Workshop does not start Mirror automatically.

## Verify

Run `TEST_MIRROR_LOCAL.bat`. The suite uses only Node.js standard-library
modules and does not contact the network.

## Future compression intake

`training/TRAINING_POLICY.json` and
`contracts/teacher-artifact.schema.json` define what can enter the candidate
corpus. Use `npm run intake:teacher -- path-to-artifact.json`. Intake requires
explicit use permission and stores a `CANDIDATE`; it performs no training and
no canon promotion.

## Naming

- Human display name: **Mirror**
- Native identity: `axm.machine.mirror/seed-0`
- Initial provider ID: `mirror-kernel`
- Semantic signature: `OBSERVE -> MODEL -> COMPARE -> VERIFY -> REPAIR`

The imported Maccie route is preserved unchanged under `docs/source-route/` as
the prior working name and research source.
