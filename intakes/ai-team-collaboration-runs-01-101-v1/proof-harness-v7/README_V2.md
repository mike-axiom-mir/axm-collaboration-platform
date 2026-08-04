# AXM AI-Team Collaboration Deterministic Integration Proof Harness v0.2

This extends the Run-41 harness with executable proof for lifecycle transitions, concurrency/idempotency, schema migration, offline reconciliation, evidence caching, adapter conformance, observability completeness, deterministic fuzzing, and local-intake gating.

Run:

```bash
python run_all_v2.py
python -m unittest discover -s tests -v
```

Truth boundary:

- Uses Python standard library only.
- Executes deterministic fixtures and simulations, not AXM runtime modules.
- Does not access models, connectors, private memory, devices, network, GitHub, or CANON.
- `READY_FOR_LOCAL_INTAKE_CANDIDATE` is not integrated, approved, or CANON.
- Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
