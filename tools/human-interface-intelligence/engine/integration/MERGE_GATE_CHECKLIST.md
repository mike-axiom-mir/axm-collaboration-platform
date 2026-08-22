# Module A + Module B Merge Gate Checklist

1. Keep the independent shared-contract package separate from both modules.
2. Verify its exact version and SHA-256 fingerprints before importing module outputs.
3. Run `anchor-gate` on Module One’s stable anchor.
4. Require `strict_merge_status: PASS` before consuming Capability Records.
5. Do not silently map schema fields or evidence-state tokens across conflicting contract copies.
6. Do not treat module-specific source schemas as shared schemas unless the independent contract owns them.
7. Keep proposed new fields in a contract change request until jointly accepted.
8. Run Module One against all ten stable fixtures with the exact accepted contract.
9. Export the resulting Capability Records in handoff batch format `0.2.0`.
10. Set producer state `RUN` only for a real Atlas execution on the identified payloads.
11. Attach source payloads when possible and require strict provenance.
12. Run `paired-gate`; require zero `FAIL`, zero `BLOCKED`, and explicit review of every `NOT_RUN`.
13. Archive the anchor report, paired report, registry fingerprint, schema hashes, and source hashes.
14. Connect the real registry only after both gates pass.

The current uploaded anchor is **blocked at step 4**. Module Two did not proceed to actual record intake or recommendation generation.
