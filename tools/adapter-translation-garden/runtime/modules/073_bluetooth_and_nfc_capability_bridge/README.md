# 073 — Bluetooth and NFC Capability Bridge

**ID:** `axm.adapter.bluetooth-nfc-capability-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_observation_normalizer`  
**Version:** `0.6.0`

## Purpose

Translate proximity, pairing, tag, and short-message interactions into bounded local events with user-visible consent.

## Working capabilities

- Bluetooth/NFC caller-supplied observation normalization
- explicit consent lease, device/tag allowlist, scope, and expiry checks
- pairing, proximity, tag, and short-message event envelopes
- payload size and hidden-identifier refusal

## Honest limitations

- Does not access radios, pair devices, read tags, or send messages.
- Consent expiry comparison uses caller-supplied ISO timestamps.
- Device identity and proximity evidence require separate trusted collection.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
