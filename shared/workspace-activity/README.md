# Workspace Activity Classifier

Status: `EXPERIMENTAL`

This is a read-only deterministic classifier for repeated
`shared-workspace-snapshot/v1` observations. It exists because imported files
can carry timestamps years in the future and therefore look permanently
"active" to a timestamp-only view.

The classifier keeps those timestamps as visible counterevidence while
excluding them from plausible active/recent counts. It also conservatively
guards the Workshop root `tools-index.json` as a shared seam when an upstream
observer does not. Git porcelain paths are separated into tracked, untracked,
staged, worktree-changed, conflicted, deleted, renamed, and other overlapping
categories without reading those paths. A bounded top-level concentration view
keeps large dirty worktrees inspectable without reproducing every status line.
A normalized source-observation digest, per-set digests, exact totals, and
bounded samples preserve verifiable input identity without emitting unbounded
logs. Full reconstruction still requires retaining the source snapshots.
Comparing two complete
observations can report `MOVING_WORKSPACE`, `UNKNOWN`, or
`STABLE_WITHIN_SNAPSHOT_SCOPE`. The last verdict is deliberately limited to
the files and time windows the source snapshots observed; it is not a claim
that the whole repository is stable.

The leaf also includes a Workshop-owned snapshot producer. It walks file
metadata without reading file content, does not follow symlinks, and invokes
only fixed Git inspection commands. Optional Git locks, fsmonitor behavior,
hooks, terminal prompts, and paging are disabled. Configured Git filter drivers
are enumerated and each clean, smudge, and process command is overridden for
the inspection; an ambiguous filter name fails closed. Git status is captured
with porcelain v1's
NUL-delimited form, so a leading worktree-status space, spaces in paths, and
rename pairs survive transport without repair. The producer skips known
generated, dependency, log, state, and virtual-environment directory names and
makes scan truncation, scan errors, skipped symlinks, and Git completeness
explicit in the snapshot. Its default 200,000-file ceiling completed the
current 58,000-file Workshop scope in under three seconds during development;
`--max-files` can still set a deliberate lower or higher ceiling.

The snapshot declares its normalized exclusion policy and returns bounded,
digest-bound evidence for excluded directory paths, skipped symlinks, and scan
errors. The classifier seals both the policy and observed boundary into its
source digest. A changed policy or excluded/symlink boundary makes a comparison
`UNKNOWN`, as does a contradiction between declared completeness and reported
counts.

A native observation brackets two full deterministic file-metadata passes with
Git status reads and records its real start time, completion time, duration, and
before/after digests. Metadata or Git-status movement inside that interval
makes the observation internally incoherent and prevents a comparison verdict.
Matching brackets prove only coherence of the declared file-metadata and Git-status
scope. File content is not read, so byte-for-byte content stability is always
reported as unproven.

When the two file-metadata passes differ, the snapshot returns at most 20
changed path rows plus the exact total and a full-set digest. This makes a torn
observation useful for coordination without retaining an unbounded metadata
inventory.

## Use

```text
node shared/workspace-activity/workspace-snapshot.js --root . --json
node shared/workspace-activity/workspace-snapshot.js --root . --json | node shared/workspace-activity/workspace-activity-cli.js -
node shared/workspace-activity/workspace-activity-cli.js snapshot.json
node shared/workspace-activity/workspace-activity-cli.js before.json after.json
node shared/workspace-activity/workspace-snapshot-selftest.js
node shared/workspace-activity/selftest.js
```

The producer writes its observation only to standard output. The classifier
CLI reads one or two JSON snapshots and writes the bounded derived result to
standard output. Neither component hashes file content, requests repository
writes, deletes, stages, commits, assigns ownership, repairs, promotes, merges,
or changes CANON. The configured-filter name set and override policy are
digest-bound. These controls do not prove the absence of every possible
host-level side effect, so the producer still distinguishes inspection intent
from fully proven read-only behavior.

## Evidence boundary

- A plausible current timestamp is activity evidence, not ownership evidence.
- A future timestamp is an anomaly, not current activity.
- A changed shared seam is a reason to re-read it before and after editing.
- Git status categories overlap by design; their counts are not a replacement
  for the exact retained status lines.
- Activity and comparison arrays return at most 200 rows by default (never more
  than 1,000 when explicitly configured); exact full-set counts and SHA-256
  digests remain in `sampleEvidence` and `changeEvidence`.
- A digest can verify a retained full input; it cannot reconstruct omitted rows
  from a bounded output.
- If a producer trims the leading index-space from the first porcelain line,
  the one recoverable worktree-status shape is restored and reported as an
  explicit transport recovery; other malformed lines remain invalid.
- A truncated scan, reported scan error, explicitly incomplete Git status,
  invalid timestamp, changed root, or changed branch makes a two-snapshot
  stability judgment `UNKNOWN`.
- A changed scan ceiling, exclusion policy, excluded-directory set, or symlink
  boundary also makes the comparison `UNKNOWN`; differently scoped evidence is
  not silently treated as equivalent.
- "Complete" means complete within the declared scan policy. Excluded
  directories and unfollowed symlinks remain outside the observation.
- "Coherent" means two complete file-metadata passes and the Git-status brackets
  matched during one observation. It is not an atomic filesystem snapshot.
- `STABLE_WITHIN_SNAPSHOT_SCOPE` proves bounded metadata/Git-status stability,
  not byte-for-byte file-content stability.
- Git optional writes, hook/fsmonitor execution, and every discovered
  configured content-filter command are disabled for each status bracket.
- Absence from the second rolling window is surfaced as an observation change;
  it does not prove filesystem deletion.
