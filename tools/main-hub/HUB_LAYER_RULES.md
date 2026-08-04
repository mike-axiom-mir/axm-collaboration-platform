# Main Hub Layer Plan

Status: `PLAN_ONLY` / not implemented / no runtime authority.

This document preserves a possible future navigation model. The current Main Hub module is only a display card with explicit links. Nothing reads this document to switch layers, hide routes, validate passwords, authenticate users, or persist hub state.

## Proposed starter model

```text
Layer 0: visible-hub
  Proposed clean entry layer.

Layer -1: workshop-build
  Proposed crew/build layer entered by an explicit layer action.
```

## Proposed noise-control rule

A future router could keep ordinary entry simple while making build tools deliberately reachable. That is a product-design direction, not current behavior.

## Password boundary

The historical plan mentioned a simple local password convenience. It would not be internet-grade security or authentication. No password input, validation, storage, denied/allowed boundary, or runtime exists in this module today.

Any future access-control implementation requires:

- an explicit authority contract
- ignored local secret storage
- allowed and denied identity tests
- restart and persistence tests
- visible recovery behavior
- independent security review

## Current truth

- `index.html` is display-only.
- Four same-origin links are explicit.
- The Foundation presence indicator is display-only.
- `settings/HUB_LAYER_SETTINGS.example.json` is a design example with `implemented: false`.
- The active Hub remains separate.
