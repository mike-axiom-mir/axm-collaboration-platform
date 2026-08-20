# Evidence routes

Status: `TEST`

| Claim | Evidence able to support it | Current result |
| --- | --- | --- |
| Every current capability chain has a concrete voluntary protocol | Exact current portfolio, native protocol verification, one-to-one route map, deterministic rebuild | `PASS` — 4/4 |
| Participant packets do not disclose answer keys or condition roles | Packet rebuild plus forbidden-field scan | `PASS` — 4/4 |
| A response cannot silently cross capability routes | Exact selected `protocolRef`, route-specific trial identities, adversarial mismatch test | `PASS` |
| Participation remains voluntary and withdrawal-safe | Native consent contract, non-voluntary refusal, withdrawal receipt with no participant reference or observations | `PASS` |
| Automated input cannot impersonate a voluntary interactive session | Local-TTY precondition tested through piped input | `PASS` refusal |
| Synthetic data cannot become LIVE human evidence | LIVE protocol fixture binding plus native session verifier | `PASS` refusal |
| The current Grounded human bridge can preserve candidate-cycle ancestry | Current bridge source plus the two exact cycles carrying `cycle.candidate.artifactRef` | `READY`, human evidence still `NOT_RUN` |
| The current Grounded human bridge can preserve `REUSE_EXISTING` ancestry | Current bridge source requires `cycle.candidate.artifactRef`; two exact cycles carry `cycle.gap.existingCapabilityRef` | `DEGRADED` / unresolved |
| A person benefited | Requires a voluntary LIVE session, native evaluation, explicit scoped human judgment, exact source trust and closure, then a Grounded bridge refresh | `NOT_RUN` |

Absence of session, evaluation, and judgment JSON in this lane proves only that
this increment did not record those artifacts. It is not a claim about all human
activity outside the Workshop.
