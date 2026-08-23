# Four Roots Adventure

Status: `TEST`

This is the first installed Workshop adventure grown from the proven
`four-roots-run-native` v0.1 candidate. Mike explicitly directed its internal
promotion and further bounded growth. The exact v0.1 packet remains the
rollback ancestor; the new v0.2 content is an immutable deterministic release.

The game is a complete small narrative vertical: five connected zones, four
keepers, ten discoveries, six quests, a field inventory, an authored ending,
and server-owned progress that resumes after browser reload and server restart.

Run through Game Hub or locally:

```powershell
node runtime/server.js
```

Then open `http://127.0.0.1:8820/games/020/`.

The v0.2.1 package also exposes a deterministic 30-second silent and captioned
trailer at `http://127.0.0.1:8820/games/020/trailer/`. It is rendered locally
from the exact game content and manifest through the Workshop's bounded native
video codec. It uses no AI key or internet and public distribution remains
`HOLD`.

The runtime is dependency-free and local-only. It reads its versioned content,
serves the reviewed UI, accepts only move/interact/reset actions, and writes one
content-bound save beneath the host-selected game-data root. It has no outbound
network feature and cannot modify Foundation, install, publish, promote, or
change CANON.
