# Migration — v0.10.0 to v0.11.0

The shared Capability Record contract remains exactly `0.1.0`.

## Breaking Module-One sidecar changes

The following Module-One-specific formats moved to `0.2.0`:

- producer receipt;
- batch plan;
- batch receipt;
- production-run manifest.

v0.10 receipts/plans/manifests must not be relabeled as v0.11 evidence.

## Why rebuild

v0.11 producer evidence binds:

- exact implementation fingerprint;
- complete derived artifact membership/bytes;
- deterministic artifact regeneration;
- normalized exact/semantic inventory;
- public preflight;
- exact/semantic plan identity;
- full batch/production evidence chain.

Existing v0.10 cards can remain rollback/history artifacts, but v0.11 `RUN`
claims require rebuilding them with v0.11.

## Staging migration

Use a fresh v0.11 staging directory. Do not reuse a v0.10 plan or production
manifest.

Preserve v0.10 unchanged. If real intake exposes a v0.11 compatibility problem,
hold v0.11 and compare evidence rather than weakening the verification gates.
