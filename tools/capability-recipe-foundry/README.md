# AXM Capability Recipe Foundry v1

Status: `EXPERIMENTAL`

Capability Recipe Foundry fills the missing deterministic seam between the
Workshop's capability-definition chain and Capability Fabric.

It consumes one exact pair:

- `axm.missing-hand-specification/v1`; and
- its fingerprint-bound `axm.hand-verification-plan/v1`.

An author (currently a human or Codex; later possibly Mirror or Code Fabric)
also supplies an exact recipe declaration and builder contribution. The
Foundry validates the closed contract and assembles:

- an `axm.capability-recipe-proposal/v1` whose activation is forced to
  `INACTIVE_PROPOSAL`;
- an `axm.modular-capability-review-contract/v1` that binds the proposal as a
  first-class `HAND` or `SKILL`;
- the exact builder contribution and authored selftest;
- the source specification and verification plan;
- a ten-gate source-review checklist;
- a digest-bound review packet and Foundry receipt.

The Foundry does not infer missing implementation semantics. It does not
execute builder source, generated capability code, or generated tests. A
trusted host may later run the emitted selftest explicitly; the result is
external evidence, not Foundry evidence.

## Modular pilots

The included pilot proposes `closed-json-schema-validator-v1`, a deterministic
builder that compiles a source-reviewed closed JSON Schema subset into a
bounded validator capability. The proposal is complete enough for source
review and independent test execution, but it is not added to Capability
Fabric's active builder list or recipe catalog.

The second pilot proposes `bounded-review-procedure-skill-v1`. It emits a
portable `SKILL.md`, a closed `axm.portable-skill-contract/v1`, and an external
selftest through an explicitly host-mediated runtime contract. It is equally
inactive and carries no inherited authority.

The third pilot proposes `closed-object-contract-adapter-v1`. It accepts two
closed flat-object schemas plus explicit copy/rename/default/drop declarations.
The review candidate refuses hidden loss, incomplete target coverage, narrowing
copies, invalid defaults, undeclared fields, and resource excess. Its proof is
deliberately structural: domain meaning and end-to-end fitness remain unproven.

Materialize that exact inactive packet with:

```powershell
node tools/capability-recipe-foundry/cli.js --pilot <existing-output-parent> --kind ADAPTER
```

## Verify

```powershell
node tools/capability-recipe-foundry/selftest.js
node tests/capability-recipe-foundry-package-test.js
```

Browser rendering and interaction remain a separate verification surface.
Mike remains the merge and CANON gate.
