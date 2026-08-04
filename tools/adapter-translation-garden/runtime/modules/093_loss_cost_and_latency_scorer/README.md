# 093 — Loss, Cost, and Latency Scorer

**ID:** `axm.adapter.loss-cost-latency-scorer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Score routes by semantic loss, unknown-field retention, quality, compute, time, energy, privacy, reversibility, and proof.

## Working capabilities

- weighted semantic-loss, retention, quality, compute, latency, energy, privacy, reversibility, and proof scoring
- required-metric and bounded-range validation
- per-dimension contribution disclosure
- deterministic route ranking with tie visibility

## Honest limitations

- Does not measure runtime behavior or execute routes.
- Scores are only as reliable as supplied metrics and selected weights.
- Human review remains required for value-sensitive tradeoffs.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
