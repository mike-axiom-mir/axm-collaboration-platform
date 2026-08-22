# 057 — Document Structure Adapter

**ID:** `axm.adapter.document-structure-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate headings, paragraphs, lists, tables, forms, accessibility structure, annotations, and layout between document formats.

## Working capabilities

- generic document-tree preservation
- explicit supported-node filtering
- unsupported-node sidecars with source paths
- refusal mode for unsupported structure

## Honest limitations

- Does not parse or write DOCX, ODT, PDF, HTML, or other document files.
- Visual layout fidelity cannot be proven from the generic tree alone.
- Embedded binary assets remain references or sidecar values.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
