# Session summary

Status: `TEST`

v2.0 separates proposal from settlement. A proposal requires a pre-write exact match but does not advance the derived head. Settlement requires the original caller package and a later source recapture. Exact post-write match advances only the caller-owned settled head; observed extension or rollback is retained as a held settlement, leaving the previous head in force.

The suite demonstrates fresh-process pending recovery, a later exact candidate after a held extension, concurrent proposal contention, divergent independent roots, deletion reopening, tamper rejection, and corrupt-settlement fail closed behavior.

Three fixture-time failures remain in the sealed history: receiver-policy expiry, witness minute rollover, and anchor minute rollover. The corrections bounded synthetic times without changing production authority or classification behavior.

Final staged review removed internal proposal and settlement builders from the public exports because their truth fields describe successful exclusive writes. Settlement schema classifications were also closed to the six exact runtime outcomes.

The curation tool refused to overwrite the earlier derived seal after that append. The obsolete seal alone was explicitly removed and regenerated; the append-only segment was preserved.

All 36 commands passed with 2,523 focused assertions, including all ten AGENTS.md commands. No browser claim applies. No provider, real review, benefit, learning, promotion, merge, or CANON evidence was created.
