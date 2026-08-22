# AXM Evidence Chain Candidate Review Gate

`TEST` · review-only · local-first · no permissions

This gate fills the contract between structural candidate creation and any later, separately governed application process. It binds four explicit artifacts:

1. the preserved broken JSONL source;
2. its `axm.evidence-chain-inspection/v1` receipt;
3. the structural candidate JSONL;
4. its `axm.evidence-chain-recovery-candidate/v1` receipt.

The core independently re-inspects both JSONL inputs, recomputes semantic digests with hash fields removed, verifies receipt hashes and transition rows, and emits `axm.evidence-chain-recovery-review/v1`. A fixed decision can then emit `axm.evidence-chain-recovery-review-decision/v1`.

## Decision meanings

- `HOLD_FOR_MORE_EVIDENCE` records that the packet needs more evidence.
- `REJECT_CANDIDATE` records rejection.
- `ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW` accepts only the structural packet for another review stage. It requires two explicit acknowledgements.

No decision approves application. The receipts explicitly keep application authority, candidate application, live-state writes, authenticity proof, history restoration, session recovery, promotion, and CANON false.

## Privacy and side effects

The assessment and decision receipts contain hashes, counts, fixed check codes, fixed choices, and truth boundaries. They do not contain payloads, source fields, raw lines, paths, file names, reviewer names, or free-form notes. The core has no side effects. Browser downloads occur only after explicit button presses.

## Verification

```powershell
node tools/evidence-chain-candidate-review-gate/selftest.js
node tools/evidence-chain-candidate-review-gate/discovery-seam-review.js
```

The self-test uses the current retention service to create a real segment, produces a structural candidate through the Recovery Foundry, independently reviews it, exercises fixed decisions, tests digest/semantic/transition tampering, and checks privacy and UI boundaries.
