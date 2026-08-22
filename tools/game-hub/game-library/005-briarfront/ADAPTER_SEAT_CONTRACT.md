# Briarfront external collaborator seat

`EXPERIMENTAL · SOFTWARE-VERIFIED LOCAL INTERFACE · NOT CANON`

Briarfront preserves three distinct seat meanings:

- `human`: a phone controller using the legacy `/input` route;
- `adapter`: an explicitly assigned external collaborator using a secret, process-local capability;
- `ai`: Briarfront's built-in server bot.

Human and adapter packets enter `briarfront-seat-authority-v1`, share the same intent sanitizer, and can express only movement, look, fire, special-fire and mob-purchase intentions. The server remains authoritative for position, arrows, damage, health jars, wood, purchases and outcomes.

The Game Hub reads adapter capabilities from loopback-only `GET /api/host/bootstrap`. An adapter uses:

- `GET /api/adapter-observation?room=AXM1&seat=<seat-id>` with `x-axm-seat-token`;
- `POST /api/input` with `roomCode`, `seatId`, `token`, increasing `sequence`, and an `intent` object.

Observations use `axm-seat-screen-semantics-v1` and contain only the assigned controller HUD plus the same public arena facts rendered by Briarfront's shared top-down party screen. They exclude tokens, input buffers, bot random state and client-authored outcome shortcuts.

The capability exists only for the running process and is never written to disk. Disconnect/reconnect behavior and physical-phone delivery remain separately pending.
