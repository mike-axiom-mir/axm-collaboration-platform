# Scoped tool-readiness refresh handoff

Status: `TEST` — local review candidate, not accepted or CANON

Branch: `codex/scoped-tool-readiness-refresh-v0.1`

Base: `origin/main` at `a4f99fbfc05268173458bf3fb8f3fe616919e376`

## Outcome

The tool-readiness generator can now verify an exact named subset through
`--tool=id` or a comma-separated list. Selected mode refuses unknown or
ineligible IDs before writing, runs only the named targets within the existing
worker and timeout bounds, replaces their results, and retains unrelated
results only while their selftest digests remain current.

When local readiness state is absent, selected generation and `verify.js` use
only validated, digest-bound results already embedded in `tools-index.json`.
This keeps fresh checkouts truthful without committing the raw generated
receipt under `state/`. The fallback grants no approval, promotion, execution,
installation, or CANON authority.

The readiness fingerprint inputs and three checksum-bound source trees are now
LF-stable across Windows and POSIX checkouts. One pre-existing CRLF contract,
`tools/geographic-market-map/module.contract.json`, was mechanically
renormalized; parsed JSON before and after was identical.

## Review scope

- `.gitattributes`
- `docs/STATUS_LADDER.md`
- `package.json`
- `scripts/generate-tools-index.js`
- `scripts/generate-tools-index-selftest.js`
- `shared/readiness/tool-readiness.js`
- `tools/geographic-market-map/module.contract.json`
- `tools-index.json`
- `verify.js`
- this handoff

No live Workshop file, registry, Foundation source, Game Hub package, or
foreign worktree was edited.

## Failure evidence preserved

The first scoped run in the original Windows worktree did not pass: Prehub
passed, while Adapter Translation Garden and Memory Continuity Garden reported
checksum drift and Repair & Resilience reported catalog digest drift. Git blob
comparison showed LF canonical bytes had been materialized as CRLF under the
system `core.autocrlf=true` policy. The assertions were not weakened and no
PASS receipt was fabricated.

A later preservation trial retained zero older results. Investigation showed
all 122 stored promotion-result digests disagreed with CRLF-smudged top-level
selftests. The final rules cover the generator's complete structural hash
surface: top-level tool manifests, module contracts, promotion selftests, and
the three checksum-bound trees. A final fresh checkout then matched 210 of 210
stored manifest digests and 210 of 210 stored selftest digests; all 211 contract
paths contained zero CRLF sequences.

## Verification

The expected-refusal test passed: an unknown selected tool exited nonzero while
both the index and local receipt hashes remained unchanged.

The deterministic capability comparison moved from `BLOCKED` with
`tool.selftest.select.exact` and `receipt.digest.merge.current` missing to
`READY` with no missing capabilities. Temporary comparator inputs were deleted
and are not part of the branch.

In the final clean detached checkout:

- scoped refresh: 4 PASS, 0 non-PASS;
- current receipt results: 122;
- selected results replaced: 4;
- unrelated current results retained: 118;
- ready-for-human-review candidates preserved: 106;
- focused generator selftest: 16 PASS;
- readiness inventory: 211 tools and 1,781 capabilities;
- package script path check: 251 references;
- world registry: 2 worlds;
- fresh checkout with no local receipt: `verify.js` had 537 PASS lines, 0
  FAIL lines, and 38 warnings;
- promotion-claim warnings: 0;
- stale-index warnings: 0.

The required Workshop commands all exited zero against content equivalent to
the local branch head:

- `node verify.js` — 537 PASS lines, 0 FAIL, 38 warnings;
- `node hub/hub-selftest.js` — 144 PASS, 0 FAIL;
- `node hub/route-selftest.js` — 40 PASS, 0 FAIL;
- `node hub/graft-selftest.js` — 24 PASS, 0 FAIL;
- `node hub/skin-selftest.js` — 85 PASS, 0 FAIL;
- `node hub/verify-plus.js` — 539 PASS lines, 0 FAIL, 38 warnings;
- `node tests/html-script-syntax-test.js` — 55 PASS, 0 FAIL;
- `node tests/tool-forge-package-test.js` — exit 0;
- `node tools/agent-tool-forge/selftest.js` — 17 PASS, 0 FAIL;
- `node tools/evidence-desk/selftest.js` — 36 PASS, 0 FAIL.

No browser render/click test was run because this lane has no browser surface.
The remaining 38 verifier warnings are visible backlog, primarily device or
Game Hub evidence gates plus the legacy manifest-kind migration count.

## Shared-workspace receipt

A final live observation from `2026-08-16T12:08:00.963Z` through
`2026-08-16T12:08:07.363Z` was coherent across two 58,662-file metadata passes,
with zero scan errors, zero metadata changes, and zero Git-policy issues. The
live checkout contained 12,167 Git-status paths: 3,603 tracked and 8,564
untracked. One active foreign shared seam remained at
`tools/game-hub/game-library/010-living-globe-tycoon/game.manifest.json`; it was
preserved untouched. The live result remained
`MOVEMENT_OBSERVED / QUALIFIED`, with 95 future-dated imports excluded from
activity counts.

Nothing was pushed, merged, installed, promoted, or made CANON. Mike Tobi
remains the review and merge gate.
