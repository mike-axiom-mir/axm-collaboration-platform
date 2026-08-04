# 041 — WIT Interface Compiler

**ID:** `axm.adapter.wit-interface-compiler`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_descriptor`  
**Version:** `0.5.0`

## Purpose

Generate AXM contracts and language bindings from WebAssembly Interface Type worlds and interfaces.

## Working capabilities

- bounded WIT world and interface block extraction
- import, export, type, and function signature preservation as raw contracts
- duplicate block and unbalanced-brace refusal
- language-binding descriptor generation without code generation

## Honest limitations

- This is not a complete WIT parser or validator.
- Does not compile components, generate executable bindings, or load WebAssembly.
- Advanced nested syntax may remain as raw declarations for later tooling.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
