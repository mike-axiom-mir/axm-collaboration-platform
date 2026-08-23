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
- the exact builder contribution and authored selftest;
- the source specification and verification plan;
- a ten-gate source-review checklist;
- a digest-bound review packet and Foundry receipt.

The Foundry does not infer missing implementation semantics. It does not
execute builder source, generated capability code, or generated tests. A
trusted host may later run the emitted selftest explicitly; the result is
external evidence, not Foundry evidence.

## First pilot

The included pilot proposes `closed-json-schema-validator-v1`, a deterministic
builder that compiles a source-reviewed closed JSON Schema subset into a
bounded validator capability. The proposal is complete enough for source
review and independent test execution, but it is not added to Capability
Fabric's active builder list or recipe catalog.

## Verify

```powershell
node tools/capability-recipe-foundry/selftest.js
node tests/capability-recipe-foundry-package-test.js
```

Browser rendering and interaction remain a separate verification surface.
Mike remains the merge and CANON gate.
