# Workspace activity classifier handoff — 2026-08-16

Status: `EXPERIMENTAL`

## Outcome and lane

Keel/Codex added a read-only deterministic classifier for
`shared-workspace-snapshot/v1` observations in the clean isolated worktree on
branch `codex/deterministic-pr-sequencer-v0.1`.

Lane-owned files:

- `shared/workspace-activity/workspace-activity-core.js`
- `shared/workspace-activity/workspace-activity-cli.js`
- `shared/workspace-activity/selftest.js`
- `shared/workspace-activity/workspace-snapshot.js`
- `shared/workspace-activity/workspace-snapshot-selftest.js`
- `shared/workspace-activity/README.md`
- this handoff

No live Workshop source, manifest, contract, registry, generated index,
entrypoint, Foundation file, runtime state, or foreign game lane was edited.

## Why this was selected

The live Workshop remains heavily dirty and concurrently active. The bundled
snapshot observer reports imported Aetherglass files dated 2059 and 2061 as
permanently active. An earlier Workshop stewardship checkpoint already named
this as an unresolved evidence-quality seam. The live probe also showed that
the moving root `tools-index.json` was not classified as a shared seam by the
source observer.

The new classifier:

- preserves future-dated paths as counterevidence;
- excludes implausible future timestamps from current activity counts;
- conservatively guards root `tools-index.json` as a shared seam;
- parses Git porcelain into explicit overlapping tracked, untracked, staged,
  worktree, conflict, operation, and shared-seam counts;
- reports bounded top-level status concentrations instead of requiring a
  steward to load thousands of path lines;
- explicitly records the recoverable first-line leading-space loss caused by
  the current snapshot transport;
- compares two observations without claiming that absence proves deletion;
- returns `UNKNOWN` for truncated scans, invalid timestamps, root drift, or
  branch drift;
- limits a stability result to `STABLE_WITHIN_SNAPSHOT_SCOPE`;
- assigns no ownership and performs no filesystem or Git write.

The Workshop-owned producer added in the continuation:

- walks file metadata without reading file content or following symlinks;
- uses fixed read-only Git commands and NUL-delimited porcelain v1 output;
- preserves leading status spaces, whitespace-bearing paths, and rename pairs
  without lossy text transport;
- reports scan errors, skipped symlinks, truncation, and Git completeness;
- skips named generated, dependency, log, state, and virtual-environment
  directories;
- writes only the JSON observation to standard output.

The classifier now also returns `UNKNOWN` when either observation reports scan
errors or explicitly incomplete Git status. Its source digest seals those
completeness declarations, so degraded evidence cannot share an observation
digest with complete evidence.

## Verification

Focused final-source checks:

```text
node --check shared/workspace-activity/workspace-activity-core.js
node --check shared/workspace-activity/workspace-activity-cli.js
node --check shared/workspace-activity/selftest.js
node --check shared/workspace-activity/workspace-snapshot.js
node --check shared/workspace-activity/workspace-snapshot-selftest.js
node shared/workspace-activity/workspace-snapshot-selftest.js
node shared/workspace-activity/selftest.js
rg -n "[ \\t]+$" shared/workspace-activity docs/steward-runs/2026-08-16-workspace-activity-classifier
```

Verdict: `PASS`; 18 deterministic producer checks and 48 deterministic
classifier checks, zero focused failures, and no trailing-whitespace matches.
(`git diff --check` alone would not inspect
these untracked leaf files, so it is not used as the whitespace evidence.)

All ten required Workshop commands were run in the isolated worktree against
the final classifier source:

```text
node verify.js
node hub/hub-selftest.js
node hub/route-selftest.js
node hub/graft-selftest.js
node hub/skin-selftest.js
node hub/verify-plus.js
node tests/html-script-syntax-test.js
node tests/tool-forge-package-test.js
node tools/agent-tool-forge/selftest.js
node tools/evidence-desk/selftest.js
```

Verdict: all ten exited zero. `verify.js` reported 544 passes, 0 failures, and
43 visible warnings. The warnings were not suppressed; they include the known
stale `tools-index.json` warning. Browser render/click behavior was not tested
because this leaf has no browser surface.

