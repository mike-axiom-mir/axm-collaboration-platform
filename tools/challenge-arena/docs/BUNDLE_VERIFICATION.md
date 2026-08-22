# AXM Challenge Arena v0.6 Evidence Bundle Verification

## Purpose

An evidence ZIP should remain verifiable after it leaves the originating Arena workspace. v0.4 therefore includes a standalone verifier that does not need the source workspace, does not extract the archive, and does not execute candidate content.

```bash
python -m axm_challenge_arena verify-bundle challenge-evidence.zip
```

The command prints a machine-readable `axm.challenge-bundle-verification/0.4` report. It exits with code `0` only when the bundle is valid and with code `1` when verification fails, making it safe to use in scripts and intake gates.

## Export

```bash
python -m axm_challenge_arena --root ./workspace bundle \
  <challenge-id> --out challenge-evidence.zip
```

Exports use sorted members, fixed ZIP metadata, a complete file manifest, an integrity report, and source-file revalidation while bytes are streamed. Re-exporting an unchanged snapshot produces byte-identical ZIPs.

The exporter refuses destinations inside Arena-managed challenge evidence so it cannot overwrite or recursively absorb its own state. If a source file changes while streaming, export aborts and removes the incomplete output.

## Verification stages

The standalone verifier checks, within configured resource limits:

1. regular-file and ZIP structure;
2. entry count, per-entry size, total expanded size, and compression ratio;
3. duplicate names, traversal, unsafe portable paths, case/Unicode collisions, encryption, symbolic links, and special files;
4. strict JSON parsing, including duplicate-key and non-finite-number rejection;
5. manifest self-hash and exact declared file set;
6. byte count and SHA-256 for every declared challenge file;
7. challenge tree hash and semantic state hash;
8. packet, rubric, state, event-head, and sequence bindings;
9. canonical event filenames and complete hash-chain reproduction;
10. exact `events.jsonl` projection;
11. integrity-report hash and snapshot agreement.

No archive member is extracted to disk during verification.

## Resource limits

The Python API accepts explicit bounds:

```python
from axm_challenge_arena import verify_evidence_bundle

report = verify_evidence_bundle(
    "challenge-evidence.zip",
    limits={
        "max_entries": 100000,
        "max_entry_bytes": 16 * 1024**3,
        "max_total_uncompressed_bytes": 64 * 1024**3,
        "max_compression_ratio": 10000.0,
        "max_metadata_json_bytes": 32 * 1024**2,
    },
)
```

Unknown limit names, booleans disguised as integers, non-positive integer limits, and invalid numeric ratios produce a failed verification report rather than silently falling back.

## What a valid result means

A valid result supports these claims:

- the received ZIP is internally consistent under the v0.4 bundle contract;
- declared challenge files match their recorded bytes and hashes;
- the canonical event chain, state bindings, and integrity snapshot agree;
- the verifier did not need to trust or access the source workspace.

A valid result does **not** prove:

- candidate quality or correctness;
- absence of malware or prompt injection;
- licensing, authorship, or legal rights;
- reviewer honesty;
- truthfulness of an external measurement;
- approval, merge readiness, deployment, or AXM canon;
- authenticity against an external trusted identity unless a separate signed release/checksum channel is used.

The bundle manifest is internally self-authenticating, not an external signature. Compare the ZIP SHA-256 through a separately trusted channel when transfer authenticity matters.

## Forensic export

Normal export refuses an invalid source workspace. `--allow-invalid` exists only for deliberate forensic capture and keeps the originating invalid integrity state visible. It must never be treated as a normal release path.

## v0.6 transport-order rule

ZIP member ordering is not semantic Arena evidence. v0.6 sorts canonical event members before parsing and filename binding. Use `tools/audit_bundle_portability.py` to exercise randomized repacks. Names, bytes, hashes, event order by canonical filename, and manifest bindings still remain authoritative.
