# AXM Sensorium - generated portable skill pack

Version: **1.4.0**  
Status: **TEST**  
Source: `shared/sensorium/canonical/sensorium.json`

13 senses; 12 executable routes and 1 honest host-mediated route. Perception never grants permission.

| Skill | Sense | Executor | Proof |
|---|---|---|---|
| `eye-static-image-inspector` | static-sight | HOST_MEDIATED | RUNTIME_PASS |
| `eye-live-visual-verifier` | live-sight | EXECUTABLE | RUNTIME_PASS |
| `eye-change-differ` | comparative-sight | EXECUTABLE | RUNTIME_PASS |
| `eye-accessibility-inspector` | accessible-sight | EXECUTABLE | RUNTIME_PASS |
| `ears-stream-listener` | hearing | EXECUTABLE | RUNTIME_PASS |
| `time-sense-ttl-verifier` | time | EXECUTABLE | RUNTIME_PASS |
| `touch-environment-probe` | touch | EXECUTABLE | RUNTIME_PASS |
| `handoff-continuity-steward` | memory-across-time | EXECUTABLE | RUNTIME_PASS |
| `compaction-steward` | tidy-forgetting | EXECUTABLE | RUNTIME_PASS |
| `drift-detector-ambient` | self-drift | EXECUTABLE | RUNTIME_PASS |
| `corroboration-triangulator` | cross-seat-corroboration | EXECUTABLE | RUNTIME_PASS |
| `interoception-capacity-gauge` | interoception | EXECUTABLE | CONTRACT_PASS |
| `taint-sniffer` | chemoreception | EXECUTABLE | RUNTIME_PASS |

Every `.skill.json`, `.SKILL.md`, index, host metadata, and bundle manifest is generated. Run the parity guard before release.

Raw sense material is ephemeral by default and must be zero after every seal.
