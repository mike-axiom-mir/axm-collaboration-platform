# Open Gaps

## Mike decisions still required

- Decide whether the Python donor has sufficient direct-reuse rights. Default:
  research-only, direct reuse held.
- Decide whether any repaired Python executor may later run in a disposable
  sandbox. Default: not authorized.
- Decide when the accumulated language donors should be composed into the
  active Code Capability Fabric. This intake does not make that decision.

## Technical gaps before active Python wiring

- Extract a small, provider-neutral, deterministic static-planning contract
  from the donor instead of registering the whole CLI/runtime.
- Separate declared Python capability, observed host availability, planned
  route, authenticated authority, and proven execution with current Fabric v2
  records.
- Replace the archive-only review surface with review-native source files or an
  independently generated, byte-bound source inventory.
- Enforce canonical Windows paths, reserved names, alternate data streams,
  trailing-dot/space aliases, Unicode normalization, case collisions, symlinks,
  junctions, and reparse points for every read/write root.
- Prove source, output, shadow, evidence, and cleanup roots are pairwise
  disjoint before any write or copy.
- Remove host credential/environment inheritance. Bind any executable to an
  exact trusted provider observation and executable digest.
- Enforce bounded attempts, input/output bytes, wall time, CPU, memory, file
  size, process count, open files, and complete descendant termination with
  independent measurements.
- Retain only privacy-safe selected evidence. Raw source, stdout, stderr,
  prompts, private content, executable paths, and machine paths must not enter
  durable receipts by default.
- Add append-only evidence semantics and replay resistance rather than relying
  on replaceable host files.
- Add adversarial tests for stale/forged host observations, provider/version
  ambiguity, rights drift, permission/network intersection, malformed emitted
  records, digest drift, inert providers, Windows aliases, and cleanup failure.
- Reproduce any donor selftests only after source review selects a trusted entry
  point. The supplied `151/151` and `18/18` claims are not yet Workshop proof.

## Evidence not produced in this run

- No donor import, compile, selftest, sandbox probe, analyzer, or runtime test.
- No browser render/click, accessibility, keyboard, visual, or game journey.
- No network-isolation, filesystem-isolation, process-isolation, cleanup,
  restart, performance, or resource-enforcement proof.
- No installation, active builder registration, recipe admission, publication,
  promotion, or CANON evidence.
