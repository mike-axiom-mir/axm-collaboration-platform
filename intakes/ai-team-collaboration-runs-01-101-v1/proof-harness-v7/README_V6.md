# AXM AI-Team Collaboration Deterministic Closure and Sandbox Proof Harness v0.6

This standard-library-only continuation adds Steward Runs 82–91 over the preserved v0.5 harness.

New executable layers:

- delegated-child closure and orphan-authority detection;
- monotonic authority epochs that clock resets cannot revive;
- evidence commitments, selective disclosure, and redaction receipts;
- partial-failure salvage and compensation ledgers;
- SHA-256 Merkle proof compaction and selective verification;
- resumable human review sessions with attention checkpoints;
- causal/vector reconciliation and split-brain holds;
- reconstructable public-safe proof summaries;
- filesystem-contained scratch intake rehearsal and rollback cleanup;
- a readiness gate capped at `READY_FOR_HUMAN_REVIEWED_LOCAL_SANDBOX_BINDING_CANDIDATE`.

Run:

```bash
python run_all_v6.py
python -m unittest discover -s tests -v
```

Evidence boundary: this harness tests only its included deterministic contracts and temporary scratch filesystem operations. It does not bind, activate, or modify AXM runtime modules, AI seats, models, connectors, private memory, devices, GitHub, Dropbox, or CANON.

Source SHA-256: `ca39b4a82ed5a9e2f9ddace06d89eb9200680401873bbc9676d22a3fa957e2ef`
Registry v6 digest: `5fe80be538c590c1a49ad63fb48202e42c0c79684e84577320a2770f92234ac4`
