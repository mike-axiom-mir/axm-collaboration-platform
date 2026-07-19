# Mirror Hierarchical-Context Challenger Action Report — 2026-07-19

Status: **TEST**

## Outcome

Mirror's private token learner now preserves more than one-token transition
memory without adding dependencies or changing the active runtime. A new sparse
hierarchical-context learner fits context orders two through six, combines exact
context evidence with Witten-Bell backoff, and stores only observed transitions.

The current immutable private cycle is `cycle-f01cfb87aa7ae5dae228`. It trained
twenty candidates on 6,826 permissioned tokens across eleven training source
groups and selected `hierarchical-context-o3-a1` using validation perplexity
only. Candidate selection records contain no local-test metric.

Measured results:

- frozen trigram baseline validation perplexity: 213.23;
- selected challenger validation perplexity: 83.61;
- frozen trigram local regression perplexity: 208.78;
- prior one-token challenger local regression perplexity: 132.03;
- selected challenger local regression perplexity: 105.45;
- reduction versus the frozen baseline: 49.49%;
- learned sparse transition counts: 5,508;
- behavior canaries: 5/5 pass.

The local test document is excluded from training, but it has been evaluated in
earlier cycles. It is therefore a repeated local regression instrument, not an
untouched or independently authored transfer exam.

## What changed

- Added `learning/hierarchical-context-language-model.js`.
- Kept the older one-token learner and every prior failed cycle as historical
  evidence.
- Updated the learning cycle to fit twenty bounded configurations, select by
  validation only, and evaluate exactly one selected model on the local
  regression partition.
- Added explicit machine fields proving that test metrics were unavailable to
  selection, the test stayed outside training, and the test is not independent.
- Strengthened the Seam Cell so missing proof of test-excluded training or
  test-free model selection becomes a critical hold.
- Added deterministic sparse-weight reload, sampling, source-split, permission,
  and explicit-hold checks.

## Verification

- Focused language, learning-cycle, and Seam Cell tests: 16/16 pass.
- Wider focused boundary verification: 28/28 pass.
- Full repository suite: 272/272 pass.
- The current cycle reuses exact inputs and keeps one open seam:
  `training-corpus-small`.
- The active runtime PID remained 496 and no runtime pointer changed.

## Authority boundary

The new weights remain private state. Validation selection does not grant model
promotion, runtime loading, training-data admission, permission, tool use,
memory writes, canon change, identity change, or world action. A better repeated
local regression metric is not proof of broad language transfer, general
intelligence, safety, consciousness, or CANON.

## Known limits

- The training partition contains 6,826 tokens and eight reviewed episodes;
  the current broad-language evidence gate remains 50,000 permissioned,
  deduplicated tokens.
- The local validation and test documents are Mirror-authored and have been
  observed before.
- No outside-authored full language exam has been received.
- Sparse count learning is a stronger machine-grounded language rung, not a
  complete neural language model.
- Only Mike may accept CANON.
