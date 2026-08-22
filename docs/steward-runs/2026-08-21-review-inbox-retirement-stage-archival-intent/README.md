# Review Inbox archival intent v5.2 — TEST evidence

This folder binds product commit `b707aa08f0adf958f6344babf0839c37ab1b9dca` and tree `0f2aa8e9e2fad6e19416c93667cf426899955eed` to durable exact-request intent before lossless residual retirement-publication stage archival.

## Exact outcome

- Exact v5.1 baseline reproduces the missing durable archival authorization record.
- v5.2 publishes an append-only request- and stage-bound intent before new archive mutation.
- Six intent-publication and nine archive process crashes cover all three retirement artifact kinds.
- Reentrant and two real cooperating callers converge on exact intent and archive evidence.
- Legacy archives/checkpoints remain authorization-unknown; no posthoc intent or unsafe checkpoint unlink occurs.
- 21/21 scoped commands pass with 1,110 focused assertions or controls.
- Review Inbox current promotion selftest passes and tools-index says `READY_FOR_HUMAN_REVIEW`; twelve other tool selftests remain nonpassing.
- Clean dependency-slice replay passes without tracked-byte changes.
- Aggregate operations remains `FOREIGN_FAILURE` at the unchanged missing curated verification intake.

## Read first

- `FRONTIER_AUDIT.md` — bounded result and truth ceiling.
- `EVIDENCE_ROUTES.json` — claim-specific proof and counterevidence.
- `BASELINE_AUTHORIZATION_GAP.json` — exact v5.1 missing-record reproduction.
- `CHECK_RESULTS.json` — focused plus required checks.
- `PROMOTION_SELFTEST_RECEIPT.json` — current Review Inbox pass plus preserved global nonpasses.
- `CLEAN_PRODUCT_REPLAY.json` — exact clean product-slice replay.
- `AGGREGATE_OPERATIONS_PROBE.json` — preserved foreign aggregate failure.
- `SOURCE_SNAPSHOT.json` — exact product files and digests.

## Gate and continuity

The product remains `TEST`. READY_FOR_HUMAN_REVIEW is not promotion or acceptance. Mike Tobi / AXM remains the merge and `CANON` gate. No actor authentication, consent, publisher safety, byte deletion, storage reclamation, browser pass, authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` is claimed. The broad grounded-growth objective remains active.
