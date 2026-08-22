# BuddyFarm two-lane input contract

Schema direction: `axm-buddyfarm-two-lane/v1`.

Humans, phone seats, adapter seats and AI helpers submit the same named intents.
The server resolves the target; clients never claim that an action succeeded.

## Universal gamepad adapter

The host uses `axm-universal-xbox-brawl-v0.2.1` and accepts only browser pads
whose mapping is exactly `standard`. Pad index 0, 1 and 2 bind to the first,
second and third ordered human seats; gaps do not shift ownership and AI seats
are never assigned. Left stick/D-pad submit movement, A or right trigger owns
Action, X owns Work, View toggles the full map and Menu toggles the controls
guide. Unsupported, unassigned and disconnected states stay visible while
keyboard and phone input remain available.

The query-only simulated-pad harness is labeled logic/browser QA and cannot be
used as evidence for physical Bluetooth/USB behavior or control feel.

## Lane 1 · Action

One button, strict target precedence:

1. NPC/dialogue/story object when one is directly targeted.
2. Travel portal when the same button carries at least 200 ms hold evidence.
3. Fishing when a valid water target and equipped fishing capability exist.
4. Combat when a valid hostile target and equipped combat capability exist.
5. Otherwise a visible no-op.

An interactable masks combat. A gatherable does not convert Work into combat.
Travel cannot occur from a tap. The safe slice currently installs steps 1–2;
fishing and combat remain named extension seams, not claimed capabilities.

## Lane 2 · Work

One context-aware field-kit button:

1. Harvest a ripe crop.
2. Water a dry planted crop.
3. Plant prepared empty soil.
4. Prepare raw ground inside an unlocked plot.
5. Later: gather/cut/mine only when the target declares that work capability.
6. Otherwise a visible no-op.

Players do not swap a pickaxe, axe, hoe and watering can for routine chores.
The equipped field kit owns capability and level; later upgrades change reach,
efficiency, quality or special effects without changing the two-lane controls.

## Travel proof

Door, stairs, exit and future fast-travel transitions require 200 ms of
continuous Action hold on keyboard, gamepad or phone, with at least 200 ms
declared hold evidence at the authoritative server. A normal tap can still
talk or inspect. Door and stair target cells are blocking interaction surfaces:
movement turns a buddy toward them without stepping through the visible art.
