# Deterministic Support v0.6

## Purpose

Deterministic support establishes machine-checkable facts before peer preference. It does not automatically choose the winner and does not replace human judgment.

## Included validator kinds

```text
artifact_exists       command                 deterministic_command
extension             external_receipt        ffprobe_media
file_count            file_tree               image_aspect_ratio
image_dimensions      json_keys               json_schema_lite
json_valid            magic_signature         manifest_deliverables
mime_guess            no_external_urls        png_alpha
provenance_present    python_compile          regex
sha256                size_range              text_contains
text_line_count       text_not_contains       wav_duration
zip_integrity
```

Unknown validator kinds return `SKIP`, never a fabricated pass.

## Intake revalidation

Before deterministic execution, review, export, or synthesis, the Arena revalidates candidate evidence where applicable:

- challenge, packet, rubric, and participant acknowledgement;
- submission manifest identity;
- artifact root safety;
- declared and actual file parity;
- byte counts and SHA-256;
- deliverable cardinality;
- symlink and portable-path policy.

Changed candidate bytes cause refusal rather than silent retesting.

## Command boundary

Candidate command execution is disabled by default. When explicitly enabled, the gate records:

- arguments and configured timeout;
- exit and timeout status;
- observed stdout/stderr bytes;
- retained stdout/stderr bytes;
- truncation/limit status;
- retained output hashes;
- replay file count and byte budgets;
- best-effort process-tree termination evidence.

These are resource controls, not a security sandbox.

## External receipts

Specialist systems can return measurements without being embedded into Arena. Receipts can be HMAC-signed and are bound to:

- challenge ID;
- packet and rubric hashes;
- submission ID;
- candidate content and artifact-set hashes;
- runner ID and key ID;
- exact results and metadata.

A valid HMAC proves exact payload integrity and possession of the configured secret. It does not prove that the measurement was performed honestly or correctly.

## Diagnostic evidence

Candidate convergence and content-safety diagnostics are deterministic support but not scoring checks.

v0.4 recomputes them from sealed artifacts during integrity verification. This prevents a report from becoming trusted merely because its internal hash is valid.

Similarity is not proof of copying. Scanner signals are not proof of malicious intent. Both remain non-punitive unless a future challenge explicitly locks a lawful, justified policy before reveal.

## Peer score grounding

Peer score references are validated deterministically against known evidence targets:

- artifact path exists in the candidate manifest;
- deterministic check ID exists in the candidate result set;
- manifest root exists;
- observation is explicitly marked and bounded.

This proves reference validity, not interpretation quality.

## Evidence gaps

The synthesizer exposes missing deterministic coverage, missing peer support, abstentions, uneven review opportunity, ungrounded legacy scores, and pending human rubric weight. Missing evidence is not silently converted to zero unless the locked deterministic policy explicitly treats an absent candidate check as failure under equal availability.

## Extension

Custom validators register by kind. A validator should:

- never mutate candidate artifacts;
- be deterministic for the same sealed inputs and configuration;
- return explicit `PASS`, `FAIL`, `ERROR`, or `SKIP`;
- bound file, memory, process, and output use;
- preserve evidence rather than only a boolean;
- avoid claiming sandbox or semantic authority it does not have.
