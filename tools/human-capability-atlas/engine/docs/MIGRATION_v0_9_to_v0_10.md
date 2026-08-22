# Migration — v0.9.0 to v0.10.0

Shared contract remains `axm.capability-interface-contract` v0.1.0.

## Why v0.9 public-registry outputs should be rebuilt

v0.9 correctly joined provider/module evidence, but treated the complete
generated public row count as one capability surface.

v0.10 adds source-derived registry roles and proof ceilings. Therefore a v0.9
public-registry record may change human presentation even when its technical ID
did not change.

Do not relabel v0.9 cards as v0.10 RUN outputs.

## New source-bound sidecars

- registry role;
- human surface;
- discovery bundle hash;
- proof ceiling;
- deterministic humanization seed;
- registry-role fingerprint.

## Learning migration

Consumer-only rows move from generic capability courses to
`dependency_reference_orientation`.

## Coverage migration

Public coverage denominator changes from all public registry rows to
provider-backed rows.

Ordinary/non-public capability coverage does not change.

## Rollback

Preserve v0.9 unchanged.

If the real repository exposes an unsupported discovery/generator revision,
hold v0.10 and compare rather than weakening the gate.
