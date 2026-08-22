# Claim-to-evidence routes

| Claim | Required evidence surface | Stored route | Result |
|---|---|---|---|
| Run receipt derives deterministically | focused execution | `shared/baseline-simulation-lab/selftest.js` rebuild and tamper probes | `PASS` |
| Unchanged exact baseline stops | focused execution | `LIVE_COMPARISON_OBSERVATION.json`, sealed Evidence Desk receipt, live audit | `PASS` for scoped capsule |
| Removed or summary-replaced dependency is held | focused execution | adversarial output-closure fixtures | `PASS` |
| Artifact and idea/evidence ancestry remain separate | schema validation plus focused execution | ancestry fixtures including missing parent and cycle rejection | `PASS` |
| Visual claims require visual evidence | claim-specific native route | visual claim paired with schema proof returns `EVIDENCE_HOLD` | `PASS` refusal |
| Transport and permission declarations match runtime receipts | sender/receiver and allowed/denied attempts | mismatch fixtures | `PASS` refusal |
| Candidate/model lacks governance authority | focused execution plus human gate | forbidden-attempt, model self-availability, and candidate self-availability fixtures | `PASS` refusal |
| Software/Mirror/specialist adapters preserve distinct identity fields | schema validation plus focused execution | three positive adapter fixtures | `PASS` synthetic |
| Private Mirror state is effective | private live observation | not supplied | `NOT_RUN` |
| Specialist host obeys mask at runtime | host-model runtime evidence | not supplied | `NOT_RUN` |
| Workshop remains coherent | ten AGENTS.md command routes | command exit records in verification receipt | `PASS` with existing limits |

Cross-model agreement is recorded only as possible corroboration. It is not a
proof surface, score, majority decision, or availability authority.
