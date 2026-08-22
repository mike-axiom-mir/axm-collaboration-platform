# AXM AI-Team Collaboration Deterministic Finalization Proof Harness v0.7

This standard-library-only continuation implements Steward Runs 92–101.

It adds:

- exact human-decision snapshot binding;
- local HMAC receipt authenticity and key rotation checks;
- canonical package manifests and collision rejection;
- two-phase intake transaction rehearsal without runtime application;
- shared invariant bundles and sparse proof selection;
- dependency-free launch self-tests;
- beginner-safe human handoff-kit validation;
- archive traversal, collision, symlink, encryption, size, and compression-ratio inspection;
- complete Run 01–101 lineage auditing;
- a final gate capped at `READY_FOR_LOCAL_AXM_INTAKE_HANDOFF_CANDIDATE`.

Run:

```bash
python run_all_v7.py
python -m unittest discover -s tests -v
```

The HMAC layer proves only possession of a local shared test key. It does not prove a real-world identity. The harness does not apply changes to AXM runtime, models, connectors, devices, private memory, GitHub, Dropbox, or CANON.

Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
Registry v7 digest: `be04bf1540210231e0d58488822189aab3f133eb93880ba53511c6dfd11ff1d3`
