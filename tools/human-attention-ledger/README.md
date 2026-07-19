# Human Attention Ledger

Status: `TEST`

Technical child of Cognitive Resource Meter for explicit, opted-in and pseudonymous human review observations. Review time, interruptions, accessibility load, and outcome stay separate from machine compute.

The browser hashes the local pseudonym before submission. Names, email, identity, private memory, background timing, and productivity scores are refused. Consent withdrawal blocks future capture while preserving prior evidence lineage.

Capture and withdrawal require `human.attention.write` and explicit action headers.

Verification: `node tools/human-attention-ledger/selftest.js`
