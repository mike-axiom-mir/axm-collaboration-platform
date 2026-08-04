# 078 — Device Clock and Sequence Reconciler

**ID:** `axm.adapter.device-clock-sequence-reconciler`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Reconcile clock skew, monotonic counters, duplicates, gaps, reordering, and reconnect epochs across devices.

## Working capabilities

- sequence gap, duplicate, and regression detection
- declared device-clock offset estimation
- stable canonical ordering
- clock ambiguity and skew visibility

## Honest limitations

- Does not change device clocks.
- Offset estimation assumes caller-supplied timestamps are comparable.
- Network delay and drift models are deliberately simple.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
