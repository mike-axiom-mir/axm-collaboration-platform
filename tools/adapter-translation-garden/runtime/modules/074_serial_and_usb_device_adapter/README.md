# 074 — Serial and USB Device Adapter

**ID:** `axm.adapter.serial-usb-device-adapter`  
**Status:** `SHADOW_ONLY`  
**Authority:** `shadow_only`  
**Version:** `0.1.0`

## Purpose

Expose a device through fixed descriptors, message framing, reconnect handling, rate limits, and physical safety boundaries.

## Current growth

This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
