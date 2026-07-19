# AI-native seat integration status

The supplied game exposes `window.AXMLivingWorld.aiPlayerSeat` with bounded observation, sequenced allowlisted intents and receipts. See `../runtime/game/AI_PLAYER_SEAT_API.md` for the source contract.

Current Game Hub integration status: **pending transport**.

- The local in-browser API is present.
- It does not grant strategic time, dilemma, proposal, save, tool, file or governance authority.
- The managed Game Hub wrapper does not yet connect an external AXM adapter seat to the browser API.
- Do not label an AI Game Hub seat connected until sender and receiver receipts prove that bridge.
