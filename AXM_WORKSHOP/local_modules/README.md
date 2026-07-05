# AXM Local Modules

Status: TEST / public module index.

This folder holds side-by-side local modules for the AXM Workshop.

## Modules

```text
agent-tool-forge/
  Prepares reusable AI parts:
  prompts, skills, specialist masks, identity drafts, template packs, task wrappers, and wisdom links.

agent-command-center/
  Assembles prepared or test-ready parts into package profiles and identity connector bindings.

hermes/
  Wraps the real external Hermes runtime as one possible local AI body/connector.

game-hub/
  Local AI + human lobby for up to 8 visible seats, swappable human/adapter/AI seats, QR/link join, and swappable game modules from a game library.
```

## AI/tool flow

```text
Agent Tool Forge
  -> prepares reusable parts

Agent Command Center
  -> assembles package profile and identity binding

Selected connector/runtime
  -> runs selected package with consent

Shell Review
  -> checks result and repair history
```

## Game flow

```text
Game Hub
  -> shows local lobby
  -> manages up to 8 visible seats
  -> accepts humans by link/QR
  -> accepts adapters/AI as visible seats
  -> loads game-library manifests
  -> launches selected game module
```

## Public rule

Modules stay separate.

Connections stay visible.

Runtime does not mean consent.

Package selection does not mean auto-run.

AI/adapters must be visible when used as game seats.
