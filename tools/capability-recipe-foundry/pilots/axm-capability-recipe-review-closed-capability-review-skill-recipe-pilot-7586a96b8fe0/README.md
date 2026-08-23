# Closed Capability Review Skill — inactive recipe review packet

Status: `EXPERIMENTAL` · activation: `INACTIVE_PROPOSAL`
Kind: `SKILL` · runtime: `HOST_MEDIATED`

Build a portable bounded capability-review procedure that a human or authorized agent host can follow without repeated model invention.

This packet binds one exact capability specification and verification plan to one authored builder contribution and one Capability Fabric recipe draft.

## Review route

1. Inspect `capability-specification.json` and `verification-plan.json`.
2. Review `builder-contribution.js` line by line.
3. In an explicitly authorized test host, run `node builder-contribution.selftest.js`.
4. Record independent evidence against `review-checklist.json`.
5. If evidence is sufficient, prepare a separate reviewed Capability Fabric source/catalog diff.
6. Mike remains the merge and CANON gate.

The Foundry did not execute the builder or generated code. This packet does not install, register, stage, promote, activate, mutate Foundation, grant permission, or change CANON.
