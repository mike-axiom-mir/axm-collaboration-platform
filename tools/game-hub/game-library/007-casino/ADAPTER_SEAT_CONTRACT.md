# Casino Alpha adapter seat contract

`EXPERIMENTAL · SOFTWARE-VERIFIED LOCAL INTERFACE · NOT CANON`

Casino Alpha accepts an external collaborator only when Game Hub explicitly
assigns a seat with `type: "adapter"`. A missing human is never replaced by an
adapter, and an adapter receives no host or party-display authority.

All balances in this alpha are simulated local credits. There is no purchase,
deposit, cash-out, payment-provider, or outside-network path.

## Binding and transport

The loopback-only host bootstrap publishes `launch.adapterBindings`. Each
binding contains an in-memory seat token, session ID, seat ID, controller type,
and the two dedicated endpoints. Tokens are generated per session, are not
written into persistent casino state, and are absent from public and adapter
observations.

Read the standard observation at:

```text
GET /api/adapter/state?session=<session-id>&seat=<seat-id>
X-AXM-Seat-Token: <ephemeral-token>
```

Send `axm-semantic-input-v1` intentions to:

```json
{
  "sessionId": "session-id",
  "seatId": "seat_2",
  "sequence": 1,
  "requestId": "adapter-seat_2-1",
  "intent": {"type": "spin", "wager": 1}
}
```

The token is supplied in `X-AXM-Seat-Token` or the JSON envelope. Human
controller commands and adapter intentions both enter
`casino-alpha-seat-authority-v1`, pass the same strict sanitizer, and then call
the same exactly-once `CasinoSession.command` gate. The sanitizer accepts only
travel, machine selection, wager selection, spin, fund-house, and
withdraw-house intentions with bounded fields. Unknown fields and client-made
wallet, house, jackpot, payout, draw, free-spin, or result values are rejected.

The adapter may choose ordinary game actions, including spending its own
simulated credits. It cannot select or change an outcome: the server-owned AXM
Draw Spine chooses the next neutral ticket, immutable style books settle it,
and the authoritative ledger applies the receipt. Duplicate request IDs replay
one cached receipt instead of consuming another draw; stale sequences fail.

## Observation boundary

`axm-seat-screen-semantics-v1` with profile
`axm.casino-alpha-adapter-observation/v1` contains the assigned seat view,
party-visible balances, public opponents, visible cabinet and contest state,
filtered events, settled receipts, and the next accepted sequence. It excludes
all tokens, host diagnostics, session seed, draw permutations, future rows,
random state, request caches, and rate ledgers. Rival private balances remain
filtered by the existing `observePlayer` authority.

## Evidence route

| Claim | Kind / risk | Pass condition and native proof | Counterevidence |
| --- | --- | --- | --- |
| Adapter identity is explicit | Static + deterministic / medium | Manifest, normalized roster, core test, and live state all preserve `controllerType: adapter` | A missing human becomes an adapter or an adapter becomes `human`/`ai` |
| Binding enforces the assigned seat and session | Authorization / high | Live correct token succeeds; wrong token, wrong session, and valid human token on adapter routes fail | Any denied identity reads or mutates the adapter seat |
| Human and adapter share one semantic gate | Deterministic behavior / medium | Live human and adapter commands return the same gate, protocol, and sanitized intent | Separate mutation paths or unequal validation |
| Observation is bounded | Authorization + structure / high | Parsed live payload contains playable seat semantics while forbidden secret/future-state keys are absent; existing core filter test independently hides rival money | Token, seed, future row, request ledger, host diagnostics, or rival private balance appears |
| Outcomes remain server-owned and exactly once | Deterministic behavior / high | Existing draw-spine/core suites plus live duplicate-spin proof show one request consumes one authoritative draw | Client outcome fields alter settlement or a duplicate consumes another draw |
| No real-money authority is created | Static + transport / high | Package and live routes expose only local simulated credits and no purchase/cash-out/network integration | Any payment, deposit, withdrawal-to-real-value, or external-money route exists |

## Honest limits

This is a seat capability contract, not hostile-process isolation or internet
security. The alpha may bind to the local LAN, has no TLS, and still includes
human controller tokens in compatibility URLs returned to the trusted host.
Anyone who obtains a live token can act as that seat until the session ends.
Physical-phone QA, disconnect recovery, adversarial LAN testing, and human
acceptance remain separate evidence gates.
