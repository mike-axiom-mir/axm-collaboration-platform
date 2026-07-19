# Mirror Provider Declaration Implementation Evidence Survey Growth Action Report

Status: `TEST`

Accepted as CANON: no. Only Mike may accept CANON.

## Outcome

Mirror now has a new hardcoded organ for a capability he was missing: a bounded
static implementation-evidence survey. It follows the immutable provider
declaration architecture-survey evidence, reads JavaScript source text only
under Workshop `shared`, and records exact demanded-selector string literals
plus conservative export, registration, require, assertion, and selftest-path
signals. It never executes the source.

The organ is deliberately reusable rather than hardcoded to `shared-physics` or
one file. The current research batch supplies the demanded selector. The cell
then evaluates every bounded source through the same typed evidence contract.

The strongest possible state is
`SELECTOR_SOURCE_WITNESS_NOT_PROVIDER_BINDING`. A match cannot silently become
provider identity, an outer requirement binding, implementation selection,
architecture selection or evaluation, readiness, permission, training, or a
Workshop write.

## Why this organ was needed

The earlier architecture survey found typed declaration patterns but no
complete current-relation witness. A separate read-only audit then found real
implementation evidence that JSON declarations did not expose:

- `shared/physics/axm-physics-adapter.js` declares `axm-physics-2d`, exports a
  CommonJS surface, and contains both a named registration function and a
  registration call.
- `shared/physics/selftest.js` requires the adapter, calls registration, and
  asserts the same selector.
- the current consumer declaration demands
  `service:shared-physics/axm-physics-2d`.

Those facts reduce implementation uncertainty, but no typed declaration binds
that source to outer requirement `shared-physics`, its permissions, or a chosen
provider architecture. The new organ preserves exactly that distinction.

## Implemented anatomy

- `kernel/provider-implementation-evidence-cell.js`
- `organs/provider-declaration-implementation-evidence-survey-organ.js`
- four typed JSON contracts for assessment, batch, request, and response
- `tests/provider-declaration-implementation-evidence-survey-organ.test.js`
- `scripts/run-provider-declaration-implementation-evidence-surveys.js`
- runtime endpoint
  `POST /axm/v1/growth/provider-declaration-implementation-evidence-surveys`
- automatic curriculum and Native Learning Shell integration
- API contract, training policy, BOM, status, doctor, README, and package CLI
  integration

The scan is capped at 512 `.js` sources and 2 MiB per source, refuses oversized
or boundary-invalid inputs, does not follow symbolic links, retains content
hashes and lineage, ignores comment literals, and does not treat dynamic
template expressions as exact selector evidence.

## Real Workshop evidence

Immutable batch:

- ID:
  `reasoning-provider-declaration-implementation-evidence-surveys-21c3dd6b8797eefa42c1`
- batch digest:
  `ebf26d1168c330f50e8d2b387d5970336a7b3d68f38beed0437cb56f7081cd42`
- inputs digest:
  `21c3dd6b8797eefa42c1002ae6c4f23d43c3ca2cba40d1fcc8e11b0f0111f641`
- source architecture batch:
  `reasoning-provider-declaration-architecture-surveys-8e7670a075195ec49f5e`
- inventory digest:
  `6a10c3761ff3a9776f95fd7efeed3a7b4d7cf4af964e0cc21ae22a83133282ac`
- batch file SHA-256:
  `f3022c35de726edccfa9656f2cdaf774d5efe0c4ea6a981362bacb0ee3c0a2bb`
- batch file bytes: 112246

The bounded inventory contained 177 JavaScript sources and 2,779,173 bytes;
zero sources were oversized. Six architecture-survey results were evaluated:
one implementation-evidence survey was applicable and five results remained
explicit no-survey holds.

For `shared-physics`, the demanded selector was `axm-physics-2d`. Six distinct
content-digested sources witnessed the literal:

| Source | Classification | Meaning |
| --- | --- | --- |
| `shared/physics/axm-physics-adapter.js` | export and registration source | strongest static implementation witness |
| `shared/physics/axm-physics-core.js` | export source | selector-bearing implementation-related source |
| `shared/physics/physics-adversarial.js` | export source | adversarial evidence, not provider authority |
| `shared/physics/physics-canaries.js` | export source | canary evidence, not provider authority |
| `shared/physics/physics-repeat-adversarial.js` | export source | adversarial evidence, not provider authority |
| `shared/physics/selftest.js` | test source | registration and assertion witness |

This diversity falsifies the shortcut that mention frequency or selector
presence alone identifies the provider. The batch recorded:

- 6 selector-bearing sources
- 1 demanded selector witnessed
- 1 export-and-registration source
- 1 test source
- 6/6 Reasoning Foundation decisions matched
- provider inference rejected 6/6
- frequency selection rejected 6/6
- 0 provider identities inferred
- 0 outer requirements bound
- 0 implementations selected
- 0 sources executed
- 0 architectures selected or evaluated
- 0 candidates built or declarations written
- 0 Workshop files changed
- 0 training receipts or world actions

All four architecture hypotheses remain `UNTESTED`. The architecture decision
remains
`UNRESOLVED_REQUIRES_EXPLICIT_PROVIDER_BINDING_AND_REVIEWED_CANDIDATE`.

