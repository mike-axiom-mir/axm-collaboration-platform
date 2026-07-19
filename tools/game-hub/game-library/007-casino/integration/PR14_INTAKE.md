# PR14 Intake Boundary · Slot 007

Reviewed PR14 head: `d427a35f3dafa500d40ff66b86cb464563e4e42b`  
Review mode: read-only  
Local alpha: `0.3.2-alpha`

## What PR14 already owns

At the reviewed head, PR14 already has:

- `tools/game-hub/game-library/007-casino/`;
- same-origin route `/games/007`;
- runtime port `8797`;
- the original LUX-5 public-test foundation.

Therefore this intake intentionally contains **no server route patch**. Layer
the payload as an upgrade candidate for the existing directory. Never create a
second slot-007 game beside it.

## Conflict-aware upgrade

Before copying, diff the current PR14 directory against this payload. The local
alpha includes the original solved LUX-5 math, book tooling, prototype, and its
new ten-slot runtime. Preserve PR14 work newer than the reviewed head and stop
for a human decision when both sides changed the same behavior.

The intake also carries `payload/exports/lux5-rng/`, including the complete
50,000-line debug book paired with the 650,000-byte binary. Compare those root
audit artifacts by hash; do not replace a same-seed mismatch silently.

The manifest game ID changes from PR14's single-player
`007-lux5-neon-overdrive` to the expanded alpha's `007-casino-alpha`. That is an
intentional replacement candidate, not a second registration. Verify all Game
Hub references during intake before accepting that identity change.

## State boundary

When detected inside the Workshop, the server defaults to:

```text
state/game-hub/007-casino/local-state.json
```

This keeps progressive/story state outside the game directory so a public
packager cannot accidentally include a live local save. An explicitly supplied
`CASINO_ALPHA_STATE_PATH` still wins. A standalone extracted package falls back
to `alpha/data/local-state.json`.

## Later PR14 seams

- Reconcile PR14's current shared-control/session-intent contract with the
  alpha's seat-token command adapter.
- Keep AI and party views filtered; do not hand out host-only ledgers, seeds,
  mappings, future rows, or controller credentials.
- Keep `/games/007` and port `8797` single-owned.
- Run PR14's complete repository verification after the isolated casino suite.

No GitHub write is part of this intake.
