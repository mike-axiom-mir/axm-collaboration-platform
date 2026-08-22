# Session summary

Status: `TEST`

v2.1 adds a read-only portable full-history checkpoint above the v2.0 two-phase settlement ledger. Checkpoint creation exact-verifies every persisted proposal and settlement from caller packages and requires equal ledger snapshots before and after verification. A later audit classifies exact match, forward extension, strict rollback, replacement or fork, identity drift, absence, or ledger-or-configuration invalidity relative to the checkpoint supplied by the caller.

The focused suite proves pending-then-settled forward extension, an older valid prefix as strict relative rollback, another valid same-identity chain as replacement or fork, separate identity/absence/invalidity outcomes, fresh-process reconstruction, and byte-for-byte read-only behavior. An adversarial test inserts a real pending proposal between the bracketing reads and is refused.

Staged review found two truth-surface gaps. The first audit validator did not independently reject impossible classification/current-presence combinations, so count, presence, prefix, exact, forward, and rollback invariants were added. A later review found that service-construction and reload failures were both being folded into “ledger invalid.” Unconstructable configurations now produce no receipt, while later reload failures use the explicitly ambiguous ledger-or-configuration-invalid classification.

The decisive counterexample remains: jointly replacing the caller-presented checkpoint and ledger root produces another internally exact relative chain. The module therefore proves no authenticated pin, retention, protected monotonicity, rollback prevention, atomic snapshot, global consistency, provider execution, human benefit, learning, promotion, merge, or CANON.

The first staging attempt exposed a Windows Git index filename-length failure. Only the module directory and three filenames were shortened; contract and capability identities were preserved, and source plus verification evidence was regenerated against the reviewable paths.

All 37 recorded commands passed with 2,627 focused assertions, including all ten AGENTS.md commands. No browser claim applies because the module has no visual surface.
