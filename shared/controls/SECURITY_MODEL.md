# Security and authority model

- Local-first transport by default.
- One private token per active external seat.
- Token comparison uses constant-time byte comparison when lengths match.
- `human` and `adapter` are accepted through the same gate.
- `ai` is host-controlled and rejects external packets.
- Sequence numbers must increase; replayed or reordered packets are rejected.
- Input is an allowlist. Coordinates, hits, damage, inventory objects, money, scores, ownership, and mission completion are ignored.
- Vector magnitude is clamped to one.
- Pulse fields are rising-edge latched so a quick press is not lost between network and simulation ticks.
- Observations use explicit public projection and spatial filtering.
- A forbidden-key scrub removes common host-only fields as a final safety layer; it is not a replacement for deliberate public projection.
- Request-body limits, rate limits, TLS/public exposure, origin checks, and session lifecycle belong to the target host.

This kit is a reference boundary, not a public-internet authentication product.

