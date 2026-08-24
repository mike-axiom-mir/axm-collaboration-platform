# AXM Capability Fabric v1

Capability Fabric is the Workshop's deterministic **how** layer. It compiles a
reviewed, digest-bound build request through one exact source-reviewed recipe
into a detached capability candidate. Ordinary builds require no provider,
model, API key, network request, or repeated reasoning compute.

The composition layer can bind two to sixteen reviewed candidate builds into a
bounded directed acyclic graph. Every edge must name one exact contract emitted
by its source and consumed by its target. Root inputs, expected outputs, node
and edge ceilings, aggregate package bytes, topological order, runtime modes,
and required host capabilities are digest-bound in the composition plan.

The existing Deterministic Organ Fabric remains the reused declarative kernel
and specialized compatibility surface. This layer adds a generic recipe
catalog and complete candidate materialization for modular capabilities.
`HAND` recipes bind one explicit source language, entry path, and selftest path;
legacy JavaScript HANDs remain `capability.js` plus `selftest.js`, while the
first Python lane binds `capability.py` plus `selftest.py`. `SKILL` recipes bind
portable `SKILL.md` plus an explicit instruction-only, host-mediated, or
executable runtime. Kind and artifact layout are digest-bound from recipe
through plan, compilation, candidate, module contract, and receipt.

## Truth boundary

- One candidate is built by default. A recipe contract can explicitly declare
  variants and must name its default variant without turning ranking into
  authority. Variant overrides are resolved and validated during planning.
- Missing, ambiguous, inactive, invalid, unreviewed, or resource-exceeding work
  returns a typed hold.
- Imported Mirror, Code Fabric, AI, or external recipes remain inactive
  proposals until source review and Mike's merge decision. Proposal drafts use
  a separate inactive schema and cannot claim active-recipe status.
- Generated tests are files in the candidate. Capability Fabric does not
  execute generated code.
- Candidates remain `EXPERIMENTAL`, detached, uninstalled, unregistered,
  unstaged, unpromoted, and non-CANON.
- The Detached Candidate Nursery may prove structural readiness for later
  intake. That is not runtime, visual, safety, installation, or CANON proof.
- Candidate verification checks byte lineage and the authority-bearing package,
  manifest, compilation receipt, candidate receipt, and module contract. A
  self-consistent rehash cannot convert detached material into authority.

## Core contracts

- `axm.capability-fabric.build-request/v1`
- `axm.capability-recipe/v1`
- `axm.capability-build-plan/v1`
- `axm.capability-candidate-package/v1`
- `axm.capability-build-receipt/v1`
- `axm.capability-recipe-proposal/v1`
- `axm.capability-recipe-draft/v1`
- `axm.modular-capability-recipe-contract/v1`
- `axm.modular-capability-contract/v1`
- `axm.capability-composition.request/v1`
- `axm.capability-composition.plan/v1`
- `axm.capability-composition.build/v1`
- `axm.capability-composition.verification/v1`

## Composition truth boundary

- Composition proves exact declared contract identity, acyclic order, child
  request/recipe/builder/package lineage, resource ceilings, and deterministic
  rebuild parity.
- It does not claim that equal contract labels guarantee runtime payload
  semantics. Node selftests and end-to-end behavior require separate trusted
  host execution and evidence.
- A host-mediated `SKILL` remains host-mediated inside a graph. Its required
  host capabilities are surfaced in the plan and never inherited as authority.
- A held graph emits no partial candidate set. The Fabric never executes a node,
  installs output, changes permissions, promotes material, touches Foundation,
  or changes CANON.

The reviewed catalog contains nine executable `HAND` recipes—a closed JSON
Schema validator, a strict bounded JavaScript string-record transform, a static semantic HTML-page renderer,
one bounded CSS token stylesheet, a strict text-only SVG status-badge creation
hand, a Workshop Direction hand-request adapter, and one bounded Python record
transform, plus a strict closed primitive-object contract adapter and a bounded
closed-record collection query—alongside one host-mediated portable `SKILL` for bounded evidence-first
capability review. The HTML renderer is source-reviewed on its review branch;
shared use still requires Mike's merge decision and visual behavior remains
unproven until a separate authorized browser run. The Python source and
selftest remain inert; runtime behavior is unproven until a separately
authorized disposable-sandbox run.

The JavaScript transform accepts only a closed own-data-property record whose
keys are safe bounded field names and whose values are bounded strings. It
refuses accessors without invoking them, symbols, custom prototypes, unsafe
fields, non-string values, excessive keys, and input/output byte overflow. It
emits one fresh declared string field and has no filesystem, process, provider,
network, environment, clock, randomness, or lifecycle authority. The narrow
trusted composition fixture proves this exact contract only; general
JavaScript and browser behavior remain unproven.

The closed-object adapter maps one declared flat primitive object contract into
another using explicit rename/copy/default/drop rules. Every source property
must be mapped or dropped and every target property must be mapped. The strict
v2 runtime refuses accessors without invoking them, symbols, hidden fields,
custom prototypes, unsupported primitive values, excessive properties, and
independently measured input/output byte overflow. It proves only successful
output shape compatibility, never domain meaning or end-to-end fitness.

The record-query hand accepts only closed primitive records under one reviewed
field declaration. It combines bounded typed predicates with `AND`, orders by
explicit unique keys, breaks ties by original input index, projects explicit
unique fields, applies an exact result limit, and reports scanned, matched, and
returned counts. It refuses sparse or decorated arrays, accessors, symbols,
custom prototypes, unknown fields, duplicate order/projection fields, unsafe
integers, unsupported operators, and input/output byte overflow. It is not SQL,
an expression evaluator, a grouping engine, or proof of domain meaning.

The SVG badge hand accepts only a closed plain JSON record containing optional
`label` and `value` strings. It refuses XML-invalid text and inherited
serialization hooks, enforces exercised input/output byte ceilings, XML-escapes
all accepted text, emits fixed text/rectangle/title markup, and has no raw SVG, path,
style, script, event, URL, external-resource, animation, provider, filesystem,
or network input. Static and trusted-fixture evidence do not prove browser
appearance, accessibility behavior, or visual quality.

Builder implementations now live behind a digest-bound modular registry.
Recipes, plans, candidate packages, and verification all bind the exact active
builder digest. The Foundry validator HAND entered the active registry through
the deterministic admission gate after exact packet inspection, trusted tests,
nine-case source review, and Mike's merge decision. The portable review SKILL
entered through the same route and remains instruction material: its authorized
host must re-check every capability and permission at use time. No review
authority is inherited. The registry retains the exact inactive
`closed-object-contract-adapter-v1` proposal as historical review material,
while normal builds on this `TEST` branch bind only the separately hardened
`closed-object-contract-adapter-v2`. Replaying v1 is collision-held with
`RECIPE_ID_ALREADY_ACTIVE`; it cannot replace v2 or produce a catalog diff.
Shared use of v2 still requires Mike's merge decision.
`tools/capability-recipe-admission-gate` has no apply or activation action.
