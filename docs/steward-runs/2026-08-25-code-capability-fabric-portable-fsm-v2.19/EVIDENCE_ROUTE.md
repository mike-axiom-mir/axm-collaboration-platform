# Evidence route — portable FSM definition specialist v2.19

Status before implementation: `BLOCKED`

## Claims

### fsm-definition-exists

- Claim: one active source-reviewed recipe and exact specialist profile can
  deterministically emit an inert `axm.game-fsm/v1` definition module.
- Kind: existence and static structure.
- Risk: medium.
- Pass condition: exact catalog, builder, profile, schema, artifact, and digest
  bindings parse and agree; repeated builds are byte-identical.
- Primary surface: direct package inspection and deterministic rebuild.
- Counterevidence: missing or ambiguous binding, digest drift, mutable embedded
  definition, unknown fields, or output other than the declared FSM contract.
- Secondary surface: package schema and recursive registry selftests.
- Before verdict: `FAIL`; no such recipe, builder, or profile exists.

### existing-runtime-composition

- Claim: the emitted definition is accepted by the existing
  `shared/game-fsm` runtime and produces the declared deterministic trace.
- Kind: deterministic behavior and contract composition.
- Risk: medium.
- Pass condition: a byte-verified candidate loaded only from a disjoint
  temporary fixture is passed to the existing trusted runtime; declared event
  traces reach exact states and repeated traces are identical.
- Primary surface: focused trusted-host fixture execution.
- Counterevidence: runtime rejection, trace drift, copied runtime logic inside
  the candidate, unresolved targets, duplicate events, or unreachable states.
- Secondary surface: existing `shared/game-fsm/selftest.js` and static scan.
- Before verdict: `UNKNOWN`; the runtime exists, but there is no generated
  definition to compose.

### bounded-hostile-definition-refusal

- Claim: malformed or authority-bearing definition requests fail before
  candidate emission.
- Kind: deterministic behavior, authorization, and resource boundary.
- Risk: high.
- Pass condition: duplicate/reserved identifiers, duplicate events, missing
  targets, unreachable states, executable handler fields, unknown keys,
  accessor-bearing inputs, state/transition excess, and byte excess fail closed
  with zero partial candidate.
- Primary surface: builder countertests and focused adversarial proof.
- Counterevidence: candidate bytes emitted, getter execution, authority field
  acceptance, partial build, or implicit runtime/handler creation.
- Secondary surface: forbidden-surface scan and candidate authority inspection.
- Before verdict: `FAIL`; no builder or refusal surface exists.

### zero-lifecycle-authority

- Claim: generation neither runs the candidate nor grants install, integration,
  publication, promotion, merge, roots, or CANON authority.
- Kind: authorization.
- Risk: high.
- Pass condition: exact request, profile, candidate, package, and receipt
  boundaries remain false/empty and static source contains no provider,
  network, filesystem, process, environment, clock, randomness, or dynamic-code
  surface.
- Primary surface: parsed authority records plus static source inspection.
- Counterevidence: any granted permission, automatic handoff, self-execution,
  self-install, self-promotion, or Foundation/Atlas mutation.
- Secondary surface: package, composition, and Workshop verification suites.
- Before verdict: `PASS` for the existing Fabric substrate; the new candidate
  still requires proof.

### continuity-preserved

- Claim: the new recipe composes with, and does not replace, the existing Game
  FSM/FSM Kit or regress earlier Fabric abilities.
- Kind: static structure and deterministic behavior.
- Risk: high.
- Pass condition: existing runtime source is unchanged, its focused selftest
  passes, all prior recipes/profiles remain exact, recursive Fabric checks pass,
  generated projections are current, and all required Workshop checks pass.
- Primary surface: Git diff plus focused and recursive test suites.
- Counterevidence: existing-runtime changes, omitted recipe/profile, digest
  substitution, stale projection, or prior test regression.
- Secondary surface: full `AGENTS.md` verification.
- Before verdict: `UNKNOWN` until implementation and final-state checks.

Browser rendering is not a claim for this nonvisual rung. A syntax or fixture
pass must not be relabelled as visual evidence. Taste, full gameplay quality,
general executor safety, installation, and product readiness remain separate.
