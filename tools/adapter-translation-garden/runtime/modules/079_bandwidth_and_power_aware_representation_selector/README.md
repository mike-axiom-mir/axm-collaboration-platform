# 079 — Bandwidth and Power-Aware Representation Selector

**ID:** `axm.adapter.bandwidth-power-aware-representation-selector`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Choose a supported representation using bandwidth, battery, thermal, memory, latency, and quality constraints.

## Working capabilities

- bandwidth and power budget filtering
- quality and fidelity-aware deterministic ranking
- visible degradation explanations
- no-download representation selection

## Honest limitations

- Uses caller-declared estimates rather than live measurements.
- Does not transcode, download, or switch a live stream.
- Human priorities must be expressed through weights and minimums.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
