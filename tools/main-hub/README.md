# AXM Main Hub Compatibility Card

Status: `SHELL` / display-only legacy route.

This module is not the active AXM Hub runtime. It preserves the older `/tools/main-hub/` route and displays four explicit same-origin links:

- Game Hub
- Agent Command Center
- Agent Tool Forge
- Hermes

The page also reports when its local Foundation script is absent.

## What is not implemented

This module does not currently provide:

- layer switching or layer persistence
- a hidden workshop/build route
- password input, validation, or storage
- authentication or access control
- hub-state loading or saving
- module loading or automatic navigation
- ownership of the current Hub

The previous prose described these as a future model but sometimes used present tense. `HUB_LAYER_RULES.md` and `settings/HUB_LAYER_SETTINGS.example.json` now identify that model as a plan-only reference.

## Security boundary

A future local password convenience must not be described as security or authentication. No real password belongs in this repository. Implementing access control would require a separate reviewed design, runtime, denied/allowed tests, and explicit authority.

## Current proof

`selftest.js` validates the modern manifest and contract, exact link roster and target existence, absence of state/access-control code, plan-only settings, capability metadata, inline syntax, and definite static accessibility findings.

The self-test cannot prove rendered usability, runtime availability of target modules, future layer behavior, authentication strength, or human approval. Those remain `UNKNOWN` or unimplemented.
