# Final Pre-Intake Polish Audit — v0.8.0

## Release question

Could the Atlas survive a long, interrupted, multi-batch ~1,800-capability
intake without silently losing, duplicating, misidentifying, or falsely
completing work?

## Seams found and repaired

### 1. Card-build failure could be undercounted

Source normalization could succeed while a Capability Card build failed. The
failure was logged, but the structural gate did not require one completed card
and one verified receipt per accepted record.

**Repair:** explicit card completion, build-failure, and producer-receipt
coverage checks.

### 2. Stale staging artifacts

Reusing an old staging directory after a source record was removed could leave
old normalized/generated output on disk.

**Repair:** stale artifacts are reported, block review readiness, and batch
planning refuses an untracked normalized inventory.

### 3. Empty production false-success

A zero-record plan could theoretically satisfy vacuous coverage logic.

**Repair:** seals, plans, schemas, manifests, and final verification require a
non-empty production scope.

### 4. Source-boundary ambiguity

Symbolic links could blur whether hashed bytes were really inside the chosen
source boundary.

**Repair:** source roots/files may not be symlinks; seal paths must be safe,
relative, unique, and inside the source root.

### 5. Source pollution

A staging path could be placed inside the source registry.

**Repair:** output-under-source is rejected before writing.

### 6. Absolute-path output identity

Moving an unchanged registry copy to another machine/folder changed generated
record filenames.

**Repair:** filenames use source-root-relative identity. Source hashes and
pointers still preserve provenance.

### 7. Ambiguous internal JSON

Generated or hand-edited control files with duplicate JSON keys could be parsed
with last-key-wins behavior.

**Repair:** internal JSON loading now rejects duplicate object keys.

### 8. Final evidence-chain compression

The final manifest stated which batches verified but did not retain each batch
receipt hash.

**Repair:** final manifest carries batch receipt hash + batch hash for every
verified batch and verifies the chain structure.

### 9. Atomic-write process boundary

`mkstemp` creates temporary files as `0600`. Because atomic replacement keeps
that mode, correct receipts produced by one bounded service account could be
unreadable to another bounded AXM process.

**Repair:** new atomic artifacts derive their file read/write audience from the
parent staging directory. A private `0700` parent still yields `0600`; a shared
`0750` parent yields `0640`; a normal shared/readable staging parent can yield
`0644`/`0664`. Existing file modes are preserved.

## Result

The remaining major uncertainties are external:

- actual local registry formats/content;
- real duplicates and conflicts;
- Module Two implementation compatibility;
- Module Three integration;
- real executor-backed proof-of-use.

Those cannot be honestly solved in this sandbox.
