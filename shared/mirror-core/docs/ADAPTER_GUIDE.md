# Adapter guide

An adapter is the only component allowed to translate a reviewed Mirror packet into one native system. It is narrow, allowlisted, versioned, and honest about limitations.

## Required surface

Every adapter supplies a descriptor and these methods:

- `healthCheck()`
- `exportSnapshot()`
- `readEntities()`
- `resolveNativeId(nativeId)` / `getEntity(nativeId)`
- `createProposal(input)`
- `previewApply(packet)`
- `applyApprovedPacket(packet)`
- `verifyApplication(receipt)`
- `rollbackApplication(snapshot)`
- `currentRevision()`
- `disconnect()`

The descriptor declares schema versions, entity types, operation allowlist, read/write capabilities, supported connection modes, permission requirements, and limitations.

## Implementation rules

1. Keep native state outside Mirror's registry.
2. Export only user-authorised fields and evidence references.
3. Never fetch an arbitrary URL, execute packet content, interpret shell/code fields, or accept unrestricted paths.
4. Preview by applying operations to a clone and return an exact diff.
5. Refuse application unless the adapter is in `approved_apply` and the packet is approved/applying.
6. Return pre/post revisions, hashes, operation results, and time.
7. Verify from native state, not from the Mirror registry alone.
8. Roll back only if supported and safe; otherwise declare it unavailable.
9. Keep secrets and native payloads out of logs.

## Native-to-Mirror projection

Projection creates a representation with a stable Mirror ID, source system/native ID, truth facets, provenance, evidence references, adapter version, input hash, and explicit limitations. It does not copy native authority into Mirror.

## Safe-file example

`adapters/safe-file-project` is intentionally confined to its fixture root. It accepts only `project.json`, JSON values, and one allowlisted action (`write_fixture_json`). Path traversal and every other filename/action are refused. This demonstrates the security boundary; it is not a general file adapter.

## Future adapter SDK promotion

Before a real adapter is admitted, add contract tests for descriptor validity, export determinism, connection modes, permission/consent revocation, unsupported operations, precondition conflict, verifier mismatch, rollback eligibility, privacy filtering, and recovery after restart. Real machines, finance, payroll, customer data, medical data, and physical construction need domain-specific safety and are not unlocked by satisfying this generic contract.
