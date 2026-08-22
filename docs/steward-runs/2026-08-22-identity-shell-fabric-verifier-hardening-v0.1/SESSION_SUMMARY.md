# Independent-verifier hardening summary

Status: `TEST` over `EXPERIMENTAL` artifacts

Further testing found a real verifier gap. The independent verifier correctly checked the top manifest digest, but an attacker able to alter a manifest and recompute that digest could also alter some nested semantics without rejection. Three representative false passes were reproduced: unsafe portability, an `EMPTY` continuity state containing accepted history, and a numeric-string resource value.

The verifier was strengthened without importing the compiler. It now independently validates identity-root structure and disclosures, human ownership gates, provider-neutral component binding, wrapper/descriptor roles, descriptor authority, exact non-coerced resources, network and actuation ceilings, continuity-state consistency, lineage and lifecycle coupling, portability, privacy, and every inert truth flag. Malformed values return `FAIL` rather than throwing.

The core suite increased from 62 to 87 assertions. Valid compiler manifests for origin, fork, migration, reconstruction, succession proposal, and retirement proposal pass the verifier. Seventeen maliciously re-digested semantic variants fail, including parent, continuity, and human-decision reference-schema substitution, and five malformed input shapes fail closed.

The Keel trial now covers four scenarios: deterministic origin rebuild, distinct fork, candidate-memory acceptance, and disclosed neural migration. The migration trial found that the alternate inert descriptor requests more compute, memory, time, and energy than the origin requested totals. The test now explicitly raises those requested totals within the unchanged permitted ceiling before testing the required adapter and model-or-connector disclosures.

A fresh verifier process imports no compiler. Twenty fresh compiler processes produced the same manifest digest with zero failures; twenty fresh verifier processes accepted the committed manifest and rejected their adversaries with zero failures. The Keel manifest itself did not change: `sha256:575f667d86b5b81784579f080a07c6e6c581545233f2e9c013fa464e78e85307`.

One combined broad-check attempt stalled silently for more than 90 seconds. It was interrupted and excluded from pass evidence. Its `verify.js` child later ended. An isolated `verify.js` rerun exited zero in approximately 17 seconds with 41 existing Workshop warnings, and the remaining nine required checks exited zero. `verify-plus` reported `VERIFIED_WITH_LIMITS`.

All required hardening capabilities are `READY`. The route remains `DEGRADED` because live host binding, authenticated human acceptance, and restart-bound runtime continuity remain unavailable optional gates. No UI, model, connector, live memory, runtime, robot, registry, Hub, Foundation, installation, promotion, or `CANON` surface was added.