The CLI also consumed a fresh live Workshop observation over standard input.
At `2026-08-16T09:55:38.773387Z`, it separated 96 raw active entries into 95
future-dated anomalies and one plausible active shared seam:
`tools-index.json`. The 50,001-file source scan was truncated, so confidence
remained `QUALIFIED` and no stable-workspace claim was made.

### Continuation checkpoint — Git status triage

At `2026-08-16T10:02:15.36991Z`, the classifier parsed all 12,123 live Git
status paths after one explicit first-line transport recovery:

- 3,603 tracked worktree changes;
- 8,520 untracked paths;
- 3,572 modified paths and 31 deleted paths;
- 0 staged, 0 conflicted, 0 renamed, and 0 copied paths;
- 1,949 conservatively identified shared-seam paths.

The largest top-level concentrations were `tools` (9,828 paths: 2,383 tracked,
7,445 untracked), `shared` (1,497: 857 tracked, 640 untracked), `site` (191),
and `docs` (171). These are coordination-risk counts, not ownership claims or
instructions to clean anything.

## Shared workspace reconciliation

- Shared seams touched: none.
- Shared seams observed moving: live root `tools-index.json`.
- Other concurrent activity observed earlier in the pass: multiple Game Hub
  package lanes and verification exports in the live checkout.
- Existing changes were treated as foreign or unknown and preserved.
- The implementation remains an unregistered leaf in an unpublished local
  stack. It was not committed, pushed, merged, promoted, or made CANON.

## Remaining work

- Human review should decide whether this classifier belongs in the existing
  local unpublished stack or a fresh main-based branch after the queued PRs
  settle.
- Wiring it into a live steward or changing the globally installed snapshot
  skill remains separate work and was not authorized here.
- A future integration should capture two complete observations and retain
  their exact inputs if it wants a durable scoped-stability receipt.

## Continuation final reconciliation

At `2026-08-16T10:03:16.066864Z`, the live checkout remained
`MOVEMENT_OBSERVED / QUALIFIED`: 19 plausible active files, eight active shared
seams, 95 excluded future-dated imports, and a truncated 50,001-file scan.
Active foreign paths included accessibility audit sources, `tools-index.json`,
several Hub entry pages, and manifests for concurrently built tools. None were
edited by this lane.

At `2026-08-16T10:03:18.733707Z`, the isolated worktree scan was complete and
showed only this lane's five untracked files, with zero active shared seams.
Four recently authored lane files remained inside the timestamp activity
window, so the point-in-time classifier correctly said `MOVEMENT_OBSERVED`
rather than claiming global stability. All five lane hashes were unchanged
across the final focused and required test pass; that bounded hash comparison,
not timestamp recency, is the evidence that no overlapping edit occurred
during verification.

## Continuation checkpoint — bounded evidence

The initial classifier still emitted every activity and comparison row. A
12,000-status/5,000-active synthetic observation measured 779,223 analysis
bytes and 4,612,404 comparison bytes, including 24,000 Git-status delta rows.

The classifier now returns at most 200 rows per evidence set by default and
hard-caps an explicit request at 1,000. Exact totals, per-set SHA-256 digests,
normalized source-observation digests, and a comparison digest remain visible.
The same synthetic case now returns all exact totals in 33,439 analysis bytes
and 119,684 comparison bytes. A regression assertion holds the bounded
comparison below 300,000 bytes.

A fresh live observation at `2026-08-16T10:08:20.299222Z` reduced a 1,108,437
byte source snapshot to a 43,069 byte analysis. Its normalized observation
digest was
`1f1101e22d696bcbebcc1b214ff3c8ac54fa2d834e87ec8d966522546da555e6`.
The output retained exact counts for four plausible active files, 18 recent
files, 95 future-dated anomalies, and 12,123 Git status paths.

The bounded output is not a reconstructible archive. Its digests can verify a
retained full snapshot, but omitted rows cannot be recovered from a digest.

