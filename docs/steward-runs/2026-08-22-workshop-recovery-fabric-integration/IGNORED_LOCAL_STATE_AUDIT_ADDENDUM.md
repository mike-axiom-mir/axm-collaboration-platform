# Ignored local-state and source-package audit addendum

Status: **TEST**

This addendum corrects an ambiguity in the phrase “clean Workshop.” Git had zero
unstaged, staged or non-ignored untracked paths, but the canonical checkout still
contained 89,898 intentionally ignored local files. “Clean” therefore means a
stable reviewable Git checkout; it does not mean the disk contains no local data.

## Ignored-file census

The largest ignored roots at audit time were:

- `intakes/` — 40,180 files
- `state/` — 17,528 files
- `projects/` — 16,481 files
- `exports/` — 5,310 files
- `node_modules/` — 4,958 files
- `runtime/` — 2,077 files
- `tmp/` — 1,550 files
- ignored files beneath `tools/` — 844, principally Python caches and local
  generated output
- `logs/` — 183 files

The intake census is dominated by generated or quarantined run packages:
30,647 files under `sim-living-run102`, 4,425 under `cartoon-3d-run100`, 1,387
under `audio-music-live-run106`, and smaller held intake cohorts. These remain
data by default. They were not executed, installed, promoted, treated as active
Workshop source or silently deleted. Private project state also remains local in
accordance with `AGENTS.md`.

## Ignored source-package audit

Content-address comparison against the tracked Workshop found:

- `AXM_STYLE_FABRIC_v0_6_WORKING/`: all 152 files already tracked elsewhere.
- `AXM_CSS_SKIN_FABRIC_ORGAN_PACK_v0_2_0_2026-07-28/`: all 99 files already
  tracked elsewhere.
- `_archive_review_6713283d/`: 30 of 32 files already tracked; the remaining two
  are local runtime event/state files.
- `AXM_STYLE_FABRIC_v0_5_WORKING/`: an older superseded release; v0.6 is the
  tracked current release.
- `distributions/` and `backups/`: derived distribution and rollback copies, not
  source-of-truth replacements.

Two real source-admission gaps were found and repaired:

1. Aetherglass v7.1 had only five release files admitted even though the tracked
   manifest declared 48 entrypoints. Commit
   `0bb637513f0ffcd8341e0adbf3090608c0588612` imports 79 missing source, docs,
   demo, test and workflow files into `shared/aetherglass`. All 48 declared
   entrypoints now exist. The six remaining local-only release files are five
   generated report/index/checksum artifacts and the 142 MB rollback archive.
2. Visual Handshake v0.3 existed only as an ignored release package. Commit
   `90c35d7c454ca4743d8ab307b508f8788f9412df` admits 62 useful package files plus
   a Workshop intake boundary under `shared/visual-handshake`. Fifty-five remain
   byte-identical to the package; seven differ only through Git line-ending or
   EOF normalization. The three deliberately local-only package files are its
   generated action, checksum and validation reports.

The original ignored packages remain in place for recovery. No copy was deleted.

## Verification

- Aetherglass: 28 JavaScript files passed syntax checks, four Python files passed
  AST parsing, two JSON files parsed, the skin-bridge selftest passed, and all 48
  manifest entrypoints were present.
- Visual Handshake: one JavaScript file passed syntax checking, eleven Python
  files passed AST parsing, seven JSON files parsed, five PowerShell scripts
  parsed, and five SVG files parsed. Supplied installers, runtime, capture flow,
  browser flow and package selftests were not executed.
- All ten `AGENTS.md` required checks passed after both source admissions.
- Browser render/click verification: **N/A — not run and not claimed**.

## Boundary

Source admission does not activate Visual Handshake, grant screen access, start a
loopback service, install desktop shortcuts or install nested skills. It remains
TEST source with runtime effects held. Generated telemetry, private projects,
runtime state, exports, dependencies and quarantined intake packages are local
data, not hidden uncommitted Workshop source.
