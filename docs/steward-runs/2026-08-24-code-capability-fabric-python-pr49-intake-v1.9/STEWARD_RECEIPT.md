# Code Capability Fabric Python PR49 Intake v1.9 Receipt

Status: `TEST`

Date: 2026-08-24

## Outcome

PR49's exact Python v1.2 donor payload is now preserved on the current Code
Capability Fabric review lineage under
`experimental/capability-bodies/python/`. It remains a byte-bound
`DETACHED_CANDIDATE`: it is not registered, installed, imported, executed,
promoted, published, or CANON.

This is an intake integration, not active Fabric wiring. The donor is useful
research material for a future Python specialist body, but its executable
runtime has authority and portability gaps that must be repaired or excluded
before activation.

## Lineage

- Intake branch:
  `codex/code-capability-fabric-python-pr49-intake-v1.9`
- Fabric review parent:
  `84aa4e2d3899806e2469fec174d84274ad45dd7a`
- PR49 declared base:
  `fd6ec98a6a98a6666a980c359730ccec57a8cbe9`
- PR49 exact source head:
  `6132a8d0c15604ffb0360d2e2abe0a3485217a16`
- Local transplanted payload head:
  `dbea6c187ed8e2a76f4284561c26ae1b9c2d35f5`
- Seventeen PR commits were cherry-picked in their original order because a
  direct history merge produced widespread unrelated conflicts.
- Exact donor payload: 16 new paths; no existing Workshop path was overwritten.

## Static intake evidence

- ZIP bytes: 217,292.
- ZIP SHA-256:
  `8b4d20cdd97960a2c552d130d37ea81d04e05e77b3388822a67b53cac3b90a6f`.
- Archive entries: 168; uncompressed bytes: 596,405.
- Python files: 107.
- ZIP CRC check: PASS.
- Internal `SHA256SUMS.txt`: 167 of 167 entries verified.
- Portable archive path scan: PASS; no traversal, absolute, drive, UNC,
  backslash, stream, or case-collision entry was found.
- All included JSON and TOML documents parsed.
- All 107 Python files parsed into Python ASTs without syntax error.
- A bounded secret-pattern scan found no private keys, provider tokens, or
  bearer authorization material.

Static parsing proves shape and byte integrity only. It does not prove runtime
behavior, sandbox containment, correctness, reuse rights, or host compatibility.
The donor's own `151/151 PASS` and `18/18 PASS` statements remain supplied
claims; this steward run did not reproduce them.

## Runtime review holds

The archive contains a real executor-shaped surface, not only a pure planner.
Concrete holds found during source review include:

- analyzer and sandbox modules start subprocesses and inherit selected host
  environment values, including `PATH`;
- adapter receipts retain raw stdout, raw stderr, executable locations, and
  other machine observations;
- sandbox receipts retain raw test stdout and stderr;
- the sandbox module imports Unix-only `resource` at module load and uses
  `preexec_fn`, so Windows compatibility is not established;
- sandbox policy values are converted but not independently range-checked
  before resource-limit calls;
- source, shadow, output, and evidence roots are not proven disjoint against
  canonical Windows aliases, junctions, or an input rooted at a temp ancestor;
- build paths reject basic traversal but do not close Windows reserved-name,
  alternate-stream, trailing-dot/space, Unicode-normalization, junction, and
  case-collision edges to the Workshop standard;
- static adapters declare policy-level offline behavior, not kernel-enforced
  network isolation;
- process termination and cleanup are not independently evidenced for complete
  descendant process trees;
- no direct-reuse license or other sufficient rights grant is present in the
  PR or archive.

These holds are why the active builder registry, recipe catalog, provider
catalog, Workshop permissions, and executor surfaces were left unchanged.

## Verification

- All 29 Code Capability Fabric selftest files: PASS.
- Shared Capability Fabric: 92 PASS; composition: 27 PASS.
- Capability Recipe Foundry: 44 PASS.
- Capability Recipe Foundry package test: 47 PASS.
- Capability Recipe Admission Gate: 27 PASS.
- Capability Fabric tool wrapper: 15 PASS.
- Deterministic Organ Fabric: 50 shared PASS and 20 tool PASS.
- Hand Specification Foundry: PASS.
- City graph/schema/twin checks: PASS; city gates: 32/14/15 PASS.
- All ten required `AGENTS.md` commands: exit 0.
- `verify.js`: 0 FAIL, 21 warnings, spine `b618c5762240070c`.

The 21 warnings remain visible: 20 game-QA evidence warnings and one legacy
`UNDECLARED` manifest-kind warning.

## Execution truth

Trusted existing Workshop JavaScript selftests ran. Some existing Foundry and
admission tests explicitly execute already reviewed temporary fixtures; their
scope and host limitations remain as previously disclosed.

No Python donor file was imported, compiled, installed, or executed. No donor
selftest, sandbox probe, analyzer, subprocess, provider, network route, browser
render/click journey, installation, promotion, publication, CANON action, or
physical actuation was run.

## Four-root disposition

- Truth: exact donor bytes, supplied claims, static inspection, trusted
  Workshop regressions, and unproven runtime behavior remain separate.
- Agency / non-domination: intake grants the donor no active capability,
  permission, execution, learning, installation, or promotion authority.
- Continuity: PR49's exact source head and commit order are preserved on a new
  review branch without rewriting the current Fabric or canonical Workshop.
- Wisdom over speed: the useful Python donor is retained now while executable
  wiring waits for rights, contract decomposition, repair, and a later Mike
  decision.

Technical result: `TEST` intake complete; active Python capability remains
`HOLD`. Mike remains the integration and merge gate.
