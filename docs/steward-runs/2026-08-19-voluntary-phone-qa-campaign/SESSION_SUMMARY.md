# Session summary — voluntary physical-phone QA campaign

Status: `TEST`

## Outcome

Added a read-only campaign adapter that turns the exact current Game Hub warning
report into a privacy-sanitized, bounded, resumable path for future voluntary
physical-phone QA. It reuses the existing Browser, LAN & Hardware QA Lab as the
capture hand without editing that Lab, any game, any manifest, the verifier, or
the generated warning report.

Current exact state:

- 19 verifier-listed games;
- 17 physical-phone QA warnings;
- six optional sessions, with at most three games per session;
- six human-observed checklist items per game;
- zero candidate review records;
- zero accepted reviews;
- zero verified physical-phone journeys;
- all 17 warnings still open;
- deterministic next optional item: `002-robo-pong`.

The recent ChatGPT mobile remote-control connection may help operate the PC, but
it does not itself prove a game controller join, shared-screen action, physical
touch behavior, disconnect recovery, human usefulness, or physical-phone QA.

## Added

- `shared/voluntary-phone-qa-campaign/`
  - deterministic campaign builder and exact verifier;
  - campaign schema;
  - zero-permission `TEST` contract;
  - adversarial self-test;
  - human-readable boundary note.
- `docs/steward-runs/2026-08-19-voluntary-phone-qa-campaign/`
  - deterministic current campaign builder;
  - current campaign receipt;
  - optional six-session human handoff;
  - capability requirements, inventories, and comparisons;
  - evidence routes, verification receipt, summary, and sealed session.

## Capability result

The independent comparator changed eight required orchestration capabilities
from `BLOCKED` to `READY`. Four external evidence capabilities correctly remain
`DEGRADED`:

- candidate observation: not received;
- candidate review: not received;
- physical-phone journey: not run;
- per-game warning closure: not run.

Campaign progress never closes a warning. Even an accepted review remains
`REVIEW_ACCEPTED_WARNING_STILL_OPEN` until the existing separate per-game
manifest evidence gate is explicitly reviewed.

## Verification

- Focused: `PASS`, 90 assertions.
- Adjacent: `PASS_WITH_DECLARED_LIMITS`, 146 explicit assertions plus one
  command-level Game Night pass.
- Required Workshop checks: 10 passed, 0 failed.
- Broad spine: `VERIFIED_WITH_LIMITS`, 0 failures, 0 holds, 0 invalid receipts,
  0 conflicts, and 2 warning groups.
- The warning groups preserve 17 visible core warnings and 17 pending real-world
  evidence items.
- Browser render/click: `NOT_RUN_EXISTING_LAB_UI_UNCHANGED`.

The exact commands, counts, source digests, and limitations are preserved in
`VERIFICATION_RECEIPT.json`.

## Human handoff

`PHYSICAL_PHONE_QA_HANDOFF.md` lists the six optional batches and points to the
existing trusted relative QA Lab route. Stopping, skipping, leaving a checklist
item unchecked, or never starting the campaign are all valid outcomes.

## Shared workspace boundary

The verification-time snapshot observed branch
`local-visual-fabric-20260728`, 12,593 changed paths (3,603 tracked and 8,990
untracked), zero conflicts, 177 recent files, 101 active files, and four active
shared seams. The scan stopped at 20,001 files and is incomplete. Three active
seams were clock-skewed Aetherglass files; the fourth was this audit lane's
evidence-routing note.

After curation, a final compact snapshot reported 12,599 changed paths, zero
conflicts, 178 recent files, 107 active files, and four active shared seams. The
scan again stopped at 20,001 files; the only non-Aetherglass active shared seam
was this lane's evidence-routing note.

No commit, push, install, permission grant, merge, promotion, CANON decision,
model training, or Foundation mutation was performed.
