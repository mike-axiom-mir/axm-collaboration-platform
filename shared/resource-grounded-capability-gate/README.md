# AXM Resource-Grounded Capability Gate

Status: `TEST`

This permissionless companion sits between functional verification and the
human improvement decision:

```text
verified candidate awaiting steward
  + exact workload and environment
  + sealed resource policy
  + comparable baseline and candidate observations
  -> deterministic resource evidence comparison
  -> HOLD or READY_FOR_HUMAN_REVIEW
```

The gate exists because a capability that works can still be a bad inheritance
when it consumes excessive compute, memory, storage, network, time, energy, or
carbon. It evaluates exact integer measurements against absolute ceilings and
allowed regression. Missing, stale, manually declared, differently defined, or
otherwise incomparable required evidence produces a hold. `UNKNOWN` is never
treated as unlimited.

`evidenceAuthority` is a provenance claim supplied by an authorized host, not
an identity proof performed by this module. The gate preserves and binds that
claim, but does not authenticate the observer or referenced evidence bytes.

The gate does not run a candidate, meter hardware, fetch evidence, verify the
referenced telemetry bytes, repeat functional tests, grant permission, install,
promote, mutate a root, or decide `CANON`. `READY_FOR_HUMAN_REVIEW` means only
that the supplied digest-bound resource evidence aligns with the supplied
policy. It does not establish broad improvement, hardware safety, long-term
safety, sustainability, or desirability.

Existing owners remain intact:

- Verified Capability Loop owns need-to-candidate functional evidence state.
- Cognitive Resource owns AI-work observation vocabulary and economics drafts.
- Resource Pressure Sentinel owns live pressure classification.
- Module Footprint Observatory owns storage footprint observation.
- Sustainability Metrology Lab owns energy/carbon evidence capture.
- Mike remains the human improvement and merge gate.

The three strict schemas are:

- `resource-grounded-capability-policy.schema.json`
- `resource-observation.schema.json`
- `resource-grounded-capability-gate-receipt.schema.json`

Run:

```powershell
node shared/resource-grounded-capability-gate/selftest.js
```