## Continuation checkpoint — NUL-safe snapshot production

A side-by-side live observation demonstrated the transport boundary. At
`2026-08-16T10:13:21.470Z`, the Workshop-owned producer returned 12,124 valid
Git status paths with zero transport recoveries: 3,603 tracked worktree
changes, 8,521 untracked paths, 3,572 modified paths, 31 deleted paths, and
1,949 shared seams. A bundled external observation six seconds later reported
the same Git facts but required one explicit first-line leading-space recovery.
The native producer scanned exactly its configured 50,000-file limit; the
external producer reported 50,001 because its limit accounting includes the
first file beyond the ceiling. Both observations were explicitly truncated.

A later native observation at `2026-08-16T10:16:04.237Z` remained read-only and
reported zero scan errors, complete Git evidence, 12,125 valid status paths,
zero transport recoveries, four plausible active files, one active shared
seam, and 95 excluded future-dated imports. The four active paths were the
foreign `tools/game-hub/game-library/002-robo-pong` manifest, self-test, and two
runtime files. This lane did not edit them. The result remained
`MOVEMENT_OBSERVED / QUALIFIED`; scan truncation prevents any whole-workspace
stability claim. Its normalized observation digest was
`5d810f66aa7f1f4088749394db521b3c1083ed4dcd3a0e6566fb27416db267e0`.

## Final reconciliation

The final focused pass completed 18 producer checks and 48 classifier checks;
all five JavaScript files passed `node --check`, and the lane had no trailing
whitespace matches. The ten required Workshop commands then all exited zero.
`verify.js` contained 544 `PASS`, 0 `FAIL`, and 43 visible `warn` lines. No
browser render/click claim is made because this leaf has no browser surface.

All seven lane-file SHA-256 hashes were unchanged across the required test
pass. The README and this handoff were then updated only to record the final
evidence; no implementation file changed after the required pass.

At `2026-08-16T10:18:17.689Z`, the isolated worktree scan was complete: 13,371
files inspected, zero scan errors, complete Git evidence, and seven untracked
lane files. Six recently authored lane files remained inside the active time
window, with zero active shared seams. `MOVEMENT_OBSERVED / SCOPED` is therefore
the honest timestamp verdict; unchanged hashes across testing provide the
narrower non-overlap evidence.

At `2026-08-16T10:18:18.470Z`, the live checkout remained
`MOVEMENT_OBSERVED / QUALIFIED`: a truncated 50,000-file scan, zero scan errors,
complete Git evidence, 12,125 valid status paths (3,603 tracked and 8,522
untracked), zero transport recoveries, and 95 excluded future-dated imports.
The two active paths were foreign `tmp/keel-010-adapter-capabilities.json` and
`tmp/keel-010-adapter-requirements.json`; neither was edited. No active shared
seam was observed in that final point-in-time window.

Nothing in this lane was committed, pushed, merged, registered, promoted, or
made CANON.

## Continuation checkpoint — complete declared scan scope

The original 50,000-file default left the live Workshop permanently truncated
even though a complete metadata walk was practical. A read-only measurement at
`2026-08-16T10:20:36.085Z` completed 58,621 files in 2.833 seconds with a
200,000-file ceiling. The Workshop-owned producer now uses that ceiling by
default while preserving `--max-files` as an explicit override.

"Complete" now means complete only inside a declared policy. Each native
snapshot carries:

- the ceiling and normalized excluded-directory names;
- explicit no-file-content and no-symlink-following policy;
- bounded samples, exact totals, and full-set SHA-256 declarations for scan
  errors, excluded directory paths, and skipped symlinks;
- an internally checked completeness declaration.

The classifier seals the policy, observed exclusion/symlink boundary, scan
error declaration, counts, and Git completeness into the source-observation
digest. Policy drift returns `SCAN_SCOPE_CHANGED`; observed boundary drift
returns `SCAN_BOUNDARY_CHANGED`; missing or contradictory declared evidence
returns `SCAN_EVIDENCE_INCONSISTENT`. Each condition forces `UNKNOWN` rather
than allowing a scoped stability verdict.

