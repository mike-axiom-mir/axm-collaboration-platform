# Evidence routes

Status: `TEST`

| Claim | Native verifier | Preserved counterevidence |
|---|---|---|
| Proposal requires exact pre-write candidate match | v2.0 accepted proposal plus pre-write extension and rollback refusals before namespace creation | Capture and proposal write are not atomic |
| Proposal does not advance settled head | pending snapshot and fresh-process pending reload | Pending proposal exists after a crash until separately settled |
| Exact post-write match advances local settled head | exact settlement and fresh-process exact rebuild | Source may change after capture; confirmations are not authorization |
| Observed post-write extension or rollback is held | extension and rollback settlement classifications plus unchanged head | Two observations cannot exclude transient/reverted changes |
| A later exact candidate can recover after a held proposal | held extension followed by proposal from unchanged head to later current chain | Only one caller-owned root is serialized |
| Local state is internally coherent | canonical reload, chronology, proposal chain, settlement binding, contention, corruption fail closed | Independent roots settle divergent forks; deletion reopens sequence one |
| Repository compatibility | `CHECK_RESULTS.json` focused lineage and all AGENTS.md commands | No browser claim: module has no visual surface |

No route proves an atomic cross-store transaction, later currentness, global uniqueness, external retention, protected monotonicity, rollback prevention, authenticated authority or identity, independent controllers, trusted time, provider execution, real review, benefit, learning, adoption, promotion, merge, or `CANON`.
