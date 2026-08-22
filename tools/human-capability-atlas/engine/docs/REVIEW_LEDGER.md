# Correction and Dissent Ledger

The review ledger stores one JSON event per line. Each event includes the previous event hash and its own SHA-256 hash.

Supported event types:

- `correction_proposed`
- `dissent`
- `reviewed`
- `accepted`
- `rejected`
- `withdrawn`

The ledger detects later file modification. It does not prove that the actor name belongs to a real person, and it does not silently apply accepted wording to source declarations. Governance must decide how accepted overlays are materialized.
