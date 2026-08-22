# AI-native seat integration status

The supplied game exposes `window.AXMLivingWorld.aiPlayerSeat` with bounded observation, sequenced allowlisted intents and receipts. See `../runtime/game/AI_PLAYER_SEAT_API.md` for the source contract.

Current Game Hub integration status: **not exposed as a Game Hub seat**.

- The local in-browser API is present.
- It does not grant strategic time, dilemma, proposal, save, tool, file or governance authority.
- The managed Game Hub wrapper does not yet connect an external AXM adapter seat to the browser API.
- The package manifest advertises one human seat; the same-browser AI screen is not counted as a second Hub player.
- A future manifest may add `adapter` only after authenticated transport, shared semantic input, sender and receiver receipts, and live bridge evidence exist.
