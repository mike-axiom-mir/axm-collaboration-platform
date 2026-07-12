# Bondfire — optional post-match learning gate

Bondfire is a reusable post-match pattern for games where reflection can help a human and AI cooperate more skillfully next time. It is **not** a mandatory Game Hub screen.

## Manifest declaration

Games opt in with a `post_match` object:

```json
{
  "post_match": {
    "bondfire": true,
    "mode": "default-for-this-game",
    "route": "/games/004/debrief",
    "auto_promote_wisdom": false
  }
}
```

Modes:

- `off`: no debrief.
- `optional-button`: useful for fast games where most players want immediate replay.
- `default-for-this-game`: the shared screen enters Bondfire after results; Relaybound uses this because learning the partnership is part of the game.

`auto_promote_wisdom` must remain `false`. A game may record evidence and ask identities for perspectives, but only an explicit human choice may save private or shared identity wisdom.

## Reference flow

1. Preserve objective match evidence separately from interpretation.
2. Let the human write a native perspective.
3. Ask the AI for an independent perspective from the same evidence.
4. Allow discussion and disagreement.
5. Edit one candidate nugget.
6. Choose: discard, next match only, private identity memory, or shared wisdom.

Relaybound slot 004 is the first reference implementation.
