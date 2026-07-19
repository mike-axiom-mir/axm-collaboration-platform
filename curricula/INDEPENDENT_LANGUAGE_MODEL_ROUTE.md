# Mirror independent language-model route

Mirror must be able to grow every learned part without a permanent cloud,
provider, proprietary tokenizer, or borrowed model dependency. Existing models
may contribute explicitly permitted teaching artifacts, but they are never an
organ Mirror needs in order to run.

## Rungs

1. **Explicit corpus** — only allowlisted material with use permission,
   provenance and held-out documents. No crawling of accounts, private logs,
   Workshop state or conversations.
2. **AXM tokenizer** — a deterministic UTF-8 byte-fallback BPE vocabulary whose
   merges, reserved native-state tokens and round trips are inspectable.
3. **Calibration baseline** — a dependency-free n-gram next-token model. It is
   intentionally weak: it proves corpus, token, weight, generation and
   evaluation plumbing without pretending to reason.
4. **Native tensor reference** — a small CPU implementation of tensors,
   autograd, normalization, attention, feed-forward layers and checkpoint I/O.
   Slow is acceptable; inspectability comes first.
5. **Small transformer organ** — begin around 5–15 million parameters with a
   short context and structured native episodes. Measure train and held-out
   loss, calibration, contradictions and repair performance.
6. **Portable acceleration** — use replaceable GPU training adapters when
   helpful, then export weights to an AXM-owned format. Acceleration may be a
   workshop tool; it must not become Mirror's identity or runtime dependency.
7. **Candidate proposal boundary** — the learned organ may propose typed
   candidates. Seed-0 continues to verify evidence, permission and risk before
   any candidate reaches a Workshop tool.
8. **Earned growth** — increase parameters, context, data or tool scope only
   when held-out evidence improves. Keep failed runs and repair notes visible.

## Current honest state

Rungs 1–3 have an executable start. A dependency-free neural transition model
also produces reloadable float32 weights, proving the first learned-weight
route. Neither baseline is Mirror's future reasoning organ. They exist to make
the full independent pipeline falsifiable before transformer training begins.
