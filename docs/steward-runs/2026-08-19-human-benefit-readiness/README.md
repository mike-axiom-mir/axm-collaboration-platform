# Human-benefit readiness — grounded growth increment 2

Date: 2026-08-19

Working identity: Keel (Codex substrate)

Status: `TEST`

Persistent stewardship goal: active

## Outcome first

AXM can now prepare and reconstruct consent-bound human-benefit evidence. The
normalized capability route moved from `BLOCKED` to `READY` with no missing
identifiers.

That is evidence readiness, not evidence of benefit. No real human session or
human judgment occurred. The existing Grounded Growth outcome therefore stays:

- outcome state: `CANDIDATE_ONLY`;
- human claim: `NOT_RUN` / `NOT_PROVEN`;
- AI-workflow claim: bounded `PASS` from the prior deterministic evaluation;
- capability cycle: `AWAITING_STEWARD`.

## What was added

`shared/human-benefit-evidence` provides four digest-bound contracts:

```text
predeclared human-benefit protocol
  -> voluntary structured session
  -> deterministic aggregate signal
  -> explicit claim-scoped human judgment
```

The aggregate signal cannot become the judgment. A positive combination of
accuracy, unsupported decisions, time, burden and participant effect only
becomes `READY_FOR_HUMAN_JUDGMENT`; the human-benefit verdict remains `NOT_RUN`.

The module also enforces:

- voluntary opt-in plus completion confirmation;
- withdrawal at any point, retaining no participant reference or observations;
- no raw identity, free text, audio, video, screen recording or network use;
- exact protocol/session/evaluation/judgment ancestry;
- strict `LIVE` versus `SYNTHETIC` separation;
- one-person scope that cannot silently generalize to other humans;
- zero execution, install, permission, promotion, CANON or Foundation authority.

## Current optional human route

The current six-trial protocol asks whether exact source-closure information
helps the participating local AXM steward decide more accurately and quickly
without high burden. Its success thresholds were fixed before any response.

The participant-facing packet omits the baseline/candidate roles and expected
decisions. The optional terminal presenter requires a local interactive TTY and
refuses piped or automated input:

```powershell
node docs/steward-runs/2026-08-19-human-benefit-readiness/run-current-human-session-interactive.js
```

It never runs automatically and writes nothing. If a person opts in, the
receipt is emitted only to standard output. The JSON-input runner additionally
refuses live response files stored anywhere inside the Workshop repository.

## Limits that remain visible

- One participating local steward can establish only that person's experience.
- Condition content may make the closure-enabled surface recognizable even
  though condition roles are not disclosed.
- Within-session learning and terminal familiarity can affect time.
- Pseudonymous SHA-256 participant and judge references are not authenticated
  identities; declared human source trust remains external.
- No cohort, accessibility, demographic, cultural, device, long-session or
  general-human claim can be derived from this protocol.
- A real response, if ever created, is private local state and must not be
  committed.

## Verification

- Human Benefit Evidence: 46 focused checks pass.
- Current runner boundary: 5 checks pass.
- Exact protocol and answer-free participant packet: pass.
- Exact readiness receipt: pass with human session `NOT_RUN`.
- Evidence Retention: 27 checks pass.
- Verified Capability Loop: 21 checks pass.
- Grounded Growth Outcomes: 31 checks pass.
- All ten required Workshop checks pass.
- Broad result: `VERIFIED_WITH_LIMITS`, 0 failures, 17 warnings, 6 receipts and
  9 atomic claims.
- Browser render/click: `NOT_RUN`; no browser-facing UI changed.
- Live interactive completion: `NOT_RUN`; automation is deliberately refused.

## File map

- Shared implementation: `shared/human-benefit-evidence/`
- Before/after capability comparison: `requirements.json`,
  `capabilities.before.json`, `capability-gap.before.json`,
  `capabilities.after.json`, `capability-gap.after.json`
- Current protocol: `baseline-surface.json`, `candidate-surface.json`,
  `current-protocol.js`, `current-protocol.json`
- Human-facing route: `current-participant-packet.json`,
  `run-current-human-session-interactive.js`
- External JSON route: `participant-response.example.json`,
  `run-current-human-session.js`, `runner-selftest.js`
- Readiness truth: `current-readiness.js`,
  `current-readiness-receipt.json`, `EVIDENCE_ROUTES.md`

No module was registered, installed, promoted, published, pushed, committed or
made CANON.
