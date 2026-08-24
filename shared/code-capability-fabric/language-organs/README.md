# AXM Code Language Organs v2.2

Status: `TEST`

This layer turns the AXM Code Body Priority List into **102 separately addressable
physical code/language organs**. It is intentionally not one universal code blob.
Each organ now carries several independently testable layers rather than only a
language label.

## 1. Language organ identity

Every `organs/NNN-name/organ.json` owns a distinct language ID, detection signals,
family, toolchain candidates, evidence boundary and SHA-256 identity. Shared
mechanics live underneath in `families.json`; language identity does not collapse
into the family.

`registry.js` is deterministic and caller-data-only: basename, path context,
longest extension, then shebang. It does not inspect a workspace or execute
tools. Ambiguous cases such as `.m` and `.v` return `SELECTION_REQUIRED` rather
than guessing.

All organs expose the reference path:

`parse -> understand -> projectGraph -> dependencies -> api -> impact ->
affectedTests -> architecture -> refactor -> verificationAdapters -> sandbox ->
evidencePassport -> rollback -> governanceReturn`.

## 2. Grammar-native profile

Every organ contains `grammar.profile.json`, digest-bound back to its organ. The
profile describes that grammar's constructs, dependency forms, scope/type/state
model, semantic hazards, high-risk rewrites and native verification focus.

Examples are intentionally different rather than cosmetic:

- Rust watches ownership, borrowing, lifetimes, traits, unsafe boundaries and drop
  behavior.
- Helm treats Go-template semantics and YAML structure as a dual grammar.
- DAX watches row/filter context, relationships and context transition.
- VHDL watches concurrent design units, signals vs variables, delta cycles and
  synthesis/simulation behavior.

`build-grammar-profiles.py --check` and `selftest-grammar-profiles.js` refuse
profile drift and require all 102 profile bindings to remain distinct.

## 3. Human-developer perspective

`human-developer-perspective.json` records a source-bound **review heuristic**
layer derived from empirical work on expert program comprehension, debugging and
modern code review. It does not pretend to reproduce a human developer or treat
expertise research as authority.

The shared dimensions are:

- system model
- goal mapping
- pattern/chunk recognition
- change impact
- hypothesis/debugging discipline
- alternative-solution search
- rationale/knowledge transfer
- uncertainty discipline

These dimensions influence what each code eye asks before recommending a change,
but cannot execute or authorize one.

## 4. 102 code-native specialist eyes

Every organ also contains `specialist.eye.json`. Each eye is independently
SHA-bound to:

- its language organ digest,
- its grammar-profile digest, and
- the shared human-developer-perspective digest.

An eye reviews a caller-supplied build observation from its own grammar-native
perspective. It knows what structures and hazards it should notice first, what
native verifier it would trust, and where that language may be an overlooked
option.

The deterministic generator and registry are:

- `build-specialist-eyes.py`
- `specialist-eye-registry.js`
- `selftest-specialist-eyes.js`

The permanent language gate requires exactly **102 generated eyes with 102 unique
eye digests** and fails if any eye or binding drifts.

## 5. Code-native Discovery Seam + capability gaps

`code-native-discovery-seam.js` lets the 102 eyes review the same bounded,
caller-supplied observation without giving them workspace access. Every eye must
produce one explicit state:

- `NATIVE_REVIEW` — its language is already present, so it reviews native risks
  and gaps.
- `DISCOVERY_CANDIDATE` — its language/grammar appears materially relevant even
  though it is not active, so it proposes a comparison.
- `WEAK_SIGNAL` — there is some relevance but not enough evidence to recommend a
  language comparison.
- `NOT_RELEVANT` — this eye has no justified contribution.

The seam can surface capability-gap candidates such as missing native
abstractions, verifier gaps, semantic-hazard exposure, unresolved dependency
boundaries and cross-language opportunities.

A discovery candidate is **not a decision**. It cannot switch languages, rewrite
code, install dependencies, or promote anything. It suggests a bounded comparison
and a verifier that could falsify the idea.

The seam also refuses to invent *why* an option was overlooked. Reasons such as
speed pressure, knowledge gap, default-stack bias or unavailable tooling are
reported only when the caller explicitly supplied that pressure. Otherwise the
cause remains unknown.

A regression test also prevents generic syntax vocabulary from becoming
cross-language spam. For example, VHDL cannot volunteer itself for an ordinary
TypeScript frontend merely because the observation contains the generic word
"architecture".

## Evidence coverage

The separate CI evidence union still requires all **102/102 code bodies** to have
at least one bounded parser, compiler/front-end, interpreter, validator or
equivalent structural handling path. The evidence layers overlap by design:

- stock native smoke probes,
- the pinned Tree-sitter language pack,
- targeted last-mile adapters for the uncommon code bodies.

This does **not** claim that all 102 are literal compilers, that arbitrary programs
are semantically correct, or that every runtime is proven.

PR #51 remains the exact source-reviewed Python donor for its bounded recipe.
Source review remains distinct from runtime proof.

## Creation-session composition

`code-creation-session-planner.js` is the provider-neutral composition seam over
the stacked language-organ work. It requires the four roots to PASS for the exact
request plus a caller-explicit primary language and role bindings. It then binds
one deterministic plan across grammar, specialist-eye, discipline/template,
cheatcode, route/prebuild, keyboard, admission-policy, production-budget,
Build Window, and Work Context records.

This closes the difference between “the 102 organs exist” and “the Creation
Fabric can address them coherently.” It still does not render source or execute
software. Missing required role bindings, stale root evidence, unknown languages,
or an initial draft set outside the declared budget produce typed holds.
Case-normalized identifier aliases fail closed, and currentness checks compare
the request and root gate with exact deterministic rebuilds rather than trusting
a recomputed digest over an internally contradictory record.

## Authority boundary

Capability is not authority. These registries and eyes:

- read only caller-supplied observation data,
- mutate no workspace content,
- execute no tools,
- use no network,
- install nothing,
- cannot auto-repair,
- cannot auto-switch languages,
- cannot auto-promote,
- cannot change CANON.

Run the focused checks with:

```powershell
python shared/code-capability-fabric/language-organs/build-grammar-profiles.py --check
node shared/code-capability-fabric/language-organs/selftest-grammar-profiles.js
python shared/code-capability-fabric/language-organs/build-specialist-eyes.py --check
node shared/code-capability-fabric/language-organs/selftest-specialist-eyes.js
node shared/code-capability-fabric/language-organs/selftest.js
node shared/code-capability-fabric/language-organs/selftest-adversarial.js
node shared/code-capability-fabric/language-organs/selftest-code-creation-session-planner.js
```
