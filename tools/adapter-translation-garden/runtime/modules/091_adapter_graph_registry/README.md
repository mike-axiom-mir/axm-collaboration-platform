# 091 — Adapter Graph Registry

**ID:** `axm.adapter.graph-registry`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Represent formats, schemas, protocols, runtimes, engines, devices, and adapters as a versioned capability graph.

## Working capabilities

- versioned node and adapter-edge registration without in-place mutation
- duplicate/conflicting identity and dangling-edge refusal
- format, schema, protocol, runtime, engine, and device node typing
- capability, proof, status, and authority metadata preservation

## Honest limitations

- Does not discover adapters, execute edges, or persist registries.
- Graph trust depends on caller-supplied evidence.
- Semantic equivalence requires separate fixtures and proof packets.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
