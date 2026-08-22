# 3. Migration strategy

## Stage 0 — freeze and inspect

- Keep the working files unchanged.
- Record the exact current launch route and rollback files.
- Run the old controls once before any patch.
- Save observed behavior and known bugs.

## Stage 1 — compatibility boundary

- Add the semantic bridge beside the old route.
- Keep `/input` active.
- Add `/axm/input`.
- Map `MOVE.x` and `PRIMARY_ACTION` into the current Robo Pong fields.
- Test in an extracted copy or branch.

## Stage 2 — migrate one phone client

- Use the semantic controller page.
- Verify left, right, center release, power edge, blur release, and reconnect.
- Do not change physics or visuals during this phase.

## Stage 3 — migrate host-side keyboard/gamepad

- Route keyboard and gamepad through the same semantic action bus.
- Remove device-specific key checks from game behavior.
- Preserve the old keyboard route until comparison passes.

## Stage 4 — prove a second game

Choose a meaningfully different game, preferably a top-down or twin-stick action game. Reuse the same modules and write only a new profile plus game bindings.

## Stage 5 — expand categories

Required live proof categories:

- top-down movement;
- twin-stick action;
- platformer;
- vehicle;
- menu-heavy simulation;
- turn-based;
- local co-op;
- multiple phone controllers.

The v0.2 package contains validated profiles and automated schema/control-path coverage for all eight categories, but that is not the same as eight live game migrations.

## Rollback

Rollback is always:

1. stop the test server;
2. start the untouched original;
3. use the original phone URL;
4. retain measurements and failure notes;
5. repair the bridge, not the working original.