A final implementation-focused pass completed 26 producer checks and 55
classifier checks. All five JavaScript files passed `node --check`, and there
were no trailing-whitespace matches. The ten required Workshop commands all
exited zero against those exact implementation hashes. `verify.js` contained
544 `PASS`, 0 `FAIL`, and 43 visible `warn` lines. The warnings remain known
Workshop evidence, not failures hidden or rewritten by this lane.

At `2026-08-16T10:24:57.358Z`, the new default completed the live declared
scope: 58,627 files in 2.668 seconds, zero scan errors, complete Git evidence,
247 excluded directory paths with a full-set digest, 12,130 valid status paths,
and zero Git transport recoveries. Six plausible active files remained foreign
or unknown, including temporary Keel adapter inputs and active Game Hub 005/009
work. This lane did not edit them.

A real before/after observation from `2026-08-16T10:27:34.482Z` to
`2026-08-16T10:27:38.805Z` completed 58,626 files in each scan. The policy and
observed boundary digests matched; no file, Git-status, or shared-seam delta was
observed. The result was `STABLE_WITHIN_SNAPSHOT_SCOPE`, qualified by 95
excluded future-dated imports and explicitly limited to the declared policy,
observed files, and time windows. It is not a claim of long-term or
whole-filesystem stability.

No browser render/click test was run because this leaf has no browser surface.
The lane remains seven untracked review files on the isolated branch; it was
not committed, pushed, merged, registered, promoted, installed, or made CANON.

### Post-checkpoint movement boundary

At `2026-08-16T10:31:14.476Z`, the isolated lane again completed its declared
scope: 13,371 files, zero scan errors, complete Git evidence, seven untracked
lane files, and no active shared seam. Five lane files were still inside the
five-minute activity window, so the point observation remained
`MOVEMENT_OBSERVED / SCOPED` rather than inventing a stable-worktree claim.

At `2026-08-16T10:31:15.263Z`, the live checkout completed 58,626 files with
zero scan or integrity errors and complete Git evidence. It contained 12,131
valid status paths (3,603 tracked and 8,528 untracked), three active foreign
Game Hub 005 files, and one active manifest seam. The live result was
`MOVEMENT_OBSERVED / QUALIFIED`; this lane preserved all three paths. After
these observations, only this handoff was updated to record the evidence. No
implementation or live Workshop file changed.

## Continuation checkpoint — intra-observation coherence

The complete scanner still represented a multi-second walk as one timestamp.
A live audit starting at `2026-08-16T10:33:19.788Z` showed that the emitted
`generatedAt` preceded actual completion by 2.884 seconds. Git status was read
only after the walk, so the source could not distinguish a coherent observation
from movement while the observation itself was being assembled.

The producer now:

- records real observation start, completion, and duration;
- brackets two deterministic full file-metadata passes with Git status reads;
- digests every observed file path, size, modification time, and mode without
  reading file content;
- seals both metadata-pass digests and both Git-state digests;
- marks metadata or Git-status movement between brackets as internally
  incoherent;
- uses the completion time as `generatedAt`.

The classifier validates timestamps, duration, pass count, digest shape,
stable flags, and their agreement with the bracket digests. A torn,
contradictory, or incomplete observation is `QUALIFIED`, and a two-snapshot
comparison containing one returns `UNKNOWN` with
`OBSERVATION_INTERNALLY_MOVING_OR_INCOHERENT`. Matching brackets prove only
file-metadata and Git-status coherence in the declared policy. They do not
prove byte-for-byte file-content stability or atomic filesystem state.

Focused final-source evidence is 29 producer checks, 59 classifier checks, all
five JavaScript files passing `node --check`, and zero trailing-whitespace
matches. All ten required Workshop commands then exited zero against unchanged
implementation hashes. `verify.js` contained 544 `PASS`, 0 `FAIL`, and 43
visible `warn` lines.

