# 082 — Consent and Authority Lease Adapter

**ID:** `axm.adapter.consent-authority-lease`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.2.0`

## Purpose

Bind an adapter action to an exact human permission, scope, expiry, target, and revocation state without inherited authority.

## Working capabilities

- exact expiring consent leases
- revocation checks
- scope and purpose matching
- no inherited authority

## Honest limitations

- Lease fingerprints detect accidental change but are not cryptographic signatures.
- Identity of the grantor must be verified elsewhere.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
