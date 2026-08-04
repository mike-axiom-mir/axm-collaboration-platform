# Starspite evidence route - atomic claims

| Claim | Status | Evidence that can prove it | Boundary |
|---|---|---|---|
| RNG v2 mixes every seed word before the first value | PASS | `tests/rng.test.mjs`, `runtime/rng.js` | Source/tests do not certify browser or OS entropy quality |
| Legacy v1 item receipts still replay | PASS | deterministic legacy sequence and receipt replay tests | Applies to declared v1 receipt algorithm |
| Ticket roll remains independent and exactly 1 in 1,000,000 | PASS | boundary tests, deterministic v2 winning seed, `runtime/rng.js` | Does not imply a ticket within any finite play session |
| Redeeming an authentic ticket opens persistent Starspite membership | PASS | systems/migration tests plus visible import, board, travel, reload journey | Alternate admission routes are not implemented |
| All three casino games disclose their rule, RTP, and edge | PASS | data invariants, package self-test, desktop/mobile tables frames | Long-term player-behavior balance remains unproven |
| Casino outcomes use fresh fixed-math receipts without adaptive luck or pity | PASS for this implementation | systems tests, live wager receipt, source inspection | No claim about future modified builds |
| Item insurance cannot change a wager outcome | PASS | outcome-equivalence test, systems source, live loss receipt | Insurance can change net loss and item durability by design |
| Starspite market lots are authored rather than fake random reskins | PASS | authored-lot data and receipt tests, live purchase receipt | Three lots are a bounded catalog |
| Vesper's probability crime is one-time and can produce a valid full-signature item reaction | PASS | systems tests and live first/second activation journey | Broader consequence graph is not built |
| Version-one saves migrate without losing the original life-sim state | PASS | migration regression plus live old-save continue/import | Cloud and cross-device continuity are absent |
| Desktop and 390x844 Starspite states are usable | PASS | eight selected frames, DOM bounds, scrollTop measurement | Sampled states do not prove every combination |
| Casino panel opens at its own top after switching panels | PASS after observed failure | JSONL FAIL→repair→PASS sequence; final desktop/mobile table frames | Other future panels require their own regression checks |
| Animation is continuously smooth | UNKNOWN | Requires rolling-frame capture and timing analysis | Only repeated sampled screenshots were available |
| This completes the casino ship, planet, or best-game claim | OPEN / NOT CLAIMED | Requires much broader product and independent evidence | This is the first Starspite deck milestone |

Canonical narrative: `../MILESTONE_02_STARSPITE.md`. Chronology: `session-starspite.jsonl`. Structural seal: `session-starspite-final.sealed.json`. Visual index: `starspite-visual-verification.json`.
