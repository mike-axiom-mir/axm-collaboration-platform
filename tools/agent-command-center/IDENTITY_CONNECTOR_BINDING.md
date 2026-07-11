# Identity Connector Binding

Status: TEST / public routing rule.

Identity should not be trapped inside one tool.

Identity is a consent-based system choice that can be linked to AI connectors and shared across tools when allowed.

## Core idea

```text
identity profile
  -> connector binding
    -> allowed tools / skills / specialist masks / packages
```

The Main Hub chooses or swaps the active AI connector.

The Agent Command Center chooses which identity is linked to which connector, which tools may use that identity, and whether an identity is blocked.

## Why this matters

Without identity binding, different AI connections can mix roles, prompts, and task profiles by accident.

AXM needs identity routing so:

- an identity can stay with one AI connector
- an identity can be shared across all tools only with consent
- an identity can be blocked from all tools
- skills and specialist masks cannot silently borrow the wrong identity
- users can choose one identity for any AI connection when desired

## Binding modes

### Connector-locked identity

The identity stays with one connector.

```text
identity: Mir repair mode
connector: Claude
scope: selected tools only
```

### Global identity

The identity is shared across all AI connections and tools when consent is ON.

```text
identity: AXM neutral helper
connector: any
scope: all tools
```

### Tool-limited identity

The identity can only be used by selected tools.

```text
identity: SFX intake reviewer
connector: any
scope: SFX intake only
```

### Skill-limited identity

The identity can only be used by selected skills.

```text
identity: GitHub packet helper
connector: ChatGPT
scope: PR packet skill only
```

### Blocked identity

The identity is disabled everywhere.

```text
identity: old experimental profile
connector: none
scope: blocked
```

Blocked means:

- no tool may load it
- no skill may use it
- no specialist mask may inherit it
- no package may auto-load it

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

Agent Command Center binds identities to connectors, tools, skills, specialist masks, and package profiles.
