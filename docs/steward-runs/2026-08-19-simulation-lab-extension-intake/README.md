# Simulation-Lab Extension Intake — current readiness

Status: `TEST`

This audit adds a narrow return lane for a future branch-built simulation
adapter or specialist extension. It does not add a second baseline system.

The lane composes the existing `TEST` portable baseline capsule, invariant run
envelope, grounded challenger evaluator, and Branch Module Return Gate. A
candidate must arrive as an inert `EXPERIMENTAL` package, use a distinct module
identity, preserve the host truth rules, map exact subject handoffs, and request
zero permissions. Static intake never executes the candidate.

Current state is deliberately empty: zero candidate packages, zero assessments,
zero evaluation plans, zero evaluations, and zero live human outcomes. The
generated Platform example describes a declaration shape only; it is not a
candidate or endorsement.

Build and verify:

```powershell
node docs/steward-runs/2026-08-19-simulation-lab-extension-intake/build-current-extension-intake-readiness.js
# Run the detect-capability-gaps comparator for BEFORE and AFTER inventories.
node docs/steward-runs/2026-08-19-simulation-lab-extension-intake/selftest.js
```

No registry, launcher, installer, existing root, Foundation file, permission,
candidate code, canonical state, merge state, model weight, or human record is
changed.

## Sealed result

- required capability comparison: `BLOCKED` with ten missing to `READY` with
  none missing;
- exact current state: zero candidates, assessments, plans, evaluations, and
  live human outcomes;
- verification: 70 focused assertions, 143 adjacent assertions plus one
  command-level pass, and all ten required Workshop checks passed;
- broad spine: `VERIFIED_WITH_LIMITS`, zero failures and zero holds;
- evidence segment: 20 valid events, sealed as
  `sha256:3bdffdf044fbb88388237a61dc41b905452c9ae43cf1a52e45feb0d483b7c9e3`.

The capability comparator's create-new refusal is preserved: its existing exact
BEFORE/AFTER outputs were verified and were not silently overwritten.
