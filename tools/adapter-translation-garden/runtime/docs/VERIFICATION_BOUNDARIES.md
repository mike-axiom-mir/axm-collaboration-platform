# Verification Boundaries

- Golden fixtures prove only the reviewed cases that ran.
- Differential agreement proves agreement, not correctness.
- The malformed-input module generates bounded cases but does not execute untrusted targets.
- Untrusted parsers and adapters need a separate process sandbox with time, memory, filesystem, network, and child-process limits.
- Round-trip fidelity dimensions remain separate. Byte equality does not prove meaning, behavior, appearance, timing, or authority.
- `UNPROVEN` never means pass.
- Input mutation is surfaced because hidden mutation breaks repeatability and consent.
