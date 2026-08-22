# 14. Configuration and persistence

Settings use independent scopes:

```json
{
  "version": "0.2.0",
  "global": {},
  "devices": { "device-id": {} },
  "games": { "game-id": {} }
}
```

Effective settings merge in this order:

```text
global → device-specific → game-specific
```

A reset may target global preferences, one device, one game, or everything. Resetting a game does not erase device identity or unrelated accessibility preferences.

## Compatibility decision

The storage key remains:

```text
axm.controls.settings.v0.1
```

This is intentional. `SettingsStore` reads the previous layout, migrates it to v0.2, preserves known values, clamps unsafe values, and fills new defaults. Changing the key would silently make previous user layouts appear lost.

## Stored v0.2 preferences

- layout mode and orientation;
- left-handed and explicit one-handed side;
- stick/button scale, opacity, sensitivity, and dead zone;
- snapping, contrast, reduced motion, and vibration;
- draggable control positions;
- per-game phone binding overrides;
- calibration and future accessibility fields permitted by the schema.

Controller `deviceId` and private resume token are stored separately. A game reset therefore cannot silently turn the phone into another controller.

## Import/export

The store supports explicit JSON export/import. Import is validated and migrated before replacing active settings. Production UI should always show the user what scope will be replaced before importing or resetting.
