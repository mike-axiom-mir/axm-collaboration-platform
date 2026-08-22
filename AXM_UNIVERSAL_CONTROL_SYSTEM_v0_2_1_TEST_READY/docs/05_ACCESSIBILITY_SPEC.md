# 5. Accessibility specification

Accessibility is part of the input architecture, not a later visual layer.

## Implemented infrastructure

- remapping for compatible semantic actions;
- required-action coverage checks;
- resizable and repositionable controls;
- simplified profile layouts;
- left-handed layout;
- explicit one-handed left/right layouts;
- visible single-stick MOVE/AIM role switch;
- adjustable dead zones and slower/faster sensitivity;
- 4-way and 8-way direction snapping;
- high contrast and color-independent text/state labels;
- reduced motion;
- vibration enabled/disabled;
- deterministic tap, double-tap, hold, toggle, and repeat behavior engine;
- adjustable timing values available to game/accessibility policy code;
- digital alternatives declared in the action registry;
- per-game overrides without deleting global or device preferences.

## Still to prove or build

- a user-facing editor for every behavior timing policy;
- adjustable vibration strength on browsers/devices that expose it;
- switch-access adapter;
- screen-reader-first controller mode;
- real one-handed play studies across multiple game types;
- physical accessibility-device adapters;
- game-specific aim assistance with measured, visible behavior;
- repeated-action assistance reviewed in live games to prevent unwanted automation.

A game profile must declare required actions and provide at least one phone control path for each required action before it can claim phone support.
