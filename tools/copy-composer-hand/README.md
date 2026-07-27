# Copy Composer Hand

A deterministic, dependency-free hand for bounded quotes, slogans, mottos, taglines and short-copy candidates.

It consumes `axm.copy.request/v1` and returns `axm.copy.candidate/v1` plus an embedded `axm.copy.receipt/v1`. The receipt records its grammar recipe, replay fingerprint, checks and zero model/network/write authority.

This is intentionally not a language model and does not claim open-ended authorship. It composes within a small declared phrase grammar. Output is candidate-only until a human accepts or explicitly copies it.

Run `node selftest.js` to verify deterministic replay and authority boundaries.
