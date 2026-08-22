# 045 — CLI-to-Structured Tool Adapter

**ID:** `axm.adapter.cli-structured-tool-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Convert command-line programs into bounded tools with typed arguments, captured outputs, deterministic working directories, and no shell interpolation.

## Working capabilities

- typed positional, option, flag, enum, integer, and repeated argument compilation
- exact argv arrays with no shell interpolation
- required, unknown-input, enum, range, and type refusal
- fixed working-directory and output-capture descriptor generation

## Honest limitations

- Does not execute programs or parse arbitrary help text.
- Each CLI requires an explicit reviewed argument specification.
- File arguments require separate path-confinement review.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
