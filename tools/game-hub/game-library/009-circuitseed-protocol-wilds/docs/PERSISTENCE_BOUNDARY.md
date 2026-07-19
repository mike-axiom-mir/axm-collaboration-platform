# Persistence boundary

Circuitseed keeps three local stores:

1. `axm.circuitseed-router-profile/v1` — participant-owned roster, history, inventory, currency, discoveries, achievements, recipes, relationships, business, permissions, engine-change declarations and safe checkpoint.
2. `axm.circuitseed-world-save/v1` — host-owned story, settlement, routes, NPC consequences, demand, seed, conditions, instability, events and physical shops.
3. `axm.circuitseed-session-ledger/v1` — append-only participants, versions, rewards, transactions, mission outcomes, changes, disconnects, acknowledgements and SHA-256 chain.

Meaningful events use atomic JSON replacement with a prior backup. World saves also retain snapshots. Profile imports never silently replace a divergent identity; the incoming copy is preserved under `profiles/recovery/` and a conflict report is returned.

Mission envelopes commit participant rewards and host-world consequences separately. Stable receipt keys make retries dedupe-safe.
