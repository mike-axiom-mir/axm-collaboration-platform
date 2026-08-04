# 044 — Subprocess JSON-RPC Bridge

**ID:** `axm.adapter.subprocess-jsonrpc-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Run a local tool as a confined subprocess exchanging versioned JSON requests, responses, progress, cancellation, and structured errors.

## Working capabilities

- exact argv and confined-working-directory launch plans
- executable allowlist checks without shell interpolation
- versioned JSON-RPC request, cancellation, and progress envelopes
- deterministic environment allowlist projection

## Honest limitations

- Does not spawn processes, read stdout, cancel work, or touch the filesystem.
- Path confinement is lexical and must be backed by runtime filesystem controls.
- Executable identity and signatures require separate verification.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
