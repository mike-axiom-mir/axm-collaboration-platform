# 039 — Message Protocol Envelope Bridge

**ID:** `axm.adapter.message-protocol-envelope-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Map MQTT-, AMQP-, Kafka-, NATS-, or custom-style messages through a common envelope while retaining protocol-specific delivery semantics.

## Working capabilities

- canonical envelope normalization for declared message protocols
- topic, key, correlation, reply, headers, and payload preservation
- protocol-specific unknown-field sidecars
- explicit denormalization maps

## Honest limitations

- Does not connect to MQTT, AMQP, Kafka, NATS, or other brokers.
- Delivery guarantees are descriptors, not enforced behavior.
- Protocol fields require explicit mapping when names differ.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
