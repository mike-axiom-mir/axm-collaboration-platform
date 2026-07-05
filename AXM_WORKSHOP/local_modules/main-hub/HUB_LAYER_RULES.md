# Main Hub Layer Rules

Status: WORKING / TEST seed.

The Main Hub is mainly a router.

It should keep useful tools reachable without turning the first screen into noise.

The layer system exists so value can be present without overwhelming the user.

## Starter model

```text
Layer 0: visible-hub
  Seen first.
  Clean local hub/menu.
  Shows only what normal users or players need first.

Layer -1: workshop-build
  Not seen first.
  Crew/build/system layer.
  Enter by moving down.
  Simple local password gate for now.
```

## Router rule

The Main Hub should route to modules.

It should not become a dumping ground for every tool button.

```text
Good:
  Hub -> Game Hub
  Hub -> Workshop Build Layer
  Hub -> selected public/local tools

Bad:
  Hub first screen contains every internal tool, setting, adapter, test panel, and build file
```

## Noise-control rule

A tool can be valuable and still not belong on the first visible layer.

Default rule:

```text
First layer = simple, useful, low-noise
Lower layer = build tools, crew tools, settings, tests, adapters
Later layers = optional routing layers when needed
```

## Layer movement

```text
open hub
  -> visible-hub

move down
  -> workshop-build

later optional:
move up / side
  -> public/community/game/event layers
```

## Password rule

The workshop layer can use a simple local password gate for now.

This is local convenience, not internet-grade security.

Do not commit real passwords.

Real local passwords belong in ignored local settings or environment variables.

## AXM rule

Make value reachable.

Do not make value noisy.

Route first, clutter never.

Visible first layer should help beginners.

Deeper layers can hold crew/system power.
