# 026 — XML and XSD Mapping Bridge

**ID:** `axm.adapter.xml-xsd-mapping-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_parser`  
**Version:** `0.5.0`

## Purpose

Translate XML namespaces, attributes, mixed content, ordering, and XSD constraints into typed AXM structures without flattening meaning silently.

## Working capabilities

- XML namespace, attribute, text, child-order, and tail preservation
- mixed-content tree normalization and deterministic reconstruction
- bounded XSD declaration inventory
- DOCTYPE and ENTITY refusal before parsing

## Honest limitations

- Does not resolve external entities, imports, includes, or schemas.
- XSD support is declaration inventory, not full validation.
- Reconstruction preserves tree meaning but not original whitespace, prefixes, comments, or byte formatting.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
