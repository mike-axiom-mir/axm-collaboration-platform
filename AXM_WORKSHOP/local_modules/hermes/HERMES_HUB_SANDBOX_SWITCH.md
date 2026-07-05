# Hermes Hub Sandbox Switch

Status: TEST / foundation boundary switch.

Hermes can run inside AXM or outside AXM.

Default should be inside AXM.

## Core rule

```text
hub_sandbox = ON by default
```

This means the AXM Foundation and Hub are the default sandbox for Hermes runs.

Even if a user chooses freemode, the first freemode should still run inside the AXM sandbox unless the user explicitly chooses external mode.

## Why

Many future tools, profiles, templates, prompts, logs, identities, and specialist packages will already live inside the AXM Hub.

If AXM offers enough value inside the base, most users do not need to leave the base for normal work.

Defaulting to Hub sandbox keeps things useful and safer:

- shared settings work
- identity binding works
- package profiles work
- prompt vault links work
- template links work
- shell review can happen
- run reports can be created
- consent and limits stay visible

## Two run spaces

### Inside-system run

```text
AXM Hub / Foundation sandbox
  -> connector selected by Main Hub
  -> identity binding checked by Command Center
  -> package profile loaded if selected
  -> Hermes runtime available
  -> action requires consent
  -> review/report stays in AXM flow
```

Inside-system run is the default.

### Outside-system run

```text
external / free external mode
  -> user explicitly leaves the AXM sandbox
  -> fewer AXM protections may apply
  -> identity/package links may not apply
  -> shell review may be incomplete
```

Outside-system run should be explicit, not accidental.

## Freemode meaning

Freemode should not automatically mean outside-system.

Default freemode meaning:

```text
freer task behavior inside AXM sandbox
```

External freemode meaning:

```text
run outside AXM sandbox
```

Those should be separate switches.

## Switches

```text
runtime_available: checks/starts Hermes runtime
consent_for_action: allows selected action inside limits
hub_sandbox: keeps run inside AXM Foundation/Hub boundary
external_mode: explicitly leaves AXM Hub sandbox
```

Default:

```text
runtime_available: yes/check by default
consent_for_action: off by default
hub_sandbox: on by default
external_mode: off by default
```

## Launcher behavior

On launch:

```text
1. Check/start runtime.
2. Keep hub_sandbox ON.
3. Show active connector.
4. Show active identity binding.
5. Show selected package/profile.
6. Ask consent before action.
7. If user requests outside-system mode, show warning and require explicit choice.
```

## AXM rule

The Hub/Foundation is the default sandbox.

Runtime can be ready without action permission.

Freemode can exist inside the sandbox.

Outside-system mode is explicit, not default.
