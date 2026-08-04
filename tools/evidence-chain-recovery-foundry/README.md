# AXM Evidence Chain Recovery Foundry

Status: TEST. Risk: HIGH. Output: structural candidate only.

The Foundry consumes a broken evidence-retention JSONL segment and the exact
`axm.evidence-chain-inspection/v1` receipt produced for it. It re-inspects the
source, confirms the receipt's source SHA-256, and proceeds only when every
error is limited to:

- `PREVIOUS_HASH_MISMATCH`;
- `EVENT_HASH_MISMATCH`; or
- `EVENT_HASH_FORMAT_INVALID`.

Malformed JSON, missing fields, schema mismatches, metadata warnings, an
already-valid source, or a mismatched receipt are refused.

## Candidate construction

After explicit acknowledgement that authenticity remains unknown, the Foundry:

1. copies parsed events in memory;
2. changes only `previousHash` and `eventHash`;
3. emits normalized JSONL formatting;
4. compares SHA-256 of every non-hash event object before and after;
5. independently runs Evidence Chain Inspector on the candidate; and
6. enables separate explicit downloads for the candidate and digest-only
   receipt.

The receipt includes hash transitions and semantic digests but no payload,
source, event identifier, event type, session identifier, raw line, filename or
full path.

## Truth boundary

A passing reconstructed chain proves only structural self-consistency. It does
not prove payload authenticity, identify which copy is historically correct,
restore source history, recover a session, authorize applying the candidate or
make the server safe to start.

The original is never written or deleted. The candidate is never applied,
installed, promoted, released or made CANON. No network or persistent browser
storage is used.

## Checks

```powershell
node tools\evidence-chain-recovery-foundry\selftest.js
node tools\evidence-chain-recovery-foundry\discovery-seam-review.js
```
