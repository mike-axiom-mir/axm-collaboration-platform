# AXM Agent Tool Forge

Status: TEST / bounded software draft foundry.

## v0.2 working surface

The Forge now has a user-facing Safe Composer and a draft-only machine door.
Both call the same deterministic `forge-core.js`.

It can:

- create and resume a draft
- choose a Foundation tool, Hub module, dual-door tool, proposal analyzer, or machine capability
- declare purpose, output, risk, capabilities, tags, and explicit boundaries
- validate the draft
- render a complete reviewable file set
- calculate deterministic SHA-256 draft and package fingerprints
- export a module ZIP or review JSON

It cannot:

- install or overwrite a module
- execute generated code
- change Foundation files
- promote status
- mark anything WORKING or CANON

Agent Tool Forge grows out of the old prompt vault idea.

The name Prompt Vault is too small for what this layer needs to become.

Prompt Vault is only one part of the Forge.

## Purpose

Agent Tool Forge is where reusable AI parts and bounded software packages are drafted before another governed step stages or assembles them.

It prepares:

- prompt packs
- skills
- specialist mask drafts
- identity profile drafts
- template packs
- wisdom profile links
- task wrappers

## Folder map

```text
agent-tool-forge/
  prompt-packs/       reusable prompts and prompt groups
  skills/             small repeatable AI actions
  specialist-masks/   situation or domain role drafts
  identity-drafts/    identity profile drafts
  template-packs/     stable output structures
  task-wrappers/      small bounded task processes
  wisdom-links/       references to wisdom profiles or rule packs
```

## Correct split

```text
Agent Tool Forge
  -> prepares reusable AI parts

Agent Command Center
  -> assembles approved or test-ready parts into package profiles

Hermes / other connector
  -> runs the selected package with consent

Shell Review
  -> analyzes run results, logs, growth, and repair history
```

## What this is not

This is not the Command Center.

This is not the Hermes runtime.

This is not the shell review layer.

This is not the final package selection screen.

## Prompt vault relationship

Prompt Vault becomes the prompt-packs area inside the Agent Tool Forge.

It should store reusable prompts and prompt packs.

But the Forge also handles skills, specialist masks, identity drafts, template packs, wisdom links, and task wrappers.

## Status path

Parts created here should move through AXM status labels:

```text
RAW
REVIEW
ACCEPT FOR TEST
WORKING
KNOWN FAIL
RETIRED
CANON only after MergeGate
```

## Forge loop

```text
1. Define small need or wrapper need.
2. Choose part type.
3. Draft prompt / skill / mask / identity / template.
4. Add boundaries.
5. Add consent requirement if action is possible.
6. Save as RAW or REVIEW.
7. Test only in bounded run.
8. Send useful parts to Agent Command Center.
9. Let Shell Review evaluate performance later.
```

## Part types

### Prompt pack

Reusable prompt or prompt group.

### Skill

Small repeatable AI action.

Examples:

```text
summarize PR
make intake card
extract status labels
turn notes into task list
```

### Specialist mask draft

Situation or domain role.

Examples:

```text
mergegate reviewer
SFX intake reviewer
visual asset reviewer
local bridge tester
```

### Identity profile draft

Operating stance for an AI connector or package.

### Template pack

Stable output format with flexible inner content.

### Task wrapper

Small bounded process for a known task.

## AXM rule

Agent Tool Forge prepares parts.

Agent Command Center assembles packages.

Runtime belongs to the selected connector.

Action requires consent.

No prepared part becomes canon by default.