A live observation from `2026-08-16T10:38:42.029Z` through
`2026-08-16T10:38:47.637Z` completed two 58,630-file passes with zero scan or
integrity errors. Both file-metadata and Git brackets matched. Eight active
foreign Game Hub 004/006 paths and two manifest seams remained visible; this
lane did not edit them.

Two consecutive coherent live observations completed at
`2026-08-16T10:39:39.542Z` and `2026-08-16T10:39:45.098Z`, each with 58,631
files per metadata pass and the same scan-boundary digest. No file-metadata,
Git-status, or shared-seam delta was observed between them. The result was
`STABLE_WITHIN_SNAPSHOT_SCOPE`, explicitly qualified by future-dated imports,
`FILE_CONTENT_STABILITY_NOT_PROVEN`, and the declared file-metadata/file-window
scope. This does not supersede later movement evidence.

No browser render/click test was run because this leaf has no browser surface.
No live source, shared registry, manifest, contract, Foundation file, or
foreign lane was edited. The leaf remains `EXPERIMENTAL`, untracked in its
isolated branch, and uncommitted, unregistered, uninstalled, unpromoted,
unpushed, unmerged, and non-CANON.

## Continuation checkpoint — Git side-effect boundary

The producer still described its Git commands as simply read-only. A current
configuration audit found system-level Git LFS clean/smudge/process commands,
although no Workshop `.gitattributes` entry selected a filter. A direct
isolated-worktree observation left the Git index SHA-256 and modification time
unchanged, but contingent non-movement was not enough to justify the broad
claim.

Git inspection now applies both `--no-optional-locks` and
`GIT_OPTIONAL_LOCKS=0`, disables fsmonitor behavior and the hooks path, refuses
terminal prompts, and disables paging. The normalized policy is included in
the source-observation digest. Missing safeguards or policy drift make a
comparison `UNKNOWN` through `GIT_OBSERVATION_POLICY_UNSAFE_OR_INCOMPLETE` or
`GIT_OBSERVATION_POLICY_CHANGED`.

Repository-selected content filters are not globally disabled. They can be
external programs, so the producer is restricted to an authorized repository
and does not claim that all possible external side effects are excluded. Its
truth block now distinguishes read-only inspection intent and no requested
repository writes from fully proven read-only side effects.

The double metadata pass now also retains an in-memory normalized metadata map.
If its two pass digests differ, the snapshot returns at most 20 exact changed
path rows, the full change count, and a full-set digest. No unbounded metadata
inventory is emitted.

Focused final-source evidence is 35 producer checks and 62 classifier checks;
all five JavaScript files pass `node --check`, and there are no trailing-space
matches. All ten required Workshop commands exited zero against unchanged
implementation hashes. `verify.js` contained 544 `PASS`, 0 `FAIL`, and 43
visible `warn` lines.

At `2026-08-16T10:48:08.868Z`, the isolated worktree completed a coherent
13,371-file observation. Its Git index hash and timestamp were unchanged. A
live observation from `2026-08-16T10:48:10.239Z` through
`2026-08-16T10:48:16.488Z` was internally incoherent, correctly exposing
concurrent movement during the six-second interval; the live Git index still
remained byte- and timestamp-identical. This was a moving-workspace condition,
not a lane regression.

A follow-up live observation from `2026-08-16T10:48:34.259Z` through
`2026-08-16T10:48:39.893Z` completed two matching 58,635-file passes and
matching Git brackets. It remained `MOVEMENT_OBSERVED / QUALIFIED` because of
recent foreign temporary adapter files and Game Hub 004 activity, not movement
inside that second observation. All foreign paths were preserved.

No browser render/click test was run because this leaf has no browser surface.
Nothing was committed, registered, installed, promoted, pushed, merged, or made
CANON.

### Configured-filter boundary closure

The preceding configured-filter limitation is preserved as the history of the
first safeguard pass, but it is no longer the final implementation state. The
producer now enumerates every configured Git filter driver before each status
bracket and overrides its `clean`, `smudge`, and long-running `process`
commands, while forcing `required=false`. A filter name that cannot be safely
represented in an override is refused rather than executed. The normalized
filter-name count and digest are sealed into the Git observation policy and the
source-observation digest; filter configuration drift also changes the Git
bracket digest.

