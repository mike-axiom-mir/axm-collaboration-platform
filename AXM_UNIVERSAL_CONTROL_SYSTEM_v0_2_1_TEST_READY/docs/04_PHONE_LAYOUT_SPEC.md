# 4. Phone control layout specification

## Profile-driven layouts

The phone UI reads the active game's `phoneLayout.controls` declaration. A game may choose which sticks and buttons are visible, which semantic actions they emit, and what labels are shown. Unused controls are hidden and stop emitting input.

## Modes

### Simple

- one movement stick;
- primary and optional secondary action;
- pause/menu;
- large targets;
- hidden unused controls.

### Standard

- twin sticks where required;
- familiar A/B/X/Y interaction logic with original AXM visuals;
- menu;
- contextual labels;
- optional additional actions.

### Advanced

- full controller-equivalent action set where the game needs it;
- D-pad, bumpers, and triggers through profile controls;
- custom positioning and calibration;
- per-action labels;
- game-specific panels.

## Implemented in v0.2

- floating or fixed twin sticks;
- game-profile-driven visibility, labels, and bindings;
- compatible stick/button remapping;
- required-action coverage warning;
- stick and button sizing;
- opacity, sensitivity, dead zone, and 4-way/8-way snapping;
- left-handed layout;
- explicit one-handed left or right layout;
- visible one-handed stick-role switch between MOVE and AIM;
- high contrast and reduced motion;
- vibration on/off;
- draggable layout editing;
- global, device, and game persistence;
- automatic neutralization on blur, hidden page, disconnect, and stale timeout;
- portrait and landscape behavior.

## Safety and clarity rules

- Context or stick-role changes must be visible; no silent meaning changes.
- Required controls must remain reachable after orientation changes.
- Controls must avoid browser navigation and safe-area insets.
- Labels and state indicators cannot depend on color alone.
- Edit mode must be explicit so normal play cannot drag controls accidentally.
- Hidden controls must emit neutral state before disappearing.
- Pointer release, cancellation, lost capture, page hide, and adapter stop must neutralize input.
- A remap that removes the final path to a required action must produce a visible warning and fail profile acceptance.
