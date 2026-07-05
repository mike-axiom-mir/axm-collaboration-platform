# Hermes Identity Connector Binding

Status: TEST / identity routing layer.

Hermes is a local body/tool strength.

Identity should not be trapped inside one tool.

Identity should be a consent-based system choice that can be linked to AI connectors and shared across tools when allowed.

## Core idea

```text
identity profile
  -> connector binding
    -> available tools
      -> skills / specialist masks / prompt vault / templates
```

The Main Hub chooses or swaps the active AI connector.

The Specialist Command Center chooses which identity is linked to which connector, which tools may use that identity, and whether an identity is blocked.

## Why this matters

Without identity binding, different AI connections can mix roles, prompts, and memories by accident.

AXM needs identity routing so:

- an identity can stay with one AI connector
- an identity can be shared across all tools only with consent
- an identity can be blocked from all tools
- skills and specialist masks cannot silently borrow the wrong identity
- users can choose one identity for any AI connection when desired

## Main Hub responsibility

Main Hub settings handle connector choice.

Examples:

```text
active connector: Claude
active connector: ChatGPT
active connector: Hermes local
active connector: LM Studio local
active connector: OpenRouter
```

Main Hub answers:

```text
Which AI connection is being used?
```

## Command Center responsibility

Specialist Command Center handles identity binding.

It answers:

```text
Which identity is allowed to use which connector?
```

It also answers:

```text
Is this identity allowed in all tools?
Is this identity blocked from everything?
Is this identity only allowed for selected skills?
Is this identity only allowed for selected specialist masks?
Is this identity the default for any AI connector?
```

## Binding modes

### Connector-locked identity

The identity stays with one connector.

Example:

```text
identity: Mir repair mode
connector: Claude
scope: selected tools only
```

### Global identity

The identity is shared across all AI connections and tools when consent is ON.

Example:

```text
identity: AXM neutral helper
connector: any
scope: all tools
```

### Tool-limited identity

The identity can only be used by selected tools.

Example:

```text
identity: SFX intake reviewer
connector: any
scope: SFX intake only
```

### Skill-limited identity

The identity can only be used by selected skill wrappers.

Example:

```text
identity: GitHub packet helper
connector: ChatGPT
scope: PR packet skill only
```

### Blocked identity

The identity is disabled everywhere.

Example:

```text
identity: old experimental mask
connector: none
scope: blocked
```

Blocked means:

- no tool may load it
- no skill may use it
- no specialist mask may inherit it
- no package may auto-load it

## Consent rule

Identity sharing requires consent.

Consent should be visible before a run.

Example:

```text
This run will use:
identity: AXM neutral helper
connector: Hermes local
package: GitHub Review Helper
skills: summarize PR, create review packet
specialists: mergegate reviewer, code routing gate
```

The user can approve, change, or block it.

## Package interaction

A package profile may include a default identity.

When selected, the package can auto-load:

```text
identity
skills
specialist masks
prompt vault links
templates
wisdom profile links
run settings
```

But it must check the identity binding before use.

If the package identity is blocked or not allowed for the active connector, the run should stop and ask for another identity.

## Identity binding record

A binding record should include:

```text
identity_id
identity_name
binding_status
connector_mode
allowed_connectors
blocked_connectors
tool_scope
allowed_tools
blocked_tools
allowed_skills
blocked_skills
allowed_specialist_masks
blocked_specialist_masks
package_scope
consent_required
notes
```

## Safe defaults

Default should be conservative:

```text
identity sharing: off
connector: none until selected
scope: selected package/tool only
consent: required
```

## AXM rules

No hidden identity switch.

No connector may silently inherit an identity.

No skill may secretly use a blocked identity.

No specialist mask may override connector binding without consent.

Main Hub swaps connectors.

Command Center binds identities to connectors, tools, skills, specialist masks, and package profiles.
