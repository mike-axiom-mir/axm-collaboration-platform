# CCR-0001 — Shared Contract Identity Conflict

**Status:** OPEN — BLOCKING REVIEW  
**Affected contract:** `axm.capability-interface-contract` `0.1.0`

Module One and Module Two currently identify their shared schemas as the same contract version, but their schema hashes, evidence-state tokens, and accepted fields differ.

This cannot be repaired by a silent adapter. A silent adapter would hide the fact that the two modules are not consuming the same contract.

## Preferred repair

Keep the existing independent standalone `0.1.0` package as canonical. Module One should consume its exact schema files and serialize its outputs accordingly. Requirements not representable by that version should remain proposed until a new version is jointly accepted.

## Alternative repair

Create a new standalone shared-contract version with explicit migrations and rerun both modules’ fixture suites. Do not overwrite or reinterpret `0.1.0`.

## Gate effect

Paired Module One → Module Two intake remains **BLOCKED**. Module Two’s own standalone recommendation engine remains operational for records that already validate against its accepted contract.