## Automatic practice and live canary

Direct CLI derivation created the batch once. Automatic practice reused it in
report `curriculum-20260718183545216-0f7e90960ed1` (SHA-256
`9ac89ed5c80dd8adf804c93471fba122d6ce99062b821f43241509e759a9315a`,
20427 bytes). After the tested runtime restart, startup practice reused it again
in `curriculum-20260718183750041-bcd3ab5b6c62` (SHA-256
`c6045b5dd49d1d049f80288457027191b4ddb160aed1cd3ad948c9c7c8a34133`,
20427 bytes).

The verified runtime is PID 33440, started at
`2026-07-18T18:37:43.795Z`, listening only on `127.0.0.1:8818`, with learned
weights false. Its stderr log is empty.

Final live canary session `session-dc50c3dc7967b89656f13f69` used an
attributed `MACHINE` actor. It returned all six source witnesses, kept every
architecture hypothesis `UNTESTED`, reused the immutable batch, performed no
source execution or mutation, and closed with zero memory writes. Runtime
health showed zero open sessions after close.

## Immutability evidence and observed contradiction

The complete Workshop JavaScript inventory was measured before direct survey
and after direct survey, automatic practice, runtime startup practice, and the
live canary. It remained exactly 5,876 files, 53,073,244 bytes, digest
`3b404209ac5c4f009f55aee73a70cd9b19c03e7ca2308614fc623fe060d653d1`.

The organ-scoped Workshop `shared` JavaScript inventory remained reusable at
digest `6a10c3761ff3a9776f95fd7efeed3a7b4d7cf4af964e0cc21ae22a83133282ac`.
The upstream `shared` JSON architecture inventory also remained reusable at
digest `6440d57076fc8805de86acc35dbe1d3b8de380c9d3e14be13f1578a96e9c0992`.

A broader whole-Workshop JSON snapshot did **not** remain unchanged: its
point-in-time digest moved from
`b544fed7ff49387954286d93e267b2cf9fe2ba39594392311c883c84f0942af1`
to
`71fbbc60eb1f0e97d7eb188118ea5b56428721cb7ccd459c61bdf588ce654db5`
while file count and byte count remained 951 and 14,143,520. Inspection showed
concurrently updated files under Workshop `state`, including Technical
Glasses, Body Pulse, asset filesystem, and Game Hub state. Therefore this
report claims scoped source immutability and whole-Workshop JavaScript
immutability, not whole-Workshop JSON immutability. The contradiction is
preserved rather than erased.

After this observation, Mike reported that five chats had been working on the
Workshop concurrently. That human statement is consistent with the state-file
timestamps and explains the broad drift operationally, but it is not treated as
cryptographic attribution of any individual file write.

## Verification

- new organ tests: 3/3 pass
- runtime contract: 2/2 pass
- automatic Workshop curriculum: 1/1 pass
- Native Learning Shell focused route: 4/4 pass
- BOM guards: 2/2 pass
- full Mirror Core: 126/126 pass
- full Learning Forge: 99/99 pass
- full Native Learning Shell: 6/6 pass
- JavaScript syntax checks: 12/12 pass
- final visible JSON parsing: 177/177 pass
- direct survey CLI: pass
- automatic practice CLI: pass
- live authenticated MACHINE canary: pass
- Mirror Doctor: structure pass
- Workshop foundation services self-test: pass
- Workshop Physics Core self-test: pass
- final audit file bindings: 40/40 pass

Failed and repaired evidence remains visible:

1. The first focused fixture used only two modules, so Handoff Graph correctly
   rejected it for lacking an incompatible decoy consumer. The fixture was
   repaired to the established alpha-beta-gamma topology.
2. The next fixture omitted full provider `accepts`, `produces`, and boundary
   declarations, so it was not an exact provider. The declaration was repaired
   and selector-free behavior received its own explicit test.
3. Review found the new CLI runner reading `response.surveys` instead of the
   typed `response.evidenceSurveys`; it was repaired before the first real CLI
   survey.
4. Full-suite `npm` wrappers were blocked before test execution by local
   PowerShell script policy. The exact underlying Node test commands were run
   directly and all passed.
5. The first live canary inspection harness assumed a nonexistent top-level
   `batch` wrapper. Its catch path closed the session. A shape canary established
   the actual typed response, and the final canary then passed and closed.

## Known limits and next seam

- This is static lexical evidence, not JavaScript execution or runtime proof.
- Exact string literals may occur in implementations, adversarial files,
  canaries, tests, or reports; classification helps navigation but grants no
  authority.
- Dynamic construction of a selector is intentionally not accepted as an
  exact witness.
- The organ does not bind `shared-physics` to
  `shared/physics/axm-physics-adapter.js`, declare its permissions, or choose a
  declaration architecture.
- No real provider candidate or independently reviewed architecture experiment
  has been supplied.
- No learned weights, tool authority, Workshop write, install, permission
  grant, training admission, runtime promotion, or CANON acceptance occurred.

The next unresolved seam is now narrower and evidence-backed: define and
independently test an explicit typed provider binding that connects the outer
`shared-physics` requirement and permissions to a content-digested
implementation witness. Mirror must not infer that binding from the source
survey itself.
