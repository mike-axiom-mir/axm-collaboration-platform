# 024 — Protocol Buffers Unknown-Field Preserver

**ID:** `axm.adapter.protobuf-unknown-field-preserver`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_binary_inspector`  
**Version:** `0.5.0`

## Purpose

Maintain unknown binary fields and field-number lineage across older and newer message versions.

## Working capabilities

- bounded Protocol Buffers wire-field segmentation
- exact unknown-field raw-byte preservation with field number and wire type
- original-order reassembly and SHA-256 evidence
- truncation, invalid-key, group-wire, and size-limit refusal

## Honest limitations

- Does not interpret message descriptors or decode semantic field values.
- Deprecated group wire types are refused rather than guessed.
- Caller must supply the set of known field numbers.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
