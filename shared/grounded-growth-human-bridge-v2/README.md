# Grounded Growth Human Bridge v2

Status: `TEST`

Clone, canonical comparison, and digest preparation use the shared strict
`deterministic-json-core`. Existing JSON-safe ancestry and bridge bytes remain
unchanged; unsupported JSON state is refused before native link composition.

This additive leaf preserves the v1 bridge while closing one exact contract
gap: a verified capability cycle may represent either a new candidate at
`cycle.candidate.artifactRef` or an already-existing capability at
`cycle.gap.existingCapabilityRef` with state `REUSE_EXISTING`.

The bridge derives, rather than accepts, the ancestry mode. Exactly one of the
following is valid:

- `CANDIDATE` — a non-`REUSE_EXISTING` cycle with one candidate artifact and no
  existing-capability reference.
- `REUSE_EXISTING` — a `NO_GAP` / `REUSE_EXISTING` cycle with one existing
  capability reference and no candidate.

A native `axm.capability-intervention-link/v2` receipt binds that exact surface
to the protocol's evaluated Condition B. The link, cycle, protocol, evaluation,
judgment, comparison surfaces, baseline, source-trust reference, and exact
capability surface must all be covered by current evidence closure before a
LIVE human verdict can map into Grounded Growth.

Ambiguous ancestry is refused. A reused capability is never rewritten as a new
candidate. Synthetic fixtures remain contract tests and always map to
`UNKNOWN`; they cannot demonstrate human benefit.

The bridge performs no writes, execution, installation, permission grant,
promotion, CANON decision, Foundation mutation, source authentication, or
model-weight training. The v1 bridge and its schemas are not modified.

Run focused checks with:

```powershell
node shared/grounded-growth-human-bridge-v2/selftest.js
```