The fixture includes a tracked `*.probe` path and a configured clean filter
whose command writes a marker if invoked. Both Git brackets detect the modified
path without creating the marker. The fixture Git index content and timestamp
remain unchanged. This proves the selected configured filter command was not
executed in the fixture; it does not prove the absence of every possible
host-level side effect, so `readOnlySideEffectsFullyProven` remains false.

Final focused evidence is 37 producer checks and 62 classifier checks. All five
JavaScript files pass `node --check`, and the lane has no trailing-whitespace
matches. The full ten-command Workshop checkpoint was rerun after filter
suppression; all ten commands exited zero against unchanged implementation
hashes. `verify.js` contained 544 `PASS`, 0 `FAIL`, and 43 visible `warn` lines.

At `2026-08-16T10:58:22.979Z`, the isolated worktree completed a coherent
13,371-file observation. At `2026-08-16T10:58:24.445Z`, the live checkout began
a coherent 58,637-file observation that completed at
`2026-08-16T10:58:30.088Z`. Both observed one configured filter name with the
same digest, applied all configured-filter overrides, and produced zero Git
policy issues. The live result remained `MOVEMENT_OBSERVED / QUALIFIED` because
of active foreign Game Hub 004/007 files, including one manifest seam. None was
edited by this lane.

No browser render/click test was run because this leaf has no browser surface.
Nothing was committed, registered, installed, promoted, pushed, merged, or made
CANON.

## Reviewable branch checkpoint

The mature seven-file leaf was copied byte-for-byte from the isolated
development worktree into a dedicated clean worktree and committed on
`codex/workspace-activity-observer-v0.1`. The branch is based directly on
`origin/main` at `a4f99fbfc05268173458bf3fb8f3fe616919e376`; it does not carry
the unpublished deterministic sequencer stack. The initial local review commit
is `bdb4df77` (`feat: add experimental workspace activity observer`) and contains
exactly these seven additions: this handoff, the leaf README, two runtime files,
the CLI, and the two focused selftests.

Focused verification on that base passed 62 classifier checks and 37 producer
checks. The full ten-command Workshop suite also exited zero: `verify.js`
reported 0 failures and 43 existing warnings; the HTML script syntax test
reported 55 passes and 0 failures; Agent Tool Forge reported 17 passes and 0
failures; and Evidence Desk reported 36 passes and 0 failures. No tracked test
residue remained. The staged diff passed `git diff --cached --check`, and a
bounded audit of the seven files found no machine-specific path or
credential-shaped match.

This checkpoint changes the latest process state, not the historical statements
above: the leaf is now locally committed and reviewable. It remains
`EXPERIMENTAL`, unregistered, uninstalled, unpromoted, unpushed, unmerged, and
non-CANON. No browser render/click test was run because the leaf has no browser
surface. Mike Tobi remains the review and merge gate.

### Final branch and live reconciliation

After the local commits, the dedicated review worktree completed a coherent
observation at `2026-08-16T11:12:28.017Z`: both metadata and Git brackets
matched across two 13,274-file passes, Git status contained zero paths, the
configured-filter policy had zero issues, and the worktree remained clean. Its
`MOVEMENT_OBSERVED / SCOPED` result reflects the timestamps of a freshly
created checkout and does not contradict the clean Git state.

The live checkout then completed a coherent observation from
`2026-08-16T11:12:46.251Z` through `2026-08-16T11:12:52.041Z`. Both 58,641-file
metadata passes and both Git brackets matched, with zero scan, integrity, or Git
policy issues. Git status contained 12,146 paths: 3,603 tracked and 8,543
untracked. One active foreign shared seam remained at
`tools/game-hub/game-library/005-briarfront/game.manifest.json`, and 95
future-dated imports were excluded from activity counts. The result remained
`MOVEMENT_OBSERVED / QUALIFIED`. This lane did not edit or assign ownership to
that foreign path, and neither observation proves file-content stability.
