# 072 — LAN Service Discovery Bridge

**ID:** `axm.adapter.lan-service-discovery-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_observation_normalizer`  
**Version:** `0.6.0`

## Purpose

Discover approved local services and capabilities without requiring internet, global accounts, or hidden network exposure.

## Working capabilities

- caller-supplied mDNS/DNS-SD-style observation normalization
- service-type, service-ID, verification, and local-address allowlist checks
- private, loopback, link-local, and .local scope classification
- duplicate service observation reconciliation

## Honest limitations

- Does not scan LANs, open sockets, resolve names, or contact services.
- Locality is inferred from supplied addresses/hostnames and is not a security proof.
- Service authenticity requires separate cryptographic verification.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
