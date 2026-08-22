# Module 1 Deferred-Materialization Adapter

This adapter was added after the real `MODULE1_STABLE_INTAKE_HANDOFF.txt` arrived.
It does not ingest or rewrite Module 1. It prepares Module 3 to read the actual
v0.10.0 package without applying fixture assumptions.

## Critical corrections

- External canonical Module 1 ID is `axm.module.human_capability_atlas`.
- The old Module 3 fixture ID `axm:module:human-capability-atlas` remains only a
  local graph reference; the binding is explicit and reversible.
- The final Module 1 bundle is software prepared for local intake. It does not
  contain the real 1,769-card corpus, real producer receipts, or a real batch plan.
- A package rehearsal can pass while corpus materialization is still required.
- Module 1 has no standalone canonical `Evidence Tuple` record.
- Module 1 truth tokens remain in their own namespace and are not flattened.
- Full fresh-run card hashes may differ because timestamps and run IDs are
  volatile. Semantic identity uses the portable normalized semantic hash.
- Nested ZIP payloads must be independently hashed and archive-probed.

## Main commands

```bash
python module1_adapter/module1_adapter.py
python module1_adapter/semantic_identity.py module1_adapter/fixtures/semantic_records.json
python interop_preflight/preflight_three_module_intake_v3.py   module1_adapter/fixtures/preintake_triplet/module1.json   module1_adapter/fixtures/preintake_triplet/module2.json   module1_adapter/fixtures/preintake_triplet/module3.json
```

No command here executes Module 1, generates the real corpus, or invokes Merge Gate.
