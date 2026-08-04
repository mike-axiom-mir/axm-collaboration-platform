# 065 — Architecture and ABI Compatibility Descriptor

**ID:** `axm.adapter.architecture-abi-compatibility-descriptor`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Declare CPU architecture, word size, calling convention, endianness, runtime libraries, and host requirements before launch.

## Working capabilities

- explicit ABI descriptors
- local read-only host descriptor
- architecture/runtime/feature comparison
- no-launch verdict

## Honest limitations

- Calling convention and CPU feature discovery are not automatic.
- Compatibility verdict covers declared fields only.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
