# 023 — AsyncAPI Contract Importer

**ID:** `axm.adapter.asyncapi-contract-importer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_descriptor`  
**Version:** `0.5.0`

## Purpose

Convert message-driven API descriptions into typed channels, operations, payload contracts, bindings, and local test fixtures.

## Working capabilities

- AsyncAPI 2.x channel publish/subscribe normalization
- AsyncAPI 3.x operation and channel-reference normalization
- message payload, headers, correlation, bindings, and declared-security preservation
- external reference inventory without broker or network access

## Honest limitations

- Does not connect to brokers, subscribe, publish, or resolve external references.
- Bindings are preserved as descriptors and are not interpreted as credentials or authority.
- Complex traits and vendor extensions may require local extension adapters.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
