# Deterministic PR Sequencer core

Pure sequencing logic and the bounded read-only GitHub host adapter for AXM's
multi-PR handoff lane. The core consumes explicit ordered policy, public-safe
platform handoff receipts, and normalized GitHub receiver facts. It selects at
most one technical next candidate and requires a complete reprobe after every
external action.

The host adapter invokes only authenticated `gh` reads. It contains no pull
request, branch, merge, promotion, roots, or CANON write operation.
