# Migration — Atlas v0.7.0 to v0.8.0

The shared Capability Record contract remains v0.1.0.

## Important behavior changes

### Portable output identity

Normalized/generated output directory names no longer depend on an absolute
machine source path. They use source-root-relative path identity.

For this reason, do not relabel existing v0.7 generated outputs as v0.8.
Rebuild them when v0.8 producer evidence is required.

### Stale output detection

If a staging directory contains normalized or generated artifacts not belonging
to the current intake, v0.8 reports them and holds the intake.

Recommended action: use a fresh v0.8 staging directory.

### Empty scope

An empty source tree or normalized registry can no longer become a valid
production plan or `COMPLETE_VERIFIED` run.

### Source boundary

Symlinked source roots/files are rejected. Output directories may not live
inside the source tree.

### Final production evidence

The final production manifest now records the verified batch receipt hash and
batch hash for each batch.

## Rollback

Preserve v0.7.0 unchanged. Do not overwrite it in place.

If v0.8 exposes an unexpected real-registry incompatibility, place v0.8 in
TEST-HOLD-REVIEW and compare the source/adapter behavior against v0.7 before any
merge decision.
