# 042 — WebAssembly Component Host Bridge

**ID:** `axm.adapter.wasm-component-host-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Host portable components through explicit imports, exports, capabilities, resource limits, and local authority grants.

## Working capabilities

- component import/export capability matching
- explicit capability-grant and resource-limit verification
- missing-grant and unsupported-import refusal
- deterministic non-executing host-plan generation

## Honest limitations

- Does not parse Wasm binaries, instantiate components, or call exports.
- Capability catalogs and resource estimates are caller-declared.
- Runtime isolation and metering require a separately reviewed host.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
