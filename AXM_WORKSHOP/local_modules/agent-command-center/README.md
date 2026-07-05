# AXM Agent Command Center

Status: TEST / side-by-side AI tool.

The Agent Command Center is not inside Hermes.

It is a side-by-side AXM local module that can package identities, skills, specialist masks, prompt vault links, templates, wisdom profile links, connector bindings, and run settings for any AI connector.

Hermes can use it.

ChatGPT, Claude, LM Studio, local models, or future connectors can also use it when connected through the AXM Hub.

## Correct location

```text
AXM_WORKSHOP/local_modules/
  hermes/
  agent-command-center/
```

## What comes together here

```text
identity profile
+ connector binding
+ specialist masks
+ skill wrappers
+ prompt vault links
+ template links
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

## Main responsibility

The Agent Command Center assembles end products into selectable AI packages.

It decides things like:

```text
which identity belongs to which connector
which package loads which skills
which specialist masks are allowed
which prompt vault links are active
which template set is used
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

## Relationship to Hermes

Hermes is one possible local body/runtime.

The Agent Command Center can prepare a package for Hermes, but it is not owned by Hermes.

## Default rule

Agent Command Center assembles strength from finished parts.

Runtime is handled by the selected connector/tool.

Hub sandbox is ON by default.

Action still requires consent.
