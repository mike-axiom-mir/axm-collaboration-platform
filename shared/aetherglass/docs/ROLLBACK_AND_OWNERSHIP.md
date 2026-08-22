# AXM Aetherglass 7.1 — Rollback and Ownership

## Core rule

Aetherglass restores only the changes it can still identify as its own. A complete old snapshot is not blindly written over a platform that may have changed after mount.

## Core classes, attributes, and inline styles

The engine records each class it adds and removes only those classes on destroy.

For attributes and inline styles it stores:
- original value before first engine change;
- last value applied by the engine.

The original value is restored only while the current value still equals the last engine-applied value. A later external platform value is preserved.

## Visual Adapter

The adapter records only classes it actually adds.
- A class present before adaptation remains.
- A class added later by the platform remains.
- Dynamically observed nodes use the same per-class record.

## Scene Director

The first scene application captures the pre-scene composition. `restore()` returns that state.

A temporary scene separately captures the immediately prior composition. It returns to that immediate state while preserving the outer scene-session snapshot. A deliberate later scene application cancels the pending return.

## Surface Composer

Each explicit target receives a record containing:
- whether the composer added its class;
- the original recipe attribute and last composer-applied recipe;
- original and last-applied values for each approved local CSS variable.

Changing recipes clears stale composer-owned variables only while they still equal the old applied value. External changes survive restore.

The `data-axm-awake` state has a separate ownership record. Restoring a material recipe does not erase a later externally changed wake state.

## Transition Director

Transitions own one pointer-safe stage. `cancel()` invalidates the current run and hides the stage. Queued requests can be explicitly cleared. Destroy removes the stage.

## Cue Sequencer

A cue run owns a finite timer list. `stop()` invalidates the active token, clears every timer, removes the choreography class, and resolves the waiting result as incomplete. Destroy performs the same cleanup.

## Performance Governor

Default recommendation mode changes nothing. When a recommendation is explicitly applied, the prior engine configuration is stored and can be restored.

## Luminous Layer Forge

The forge owns one stage, six persistent light planes, and finite radiance nodes. Its requested config is captured by Runtime Supervisor. `destroy()` removes the stage, timers, transients, listeners, and only the root attribute still matching the forge-owned value.

## Stable checkpoints

The outer v7.1 package keeps one byte-identical rollback:

    rollback/AXM_AETHERGLASS_VISUAL_ENGINE_v7_0_0_STABLE.zip

That complete v7.0 package contains the earlier v6 checkpoint and its nested history. This avoids duplicating the same checkpoints at the v7.1 outer level.

These restore module source. Keep a separate snapshot of the target platform before intake.

## Recommended rollback drill

1. Snapshot the target platform.
2. Mount v7.1 core only.
3. Add a platform class, attribute, and inline style after mount.
4. Destroy core and confirm later platform changes remain.
5. Apply and roll back the selector adapter; confirm unrelated classes remain.
6. Apply a base scene, then a temporary scene; confirm exact prior return and outer restore.
7. Apply one surface recipe, change it, alter one local variable externally, then restore; confirm the external value remains.
8. Start and cancel a transition; confirm its stage is inactive and pointer-safe.
9. Start and stop a cue; confirm its promise resolves and timer count is zero.
10. Mount Luminous Layer Forge, apply a custom stack, emit radiance, then destroy it; confirm every forge-owned node is gone.
11. Run the full cleanup order and confirm the unchanged platform still operates.

The packaged smoke test automates standalone ownership cases. Repeat them against the actual platform shell and lifecycle.
