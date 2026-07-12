# AXM Agent Command Center

Status: TEST / side-by-side AI tool.

The Agent Command Center is not inside Hermes.

It is a side-by-side AXM local module that can package identities, skills, specialist masks, prompt packs, template packs, wisdom profile links, connector bindings, and run settings for any AI connector.

Hermes can use it.

ChatGPT, Claude, LM Studio, local models, or future connectors can also use it when connected through the AXM Hub.

## Correct location

```text
AXM_WORKSHOP/local_modules/
  hermes/
  agent-command-center/
  agent-tool-forge/
```

## Folder map

```text
agent-command-center/
  README.md
  COMMAND_CENTER_RULES.md
  IDENTITY_CONNECTOR_BINDING.md
  package-profiles/
  identity-bindings/
```

## What comes together here

```text
identity profile
+ connector binding
+ specialist masks
+ skills
+ prompt packs
+ template packs
+ wisdom profile links
+ run settings
+ consent rules
= package profile
```

## What this is not

This is not the Hermes runtime.

This is not the log analysis shell.

This is not the place where all raw wisdom is analyzed.

This is not a code builder by default.

This is not the Agent Tool Forge.

## Main responsibility

The Agent Command Center assembles end products into selectable AI packages.

It decides things like:

```text
which identity belongs to which connector
which package loads which skills
which specialist masks are allowed
which prompt packs are active
which template pack is used
which wisdom profile is linked
which tools are blocked
which connector is allowed for a package
```

## Relationship to Main Hub

Main Hub chooses the active connector.

Agent Command Center binds identity/package choices to that connector.

Example:

```text
Main Hub active connector: Hermes local
Agent Command Center package: GitHub Review Helper
Identity: AXM neutral helper
Specialists: mergegate reviewer, code routing gate
Skills: summarize PR, create review packet
Consent: required before action
```

## Relationship to Agent Tool Forge

Agent Tool Forge prepares reusable parts.

Agent Command Center assembles those parts into package profiles.

## Relationship to Hermes

Hermes is one possible local body/runtime.

The Agent Command Center can prepare a package for Hermes, but it is not owned by Hermes.

## Default rule

Agent Command Center assembles strength from finished parts.

Runtime is handled by the selected connector/tool.

Hub sandbox is ON by default.

Action still requires consent.

## Current TEST implementation

The live Command Center now uses `identity-registry.js` as a routing layer above the unchanged AXM foundation spine.

Current profiles:

- `nova` -> local bridge connector; private Nova memory.
- `axiom-mir` -> cloud ChatGPT bridge connector; private Axiom/Mir memory.
- `gemini-local` -> local bridge connector plus the fixed `gemini-local` model identifier; private Google Gemma memory.

The default identity is optional and only controls preselection. It never changes a connector lock or merges memories.

Private memory is the default. A memory reaches another identity only when a human explicitly files it into the shared-wisdom stream with evidence, source, and confidence.

The collaboration test in `../duo-test/` lets Nova and Gemini Local answer independently or pass a visible, attributed answer from Nova to Gemini Local for review. The transcript is not learned automatically.
