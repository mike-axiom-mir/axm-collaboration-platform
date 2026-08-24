# Capability Lesson Steward v1 (`TEST`)

This bounded Fabric rung turns one reviewed code-specialist observation into a
small, typed **lesson candidate** and, only after fixed regression plus held-out
evidence pass, an inactive rollback-bound **library release candidate**. It is a
pure deterministic data transform. It does not execute a candidate or admit a
lesson into a live library.

The purpose is noise-resistant growth. Useful accepted patterns and compact
failure rules can be preserved without retaining raw source, raw failures,
prompts, stdout, stderr, private content, machine paths, or hidden reasoning.
Every source and evidence claim is represented by an exact SHA-256 and byte
length reference. Contradictions, unknowns, failures, stale evidence, semantic
duplicates, candidate-reference aliases, held-out overlap, and version jumps
remain visible and hold release-candidate formation.

Until Mike supplies a separate rights resolution, generated or uploaded source
must enter with `RESEARCH_ONLY_HOLD` and `directReuseAllowed: false`. The
`DIRECT_REUSE_ALLOWED` form exists for later use only when an exact external
rights-authority record is supplied; this steward still does not authenticate
that issuer.

## Route

```text
explicit detached-candidate direction
  + four ordered root PASS records
  + one specialization knowledge lane
  + byte-bound provenance and evidence
  + declared reuse-rights state
  -> PROPOSED lesson (detached data)
  + immutable current-library snapshot
  + fixed regression observations
  + separately authored held-out observations
  -> technical HOLD
     or inactive next-patch release candidate
  -> rights-authority verification
  -> authenticated Tier-3 human decision
  -> separate trusted host admission (not implemented here)
```

`TECHNICAL_PASS_TIER_3_DECISION_REQUIRED` means the supplied records are
complete and mutually consistent under this contract. It does **not** prove
that the reuse-rights issuer is authentic, that the supplied test observations
are independently trusted, or that a human approved persistent admission.

## Hard boundaries

- No filesystem reads or writes, except loading the module-local specialization
  catalog at module startup.
- No provider, network, process, sandbox, candidate, or test execution.
- No reward, incentive, rank, winner, running-attempt mutation, or hidden model
  update.
- No automatic lesson admission or active-runtime library mutation.
- No install, integration, publish, training, physical actuation, promotion, or
  CANON authority.
- A rights authority reference is byte-bound but explicitly not independently
  verified by this steward.
- Mike remains the final merge gate after every technical gate.

Run:

```powershell
node shared/code-capability-fabric/selftest-capability-lesson-steward-v1.js
```

The next missing hand is a trusted verifier for the rights authority plus the
already-deferred authenticated Tier-3 human decision and separate host-side,
versioned library admission. This module deliberately does not simulate those
capabilities.
