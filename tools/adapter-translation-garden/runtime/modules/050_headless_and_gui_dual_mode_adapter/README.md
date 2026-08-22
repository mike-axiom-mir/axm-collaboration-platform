# 050 — Headless and GUI Dual-Mode Adapter

**ID:** `axm.adapter.headless-gui-dual-mode-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Expose the same semantic operation through automated headless execution or human-visible GUI guidance while keeping authority differences explicit.

## Working capabilities

- semantic-operation parity checks across headless and GUI modes
- human-visible, automation, authority, and capability constraint matching
- explicit preferred-mode selection with truthful fallback
- non-executing plan output for either mode

## Honest limitations

- Does not automate GUIs or execute headless tools.
- Mode descriptors and parity claims are caller-supplied evidence.
- Human-visible guidance still requires a person to perform the action.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
