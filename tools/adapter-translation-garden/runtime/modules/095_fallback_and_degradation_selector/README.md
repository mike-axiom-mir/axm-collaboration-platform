# 095 — Fallback and Degradation Selector

**ID:** `axm.adapter.fallback-degradation-selector`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Choose a truthful lower-capability route instead of silently approximating unsupported behavior.

## Working capabilities

- required-semantic and allowed-degradation constraint checks
- truthful lower-capability candidate ranking
- user-acceptance requirement for material degradation
- visible refusal when only silent approximation remains

## Honest limitations

- Does not execute routes or obtain consent itself.
- Candidate capability and degradation declarations require independent proof.
- Selection policy weights are deliberately simple and inspectable.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
