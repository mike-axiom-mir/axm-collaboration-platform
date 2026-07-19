# Mirror Native Seed-0 integration

Date: 2026-07-16

Mirror Native is a separate opt-in research body at `C:\AXM_MIRROR_LOCAL`.
It is not the older `shared/mirror-core` experiment and it is not copied into
the Workshop.

## Active Workshop seams

- `server.js` exposes a bounded `/services/mirror-native/*` loopback proxy.
- The server reads Mirror's token privately and injects it upstream; browser
  code never receives or reads the token.
- `/api/mirror-native/status` reports installed/ready/offline truth without
  starting the process.
- `AXMConnect` exposes `mirror-kernel` as a selectable provider, registered
  last so Seed-0 cannot become the default language route.
- AI Team displays Mirror as a background machine-native research body and
  keeps it visible when offline.
- Mirror publishes the standard finite presence heartbeat while running.

## Merge-gate record

Mike explicitly requested the Mirror build and Workshop connection. The active
foundation fingerprint became `b618c5762240070c`. Twenty-two active foundation
copies were synchronized. Eighty-eight historical public-package copies remain
untouched and are excluded from the current-canon lock because they are
immutable release snapshots.

## Verification

- Mirror: 15 tests passed, 0 failed.
- Mirror direct health: passed.
- Workshop same-origin proxy health: passed.
- Explicit session/reason/trace/close cycle: passed.
- Implicit memory writes on close: 0.
- Workshop verifier: 0 failures, 0 warnings.
- Full Workshop test suite: passed.

## Honest boundary

Seed-0 is a deterministic typed-evidence and supplied-candidate evaluator. It
has no learned weights, open-ended language, vision, world model, tools, file
authority, external-network authority, or automatic training. Passing this
integration proves the current contracts, not general intelligence or general
safety.
