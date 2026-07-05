# AXM Main Hub

Status: WORKING / TEST seed.

AXM Main Hub is the outer shell that opens first.

It can show different layers of the same local system.

The visible hub layer is what users see first.

The hidden workshop/build layer is for crew/system building and is reached by moving down into the hub layers.

## Core idea

```text
Main Hub
  -> visible layer opens first
  -> hidden lower workshop layer can be entered with a simple local password
  -> later more layers can be added
```

## Default starter layers

The default hub starts with two layers.

```text
Layer 0: visible-hub
  Seen first.
  Normal user/player/member entry.
  Can link to Game Hub, public tools, simple menu, and safe local modules.

Layer -1: workshop-build
  Not directly shown first.
  Crew/system build layer.
  Reached by moving down from the visible hub.
  Simple local password gate for now.
```

## Why two layers

This gives a simple start:

```text
1 visible layer for normal use
1 hidden lower layer for building/crew/system work
```

Later the hub can support more layers above or below.

## Layer direction

```text
above / current / visible
  what opens first

move down
  workshop/build layer

later move up
  extra public/community/game/event layers
```

## Password rule

The workshop layer may use a simple password for now.

This is only a local convenience gate.

It is not internet-grade security.

No real password should be committed to GitHub.

Local passwords belong in ignored local settings.

## Relationship to Game Hub

Game Hub can be launched from the visible layer.

Game Engine stays inside Game Hub.

Main Hub only decides which layer/menu is visible.

## Relationship to AI modules

AI tools, Agent Command Center, Hermes, and Game Hub remain separate modules.

Main Hub can link to them from the correct layer.

## AXM rule

Visible use first.

Build layer protected but not hidden as fake control.

No secret remote control.

No committed passwords.

Layering helps keep beginner use clean while crew/system building stays one move deeper.
