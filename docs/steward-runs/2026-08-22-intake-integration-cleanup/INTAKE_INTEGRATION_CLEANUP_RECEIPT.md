# Workshop intake integration and cleanup receipt

Status: **TEST**

This is an append-only steward receipt for the bounded 2026-08-22 Workshop intake recovery. It records preservation, classification, admitted source locations, and verification. It does not promote or mark any material CANON.

## Source installation checkpoint

- Branch: `codex/workshop-recovery-fabric-integration-20260822`
- Installation commit: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`
- Intake roots classified: 21
- Intake files before movement: 41,258
- Intake bytes before movement: 1,441,627,208
- Tracked intake carrier paths cleared after installation: 1,078
- Landing-zone entries after movement: 0
- Other-builder lane kept out of this work: 12 paths under `worlds/foundation-planet/`

## Admitted or already-integrated material

New reviewed source locations installed in the checkpoint commit:

- Accessibility source catalog: `shared/accessibility-adaptation/source-catalog-v1`
- AI team source intake: `shared/ai-team-steward/source-intake-v1`
- Verification source catalog: `shared/verification-proof/source-catalog-v1`
- Universal Object Fabric source stage: `shared/universal-object-fabric/source-stage-v0.7`
- Audio, cartoon, and simulation evidence registries: `shared/game-organism/source-evidence`
- Academy continuity/sensory TEST candidates: `shared/academy-continuity-sensory/test-candidates/v0.1`
- Sensory TEST candidates: `shared/sensorium/test-candidates/run101`
- LEGO City TEST blueprint: `shared/platform-buildmaps/lego-city/v0.1`

Existing targets were verified for the adapter translation, memory continuity, repair resilience, living globe, three-module platform integration, public-proof handoff, and visual-mirror tool carriers. Their raw carriers were preserved rather than duplicated into new live targets.

## Held material

- PS3 graphics material remains held because the intake lacks the required rights declaration and names a legacy supplied runtime boundary.
- Both public-proof quarantine trees remain held and preserved.
- The run-40 contradictory receipts remain preserved; contradiction was not averaged away.
- The raw visual-mirror clone remains EXPERIMENTAL. It and supplied runtimes were not executed.

## Recovery archive

All 21 exact intake roots were moved on the same volume into the dated external recovery archive `2026-08-22-cleared-for-2026-08-23`. No intake carrier was deleted.

- Archive manifest: `ARCHIVE_MANIFEST.json`
- Archive manifest SHA-256: `64937e914d7631b2ae9e4435392067bfceb01c15695daace696061f29f9bd9d7`
- Manifest verification: all 21 post-move root counts, byte counts, and deterministic inventory digests matched their pre-move values.
- The manifest contains each carrier root, classification, admitted target or hold, inventory digest, and a selected evidence-file digest.

Task-created omitted/duplicate material is preserved relative to that archive at:

- `_task-duplicate-sim-evidence/` — 14 files, 1,297,419 bytes
- `_task-omitted-private/sensory-multimodal-run101-integration-receipt.json` — contains local/private path state and was not committed
- `_task-omitted-sim-runtime/intake-selftest.js`
- `_task-omitted-sim-runtime/integration-driver.js`

## Focused verification before clearing carriers

The following trusted Workshop checks passed against the installed component-owned paths:

- accessibility adaptation lab selftest
- verification proof lab selftest
- AI curated-intake selftest
- AI team steward tool selftest
- AI source harness
- Universal Object Fabric selftest
- Workshop packager mobile selftest
- shared Game Organism selftest
- Game Organism lab selftest
- curated Academy, Sensorium, and LEGO JSON parse check

The post-clear full AGENTS.md gate results are appended below after execution.
