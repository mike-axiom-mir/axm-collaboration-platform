# 097 — Adapter Health Monitor

**ID:** `axm.adapter.health-monitor`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_observation_analyzer`  
**Version:** `0.6.0`

## Purpose

Track availability, contract drift, latency, failure patterns, resource pressure, freshness, and verification status.

## Working capabilities

- availability, drift, latency, failure, pressure, freshness, and verification observation aggregation
- deterministic healthy/degraded/unhealthy/stale/drifted classification
- threshold and evidence-window visibility
- no active polling or automatic quarantine

## Honest limitations

- Does not monitor processes, networks, resources, or clocks directly.
- Observations and current time are caller-supplied.
- Thresholds require local calibration and human review.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
