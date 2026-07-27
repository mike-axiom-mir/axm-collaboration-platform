'use strict';
window.AXM_HANDOFF_WIRING_MAP = {
  "schema": "axm.handoff-wiring-map/v1",
  "version": "v0.1",
  "measuredAt": "2026-07-26T21:00:35.599Z",
  "freshnessTtlMs": 7200000,
  "source": {
    "label": "axm-workshop-v4",
    "fingerprint": "82d4838e2fa53a9d7953875721a7e8621e358d5e6bf4254d89d1c51cf1619e67",
    "toolsScope": "top-level tools/<folder>/manifest.json excluding underscore-prefixed folders",
    "capabilityMetadataState": "LOADED",
    "capabilityMetadataSha256": "fd25040cd37f0a241a21c89e1f8da9d4267a54a579bdd75c953670fabd27aeee",
    "symlinksFollowed": false,
    "skippedSymlinks": [],
    "broken": []
  },
  "summary": {
    "modules": 81,
    "artifacts": 200,
    "exactlyWiredArtifacts": 25,
    "producerOnlyArtifacts": 89,
    "consumerOnlyArtifacts": 79,
    "selfLoopOnlyArtifacts": 7,
    "exactModuleRelations": 58,
    "modulesUsingMetadataFallback": 48,
    "modulesWithManifestContractDrift": 39,
    "contractsDeclared": 53,
    "contractsUnknown": 28
  },
  "modules": [
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "agent-command-center",
      "folder": "agent-command-center",
      "name": "AXM Agent Command Center",
      "version": "v0.4",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1"
      ],
      "produces": [
        "axm.agent-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-task/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-handoff/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "agent-tool-forge",
      "folder": "agent-tool-forge",
      "name": "AXM Agent Tool Forge",
      "version": "v0.2",
      "status": "TEST",
      "accepts": [
        "axm.agent-requirement/v1"
      ],
      "produces": [
        "axm.software-proposal/v1",
        "axm.specialist-package/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-requirement/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.software-proposal/v1",
            "axm.specialist-package/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "ai-task-talk",
      "folder": "ai-task-talk",
      "name": "AI Task & Talk Room",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1"
      ],
      "produces": [
        "axm.agent-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-task/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-handoff/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "ai-team",
      "folder": "ai-team",
      "name": "AXM AI Team",
      "version": "v1.6",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1",
        "axm.prompt/v1"
      ],
      "produces": [
        "axm.agent-handoff/v1",
        "axm.model-evaluation/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.ai-team-prompt/v1",
          "axm.collaboration-notice/v1",
          "axm.specialist-checkout/v1",
          "hub:init",
          "hub:settings:value",
          "plain-text/task-focus"
        ],
        "emits": [
          "axm.collaboration-review/v1",
          "axm.exploration-proposal/v1",
          "axm.model-comparison-review/v1",
          "axm.specialist-result/v1",
          "axm.technical-glasses/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.agent-task/v1",
            "axm.prompt/v1"
          ],
          "contractOnly": [
            "axm.ai-team-prompt/v1",
            "axm.collaboration-notice/v1",
            "axm.specialist-checkout/v1",
            "hub:init",
            "hub:settings:value",
            "plain-text/task-focus"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.agent-handoff/v1",
            "axm.model-evaluation/v1"
          ],
          "contractOnly": [
            "axm.collaboration-review/v1",
            "axm.exploration-proposal/v1",
            "axm.model-comparison-review/v1",
            "axm.specialist-result/v1",
            "axm.technical-glasses/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "asset-fabric",
      "folder": "asset-fabric",
      "name": "AXM Asset Fabric",
      "version": "v0.9",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.asset-brief/v1",
        "axm.asset-creation-recipe/v1",
        "axm.asset-fabric.machine-review-receipt/v1",
        "axm.asset-hand-result/v1",
        "axm.asset-need/v1",
        "axm.asset-validation-receipt/v1",
        "axm.body-pulse.lease/v1",
        "axm.creation.archive/v1",
        "axm.target-canvas/v1"
      ],
      "produces": [
        "axm.asset-fabric.candidate/v1",
        "axm.asset-fabric.machine-review-request/v1",
        "axm.asset-vocabulary-entry/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.asset-fabric.machine-review-receipt/v1",
          "axm.asset-hand-result/v1",
          "axm.asset-need/v1",
          "future:axm.asset-fabric.external-candidate/v1"
        ],
        "emits": [
          "axm.asset-fabric.candidate/v1",
          "axm.asset-fabric.machine-review-request/v1",
          "axm.asset-vocabulary-entry/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.asset-brief/v1",
            "axm.asset-creation-recipe/v1",
            "axm.asset-validation-receipt/v1",
            "axm.body-pulse.lease/v1",
            "axm.creation.archive/v1",
            "axm.target-canvas/v1"
          ],
          "contractOnly": [
            "future:axm.asset-fabric.external-candidate/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_COMPARED",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "asset-filesystem-service",
      "folder": "asset-filesystem-service",
      "name": "AXM Asset Filesystem Service",
      "version": "v0.2",
      "status": "TEST",
      "accepts": [
        "axm.asset-record/v1",
        "axm.asset-selection/v1"
      ],
      "produces": [
        "axm.asset-index/v1",
        "axm.asset-pack/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "explicit-asset-query",
          "explicit-pack-selection"
        ],
        "emits": [
          "axm.asset-filesystem-index/v1",
          "axm.asset-pack/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.asset-record/v1",
            "axm.asset-selection/v1"
          ],
          "contractOnly": [
            "explicit-asset-query",
            "explicit-pack-selection"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.asset-index/v1"
          ],
          "contractOnly": [
            "axm.asset-filesystem-index/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "asset-pack-lab",
      "folder": "asset-pack-lab",
      "name": "AXM Asset Pack Lab",
      "version": "v0_1",
      "status": "TEST",
      "accepts": [
        "axm.asset-record/v1"
      ],
      "produces": [
        "axm.asset-pack/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.asset-record/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.asset-pack/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "asset-vault",
      "folder": "asset-vault",
      "name": "AXM Asset Vault",
      "version": "v0_2",
      "status": "TEST",
      "accepts": [
        "axm.asset-record/v1"
      ],
      "produces": [
        "axm.asset-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.asset-record/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.asset-handoff/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "audio-studio",
      "folder": "audio-studio",
      "name": "AXM Audio Studio",
      "version": "v1.0",
      "status": "TEST",
      "accepts": [
        "audio/*",
        "axm.asset-handoff/v1",
        "midi"
      ],
      "produces": [
        "audio/*",
        "axm.audio-project/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "hub:init",
          "hub:settings:value",
          "session-local:audio-files"
        ],
        "emits": [
          "axm.audio-studio.project/v1",
          "axm.audio.sound/v1",
          "axm.publish-artifact/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "audio/*",
            "axm.asset-handoff/v1",
            "midi"
          ],
          "contractOnly": [
            "hub:init",
            "hub:settings:value",
            "session-local:audio-files"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "audio/*",
            "axm.audio-project/v1"
          ],
          "contractOnly": [
            "axm.audio-studio.project/v1",
            "axm.audio.sound/v1",
            "axm.publish-artifact/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "body-pulse",
      "folder": "body-pulse",
      "name": "Body Pulse",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.body-pulse.goal/v1",
        "axm.body-pulse.module/v1"
      ],
      "produces": [
        "axm.body-pulse.lease/v1",
        "axm.body-pulse.receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.body-pulse.goal/v1",
            "axm.body-pulse.module/v1"
          ],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.body-pulse.lease/v1",
            "axm.body-pulse.receipt/v1"
          ],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "browser-lan-hardware-qa-lab",
      "folder": "browser-lan-hardware-qa-lab",
      "name": "Browser, LAN & Hardware QA Lab",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.qa-device-evidence/v1"
      ],
      "produces": [
        "axm.qa-journey-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.qa-device-evidence/v1"
        ],
        "emits": [
          "axm.qa-journey-receipt/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "chatgpt-connector",
      "folder": "chatgpt-connector",
      "name": "ChatGPT Connector",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "image/png",
        "text/plain"
      ],
      "produces": [
        "axm.connector-proposal/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "image/png"
        ],
        "emits": [
          "axm.game-asset/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.connector-proposal/v1"
          ],
          "contractOnly": [
            "axm.game-asset/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "claude-connector",
      "folder": "claude-connector",
      "name": "Claude Code Connector",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1",
        "image/jpeg"
      ],
      "produces": [
        "axm.agent-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-task/v1",
            "image/jpeg"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-handoff/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "cognitive-calibration-lab",
      "folder": "cognitive-calibration-lab",
      "name": "Cognitive Calibration & Benchmark Lab",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "COGNITIVE_WORK_OBSERVATION_DRAFT",
        "DECLARED_RESOURCE_PREDICTION_INTERVAL"
      ],
      "produces": [
        "CALIBRATION_COMPARISON_RECEIPT"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "COGNITIVE_WORK_OBSERVATION_DRAFT",
          "DECLARED_RESOURCE_PREDICTION_INTERVAL"
        ],
        "emits": [
          "CALIBRATION_COMPARISON_RECEIPT"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "cognitive-evidence-explorer",
      "folder": "cognitive-evidence-explorer",
      "name": "Cognitive Evidence Explorer",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "COGNITIVE_EVIDENCE_LAB_RECORD",
        "SEPARATE_DIMENSION_RESOURCE_TIMELINE"
      ],
      "produces": [
        "READ_ONLY_COGNITIVE_EVIDENCE_VIEW"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "COGNITIVE_EVIDENCE_LAB_RECORD",
          "SEPARATE_DIMENSION_RESOURCE_TIMELINE"
        ],
        "emits": [
          "READ_ONLY_COGNITIVE_EVIDENCE_VIEW"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "cognitive-resource-meter",
      "folder": "cognitive-resource-meter",
      "name": "Cognitive Resource Meter",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.workshop.codex-goal-completion-receipt/v1",
        "EXPLICIT_LOCAL_METER_WINDOW",
        "LOCAL_HARDWARE_RATE_SCHEDULE",
        "PRIVACY_SAFE_MACHINE_PROFILE",
        "PROVIDER_COMPUTE_TELEMETRY",
        "PROVIDER_GOAL_RUN_RECEIPT",
        "VERSIONED_PROVIDER_RATE_SCHEDULE"
      ],
      "produces": [
        "COGNITIVE_EVIDENCE_BUNDLE",
        "COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT",
        "COGNITIVE_RESOURCE_LEDGER_RECEIPT",
        "COGNITIVE_WORK_OBSERVATION_DRAFT",
        "PRIVACY_SAFE_MACHINE_PROFILE_DIGEST",
        "SEPARATE_DIMENSION_RESOURCE_TIMELINE"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.workshop.codex-goal-completion-receipt/v1",
          "EXPLICIT_LOCAL_METER_WINDOW",
          "LOCAL_HARDWARE_RATE_SCHEDULE",
          "PRIVACY_SAFE_MACHINE_PROFILE",
          "PROVIDER_COMPUTE_TELEMETRY",
          "PROVIDER_GOAL_RUN_RECEIPT",
          "VERSIONED_PROVIDER_RATE_SCHEDULE"
        ],
        "emits": [
          "COGNITIVE_EVIDENCE_BUNDLE",
          "COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT",
          "COGNITIVE_RESOURCE_LEDGER_RECEIPT",
          "COGNITIVE_WORK_OBSERVATION_DRAFT",
          "PRIVACY_SAFE_MACHINE_PROFILE_DIGEST",
          "SEPARATE_DIMENSION_RESOURCE_TIMELINE"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "device-handoff",
      "folder": "device-handoff",
      "name": "AXM Local Device Handoff Bridge",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.device-handoff-request/v1",
        "multipart/form-data"
      ],
      "produces": [
        "axm.device-handoff-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "explicit-selected-device-files"
        ],
        "emits": [
          "axm.device-handoff-receipt/v1",
          "filesystem:assets/inbox/device-handoff"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.device-handoff-request/v1",
            "multipart/form-data"
          ],
          "contractOnly": [
            "explicit-selected-device-files"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "filesystem:assets/inbox/device-handoff"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "diagnostics-operations-center",
      "folder": "diagnostics-operations-center",
      "name": "AXM Diagnostics & Operations Center",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.diagnostics-query/v1"
      ],
      "produces": [
        "axm.diagnostics-report/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "metadata-only-audit-lines",
          "service-health-metadata"
        ],
        "emits": [
          "axm.diagnostics-snapshot/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.diagnostics-query/v1"
          ],
          "contractOnly": [
            "metadata-only-audit-lines",
            "service-health-metadata"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.diagnostics-report/v1"
          ],
          "contractOnly": [
            "axm.diagnostics-snapshot/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "discord-bridge",
      "folder": "discord-bridge",
      "name": "Discord Bridge",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.action/v1",
        "axm.discord.proposal/v1"
      ],
      "produces": [
        "axm.discord.proposal/v1",
        "axm.discord.sanitized-receipt/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.action/v1"
        ],
        "emits": [
          "axm.discord-proposal/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.discord.proposal/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.discord.proposal/v1",
            "axm.discord.sanitized-receipt/v1"
          ],
          "contractOnly": [
            "axm.discord-proposal/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "discovery-engine",
      "folder": "discovery-engine",
      "name": "AXM Discovery Engine × Stance Forge",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.discovery-lab.bundle/0.1",
        "text/plain"
      ],
      "produces": [
        "axm.discovery-lab.bundle/0.1",
        "axm.knowledge-project-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.discovery-lab.bundle/0.1",
          "text:executed-evidence"
        ],
        "emits": [
          "axm.discovery-lab.bundle/0.1",
          "axm.knowledge.research/v1",
          "text:discovery-report"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "text/plain"
          ],
          "contractOnly": [
            "text:executed-evidence"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.knowledge-project-handoff/v1"
          ],
          "contractOnly": [
            "axm.knowledge.research/v1",
            "text:discovery-report"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "duo-test",
      "folder": "duo-test",
      "name": "Supervised Local Duo - Nova and Gemini Local",
      "version": "v3",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1"
      ],
      "produces": [
        "axm.model-evaluation/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-task/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.model-evaluation/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "evidence-desk",
      "folder": "evidence-desk",
      "name": "AXM Evidence Desk",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "application/json",
        "text/plain"
      ],
      "produces": [
        "axm.evidence-packet/v1",
        "axm.knowledge-project-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "application/json",
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.evidence-packet/v1",
            "axm.knowledge-project-handoff/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "evolution-foundry",
      "folder": "evolution-foundry",
      "name": "AXM Evolution Foundry",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.asset-fabric.candidate/v1",
        "axm.body-pulse.receipt/v1",
        "axm.governed-evolution.receipt/v1",
        "axm.workshop-direction.plan/v1"
      ],
      "produces": [
        "axm.evolution-foundry.overview/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.asset-fabric.candidate/v1",
            "axm.body-pulse.receipt/v1",
            "axm.governed-evolution.receipt/v1",
            "axm.workshop-direction.plan/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.evolution-foundry.overview/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "film-motion-studio",
      "folder": "film-motion-studio",
      "name": "AXM Film & Motion Studio",
      "version": "v1.1",
      "status": "TEST",
      "accepts": [
        "audio/*",
        "image/*",
        "video/*"
      ],
      "produces": [
        "axm.film-motion-project/v1",
        "image/png"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.asset-hand-result/v1",
          "axm.motion-capture.points/v1",
          "hub:init",
          "hub:settings:value",
          "session-local:media-files"
        ],
        "emits": [
          "axm.film-motion.project/v1",
          "axm.film.edl/v1",
          "axm.film.frame-proof/v1",
          "axm.publish-artifact/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "audio/*",
            "image/*",
            "video/*"
          ],
          "contractOnly": [
            "axm.asset-hand-result/v1",
            "axm.motion-capture.points/v1",
            "hub:init",
            "hub:settings:value",
            "session-local:media-files"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.film-motion-project/v1",
            "image/png"
          ],
          "contractOnly": [
            "axm.film-motion.project/v1",
            "axm.film.edl/v1",
            "axm.film.frame-proof/v1",
            "axm.publish-artifact/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "finance-world-room",
      "folder": "finance-world-room",
      "name": "AXM Finance World Room",
      "version": "v0.1-experimental",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.finance-observation/v1",
        "text/csv"
      ],
      "produces": [
        "axm.finance-world-room/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "application/json:axm-finance-world-evidence",
          "text/csv:axm-finance-observation"
        ],
        "emits": [
          "axm.finance-world-evidence/0.1",
          "axm.finance-world-room-report/0.1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.finance-observation/v1",
            "text/csv"
          ],
          "contractOnly": [
            "application/json:axm-finance-world-evidence",
            "text/csv:axm-finance-observation"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.finance-world-room/v1"
          ],
          "contractOnly": [
            "axm.finance-world-evidence/0.1",
            "axm.finance-world-room-report/0.1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "forge",
      "folder": "forge",
      "name": "Tool Forge — make new tools the easy way",
      "version": "v1",
      "status": "TEST",
      "accepts": [
        "text/plain"
      ],
      "produces": [
        "axm.tool-proposal/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.tool-proposal/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "forge-line",
      "folder": "forge-line",
      "name": "Forge Line — proposal assembly line (v0.1 STARTER)",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.tool-proposal/v1"
      ],
      "produces": [
        "axm.module-candidate/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.tool-proposal/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.module-candidate/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "foundation-intake-steward",
      "folder": "foundation-intake-steward",
      "name": "AXM Foundation Intake Steward",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.foundation-contract-catalog/v1",
        "axm.foundation-implementation-map/v1"
      ],
      "produces": [
        "axm.foundation-intake-ledger/v1",
        "axm.foundation-intake-report/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.foundation-contract-catalog/v1",
          "axm.foundation-implementation-map/v1"
        ],
        "emits": [
          "axm.foundation-intake-ledger/v1",
          "axm.foundation-intake-report/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "game-forge",
      "folder": "game-forge",
      "name": "AXM Game Forge",
      "version": "v1.2",
      "status": "TEST",
      "accepts": [
        "axm.game-forge-project/v1",
        "axm.studio-asset/v1"
      ],
      "produces": [
        "axm.game-forge-project/v1",
        "axm.game-package-candidate/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.game-asset/v1",
          "hub:init",
          "hub:settings:value"
        ],
        "emits": [
          "axm.game-forge-project/v1",
          "axm.game-mod-manifest/v1",
          "axm.game-physics-config/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.game-forge-project/v1",
            "axm.studio-asset/v1"
          ],
          "contractOnly": [
            "axm.game-asset/v1",
            "hub:init",
            "hub:settings:value"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.game-package-candidate/v1"
          ],
          "contractOnly": [
            "axm.game-mod-manifest/v1",
            "axm.game-physics-config/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "game-hub",
      "folder": "game-hub",
      "name": "AXM Game Hub",
      "version": "v0.4",
      "status": "TEST",
      "accepts": [
        "axm.game-package/v1"
      ],
      "produces": [
        "axm.game-session/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.game-asset/v1"
        ],
        "emits": [
          "axm.game-asset-acceptance/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.game-package/v1"
          ],
          "contractOnly": [
            "axm.game-asset/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.game-session/v1"
          ],
          "contractOnly": [
            "axm.game-asset-acceptance/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "geographic-market-map",
      "folder": "geographic-market-map",
      "name": "AXM Geographic Market Map",
      "version": "v0.1-polished-review",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.market-observation/v1",
        "text/csv"
      ],
      "produces": [
        "axm.market-report/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "application/json:axm-geographic-market-evidence",
          "text/csv:axm-market-observation-schema"
        ],
        "emits": [
          "axm.geographic-market-evidence/0.2",
          "axm.geographic-market-report/0.2",
          "axm.market-watchlist/0.1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.market-observation/v1",
            "text/csv"
          ],
          "contractOnly": [
            "application/json:axm-geographic-market-evidence",
            "text/csv:axm-market-observation-schema"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.market-report/v1"
          ],
          "contractOnly": [
            "axm.geographic-market-evidence/0.2",
            "axm.geographic-market-report/0.2",
            "axm.market-watchlist/0.1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "governed-evolution-lab",
      "folder": "governed-evolution-lab",
      "name": "Governed Evolution Lab",
      "version": "v0.1.1-epoch",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.body-pulse.lease/v1",
        "axm.grafthold.world-exam-result/v1",
        "axm.mirror.world-genome-candidate-set/v1"
      ],
      "produces": [
        "axm.governed-evolution.lineage/v1",
        "axm.governed-evolution.receipt/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.body-pulse.lease/v1",
          "axm.grafthold.world-exam-result/v1",
          "axm.mirror.world-genome-candidate-set/v1",
          "axm.workshop.capability-catalog/v1",
          "axm.world.observation/v1"
        ],
        "emits": [
          "axm.governed-evolution.lineage/v1",
          "axm.governed-evolution.receipt/v1",
          "axm.project-room/v1:append-milestone"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.workshop.capability-catalog/v1",
            "axm.world.observation/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.project-room/v1:append-milestone"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "graft",
      "folder": "graft",
      "name": "Graft",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "application/json",
        "text/plain"
      ],
      "produces": [
        "axm.graft-plan/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "application/json",
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.graft-plan/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "hermes-local",
      "folder": "hermes",
      "name": "Hermes Local Runtime Wrapper",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.model-request/v1"
      ],
      "produces": [
        "axm.model-response/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.model-request/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.model-response/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "hub-test-room",
      "folder": "hub-test-room",
      "name": "Test Room",
      "version": "v1.0",
      "status": "TEST",
      "accepts": [
        "axm.test-plan/v1"
      ],
      "produces": [
        "axm.test-result/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.test-plan/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.test-result/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "human-attention-ledger",
      "folder": "human-attention-ledger",
      "name": "Human Attention Ledger",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "OPTED_IN_ATTENTION_OBSERVATION"
      ],
      "produces": [
        "ATTENTION_CONSENT_WITHDRAWAL",
        "PSEUDONYMOUS_ATTENTION_RECEIPT"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "OPTED_IN_ATTENTION_OBSERVATION"
        ],
        "emits": [
          "ATTENTION_CONSENT_WITHDRAWAL",
          "PSEUDONYMOUS_ATTENTION_RECEIPT"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "judgement-chamber",
      "folder": "judgement-chamber",
      "name": "Judgement Chamber",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.review-item/v1",
        "axm.workshop-direction.request/v1"
      ],
      "produces": [
        "axm.deep-judgement-artifact/v1",
        "axm.review-vote/v1",
        "axm.workshop-direction.plan/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.review-item/v1",
          "axm.workshop-direction.plan/v1"
        ],
        "emits": [
          "axm.deep-judgement-artifact/v1",
          "axm.review-item/v1",
          "axm.review-vote/v1",
          "axm.workshop-direction.request/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-direction.request/v1"
          ],
          "contractOnly": [
            "axm.workshop-direction.plan/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-direction.plan/v1"
          ],
          "contractOnly": [
            "axm.review-item/v1",
            "axm.workshop-direction.request/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "knowledge-canvas",
      "folder": "knowledge-canvas",
      "name": "AXM Knowledge Canvas",
      "version": "v1.1",
      "status": "TEST",
      "accepts": [
        "axm.knowledge-project-handoff/v1",
        "text/csv"
      ],
      "produces": [
        "axm.knowledge-canvas-project/v1",
        "axm.knowledge-project-handoff/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.knowledge-canvas/v1",
          "axm.knowledge.research/v1",
          "hub:init",
          "hub:settings:value"
        ],
        "emits": [
          "axm.knowledge-canvas/v1",
          "axm.knowledge-project-handoff/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.knowledge-project-handoff/v1",
            "text/csv"
          ],
          "contractOnly": [
            "axm.knowledge-canvas/v1",
            "axm.knowledge.research/v1",
            "hub:init",
            "hub:settings:value"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.knowledge-canvas-project/v1"
          ],
          "contractOnly": [
            "axm.knowledge-canvas/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "launcher-card-installer",
      "folder": "launcher-card-installer",
      "name": "AXM Launcher Card Proposal",
      "version": "v0_2",
      "status": "TEST",
      "accepts": [
        "axm.launcher-card/v1"
      ],
      "produces": [
        "axm.launcher-card-candidate/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.launcher-card/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.launcher-card-candidate/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "learning-lab",
      "folder": "learning-lab",
      "name": "AXM Learning Lab",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.ai-learning.curriculum/v1",
        "axm.learning-lab.project/v1"
      ],
      "produces": [
        "axm.ai-learning.session-proposal/v1",
        "axm.learning-lab.assessment/v1",
        "axm.learning-lab.code-run/v1",
        "axm.learning-lab.project/v1",
        "axm.learning-lab.simulation-result/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.ai-learning.curriculum/v1",
          "hub:init",
          "hub:settings:value",
          "user-file:axm.learning-lab.project/v1"
        ],
        "emits": [
          "axm.ai-learning.session-proposal/v1",
          "axm.learning-lab.assessment/v1",
          "axm.learning-lab.code-run/v1",
          "axm.learning-lab.project/v1",
          "axm.learning-lab.simulation-result/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.learning-lab.project/v1"
          ],
          "contractOnly": [
            "hub:init",
            "hub:settings:value",
            "user-file:axm.learning-lab.project/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_COMPARED",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "living-world-ruleset-physics-adapter-kit",
      "folder": "living-world-ruleset-physics-adapter-kit",
      "name": "Living World Ruleset & Physics Adapter Kit",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.living-world.snapshot/v1"
      ],
      "produces": [
        "axm.living-world.intent/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.living-world.snapshot/v1"
        ],
        "emits": [
          "axm.living-world.intent/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "living-world-state-server",
      "folder": "living-world-state-server",
      "name": "Authoritative Living World State Server",
      "version": "v0.2",
      "status": "TEST",
      "accepts": [
        "axm.living-world.create/v1",
        "axm.living-world.patch/v1"
      ],
      "produces": [
        "axm.living-world-catalog/v1",
        "axm.living-world.changes/v1",
        "axm.living-world.snapshot/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.living-world.create/v1",
          "axm.living-world.patch/v1"
        ],
        "emits": [
          "axm.living-world-catalog/v1",
          "axm.living-world.changes/v1",
          "axm.living-world.snapshot/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "machine-host",
      "folder": "machine-host",
      "name": "AXM Authenticated Machine Host",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.machine-action-request/v1"
      ],
      "produces": [
        "axm.machine-job-result/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.machine-job-request/v1"
        ],
        "emits": [
          "axm.machine-job/v1",
          "axm.verification-receipt/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.machine-action-request/v1"
          ],
          "contractOnly": [
            "axm.machine-job-request/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.machine-job-result/v1"
          ],
          "contractOnly": [
            "axm.machine-job/v1",
            "axm.verification-receipt/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "main-hub",
      "folder": "main-hub",
      "name": "AXM Main Hub",
      "version": "v0.1",
      "status": "SHELL",
      "accepts": [
        "axm.hub-state/v1"
      ],
      "produces": [
        "axm.hub-state/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.hub-state/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.hub-state/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "marketplace-deployment",
      "folder": "marketplace-deployment",
      "name": "AXM Marketplace & Deployment",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.publish-artifact/v1",
        "axm.release-manifest/v1",
        "axm.workshop-package/v1"
      ],
      "produces": [
        "axm.deployment-plan/v1",
        "axm.marketplace-listing/v1",
        "axm.plugin-distribution-proposal/v1",
        "axm.update-feed-proposal/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.publish-artifact/v1",
          "axm.release-manifest/v1",
          "axm.workshop-package/v1",
          "hub:init",
          "hub:settings:value"
        ],
        "emits": [
          "axm.deployment-plan/v1",
          "axm.marketplace-listing/v1",
          "axm.plugin-distribution-proposal/v1",
          "axm.update-feed-proposal/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "hub:init",
            "hub:settings:value"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_COMPARED",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "media-render-transcode-service",
      "folder": "media-render-transcode-service",
      "name": "Media Render & Transcode Service",
      "version": "v0.2",
      "status": "TEST",
      "accepts": [
        "axm.media-render-request/v1"
      ],
      "produces": [
        "axm.media-render-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.media-render-request/v1"
        ],
        "emits": [
          "axm.media-render-receipt/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "mirror-intake-monitor",
      "folder": "mirror-intake-monitor",
      "name": "Mirror Intake Monitor",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "MIRROR_INTAKE_RECEIPT"
      ],
      "produces": [
        "WORKSHOP_MIRROR_INTAKE_STATUS_RECEIPT"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "MIRROR_INTAKE_RECEIPT"
        ],
        "emits": [
          "WORKSHOP_MIRROR_INTAKE_STATUS_RECEIPT"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "mirror-learning-shell",
      "folder": "mirror-learning-shell",
      "name": "AI Learning Forge",
      "version": "v0.2-shared-door",
      "status": "TEST",
      "accepts": [
        "axm.ai-learning.curriculum/v1",
        "axm.ai-learning.session-proposal/v1"
      ],
      "produces": [
        "axm.mirror.learning-shell-session/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.ai-learning.curriculum/v1",
            "axm.ai-learning.session-proposal/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.mirror.learning-shell-session/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "model-lab",
      "folder": "model-lab",
      "name": "Model Lab — EXPERIMENTAL",
      "version": "v0.2",
      "status": "TEST",
      "accepts": [
        "axm.prompt/v1"
      ],
      "produces": [
        "axm.model-evaluation/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.prompt/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.model-evaluation/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "module-contract-workbench",
      "folder": "module-contract-workbench",
      "name": "AXM Module Contract & Manifest Workbench",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.module-contract/v1",
        "axm.module-manifest/v1"
      ],
      "produces": [
        "axm.module-bundle/v1",
        "axm.module-contract-validation/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.module-contract/v1",
          "module-manifest"
        ],
        "emits": [
          "axm.module-bundle/v1",
          "axm.review-item/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.module-manifest/v1"
          ],
          "contractOnly": [
            "module-manifest"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.module-contract-validation/v1"
          ],
          "contractOnly": [
            "axm.review-item/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "module-installer",
      "folder": "module-installer",
      "name": "AXM Governed Installer & Update Manager",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.module-bundle/v1",
        "axm.review-receipt/v1"
      ],
      "produces": [
        "axm.module-install-candidate/v1",
        "axm.module-install-receipt/v1",
        "axm.module-rollback-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.module-bundle/v1",
          "axm.review-vote/v1"
        ],
        "emits": [
          "axm.module-install-backup/v1",
          "axm.module-install-receipt/v1",
          "axm.review-item/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.review-receipt/v1"
          ],
          "contractOnly": [
            "axm.review-vote/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.module-install-candidate/v1",
            "axm.module-rollback-receipt/v1"
          ],
          "contractOnly": [
            "axm.module-install-backup/v1",
            "axm.review-item/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "multiplayer-controller-transport",
      "folder": "multiplayer-controller-transport",
      "name": "Multiplayer & Controller Transport",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.controller-input/v1"
      ],
      "produces": [
        "axm.multiplayer-session-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.controller-input/v1"
        ],
        "emits": [
          "axm.controller-input/v1",
          "axm.multiplayer-session-receipt/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.controller-input/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "novelty-diversity-engine",
      "folder": "novelty-diversity-engine",
      "name": "Novelty & Diversity Engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.novelty-candidate-set/v1"
      ],
      "produces": [
        "axm.novelty-experiment/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.novelty-candidate-set/v1"
        ],
        "emits": [
          "axm.novelty-experiment/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "prehub",
      "folder": "prehub",
      "name": "Prehub — write, save, load",
      "version": "v1",
      "status": "WORKING",
      "accepts": [
        "text/plain"
      ],
      "produces": [
        "text/plain"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "project-room",
      "folder": "project-room",
      "name": "AXM Project Room",
      "version": "v0.3",
      "status": "TEST",
      "accepts": [
        "axm.knowledge-project-handoff/v1",
        "axm.project-room/v1"
      ],
      "produces": [
        "axm.project-room/v2",
        "axm.workshop-continue/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.guest-session-export/v1",
          "axm.knowledge-project-handoff/v1",
          "axm.project-room/v1"
        ],
        "emits": [
          "axm.project-room/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.guest-session-export/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.project-room/v2",
            "axm.workshop-continue/v1"
          ],
          "contractOnly": [
            "axm.project-room/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "prompt-vault",
      "folder": "prompt-vault",
      "name": "AXM Prompt Vault",
      "version": "v0_2",
      "status": "TEST",
      "accepts": [
        "axm.prompt/v1",
        "text/plain"
      ],
      "produces": [
        "axm.prompt/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.prompt/v1",
            "text/plain"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.prompt/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "ps2-asset-forge",
      "folder": "ps2-asset-forge",
      "name": "PS2 Asset Forge",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.asset-source-selection/v1",
        "axm.ps2-asset-brief/v1"
      ],
      "produces": [
        "axm.ps2-asset-candidate/v1",
        "model/gltf-binary"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "human-art-direction",
          "human-visual-approval"
        ],
        "emits": [
          "axm.asset-fabric.need/v2",
          "axm.ps2-asset-forge.recipe/v1",
          "model/gltf-binary"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.asset-source-selection/v1",
            "axm.ps2-asset-brief/v1"
          ],
          "contractOnly": [
            "human-art-direction",
            "human-visual-approval"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.ps2-asset-candidate/v1"
          ],
          "contractOnly": [
            "axm.asset-fabric.need/v2",
            "axm.ps2-asset-forge.recipe/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "public-release-deployment-adapter",
      "folder": "public-release-deployment-adapter",
      "name": "Public Release & Deployment Adapter",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.release-candidate/v1"
      ],
      "produces": [
        "axm.public-deployment-receipt/v1",
        "axm.signed-public-release/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.release-candidate/v1"
        ],
        "emits": [
          "axm.public-deployment-receipt/v1",
          "axm.signed-public-release/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "publish-library",
      "folder": "publish-library",
      "name": "AXM Publish & Library",
      "version": "v1.1",
      "status": "TEST",
      "accepts": [
        "axm.asset-handoff/v1",
        "axm.deployment-plan/v1",
        "axm.marketplace-listing/v1",
        "axm.output-job/v1"
      ],
      "produces": [
        "axm.release-candidate/v1",
        "axm.workshop-package/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.deployment-plan/v1",
          "axm.marketplace-listing/v1",
          "axm.publish-artifact/v1",
          "hub:init",
          "hub:settings:value"
        ],
        "emits": [
          "axm.release-manifest/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.asset-handoff/v1",
            "axm.output-job/v1"
          ],
          "contractOnly": [
            "axm.publish-artifact/v1",
            "hub:init",
            "hub:settings:value"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.release-candidate/v1",
            "axm.workshop-package/v1"
          ],
          "contractOnly": [
            "axm.release-manifest/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "read-only-mirror-world-adapter",
      "folder": "read-only-mirror-world-adapter",
      "name": "Read-only Mirror World Adapter",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.mirror-observation-consent/v1"
      ],
      "produces": [
        "axm.mirror-world-observation/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.mirror-observation-consent/v1"
        ],
        "emits": [
          "axm.mirror-observation-receipt/v1",
          "axm.mirror-world-observation/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.mirror-observation-receipt/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "reasoning-shell",
      "folder": "reasoning-shell",
      "name": "Reasoning Shell — EXPERIMENTAL BRANCH",
      "version": "v0.1-branch",
      "status": "TEST",
      "accepts": [
        "axm.agent-task/v1"
      ],
      "produces": [
        "axm.reasoning-draft/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.agent-task/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.reasoning-draft/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "recovery-center",
      "folder": "recovery-center",
      "name": "AXM Recovery & Rollback Center",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.recovery-request/v1",
        "axm.workshop-package/v1"
      ],
      "produces": [
        "axm.recovery-restore-receipt/v1",
        "axm.recovery-snapshot/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.recovery-request/v1"
        ],
        "emits": [
          "axm.pre-restore-backup/v1",
          "axm.recovery-snapshot/v1",
          "axm.restore-preview/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-package/v1"
          ],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.recovery-restore-receipt/v1"
          ],
          "contractOnly": [
            "axm.pre-restore-backup/v1",
            "axm.restore-preview/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "review-inbox",
      "folder": "review-inbox",
      "name": "AXM Review & Promotion Inbox",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.review-candidate/v1"
      ],
      "produces": [
        "axm.review-decision/v1",
        "axm.review-discussion/v1",
        "axm.review-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.review-item/v1"
        ],
        "emits": [
          "axm.review-decision/v1",
          "axm.review-discussion/v1",
          "axm.review-vote/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.review-candidate/v1"
          ],
          "contractOnly": [
            "axm.review-item/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.review-receipt/v1"
          ],
          "contractOnly": [
            "axm.review-vote/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "route",
      "folder": "route",
      "name": "Route",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.route/v1"
      ],
      "produces": [
        "axm.route-resume/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.route/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.route-resume/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "runner",
      "folder": "runner",
      "name": "Verification Desk",
      "version": "v1.1",
      "status": "TEST",
      "accepts": [
        "axm.test-plan/v1"
      ],
      "produces": [
        "axm.test-result/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.test-plan/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.test-result/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "sandbox",
      "folder": "sandbox",
      "name": "AXM Sandbox",
      "version": "v0.1-session1",
      "status": "TEST",
      "accepts": [
        "axm.game-forge-project/v1"
      ],
      "produces": [
        "axm.game-prototype/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.game-forge-project/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.game-prototype/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "secrets-permissions-console",
      "folder": "secrets-permissions-console",
      "name": "AXM Secrets & Permissions Console",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.permission-decision-request/v1",
        "axm.secret-write-request/v1"
      ],
      "produces": [
        "axm.permission-receipt/v1",
        "axm.secret-metadata/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.permission-request/v1",
          "explicit-secret-input"
        ],
        "emits": [
          "axm.permission-decision/v1",
          "axm.secret-metadata/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.permission-decision-request/v1",
            "axm.secret-write-request/v1"
          ],
          "contractOnly": [
            "axm.permission-request/v1",
            "explicit-secret-input"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.permission-receipt/v1"
          ],
          "contractOnly": [
            "axm.permission-decision/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "shell-guardian",
      "folder": "shell-guardian",
      "name": "Shell Guardian",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.guardian-event/v1"
      ],
      "produces": [
        "axm.guardian-status/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.guardian-event/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.guardian-status/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "skinner",
      "folder": "skinner",
      "name": "Skinner",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.skin/v1"
      ],
      "produces": [
        "axm.skin/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.skin/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.skin/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "source-connector-hub",
      "folder": "source-connector-hub",
      "name": "Source Connector Hub",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.source-query/v1"
      ],
      "produces": [
        "axm.source-snapshot/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.source-query/v1"
        ],
        "emits": [
          "axm.source-snapshot/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "spatial-studio",
      "folder": "spatial-studio",
      "name": "AXM Spatial Studio",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.spatial.project/v1",
        "axm.spatial.scene/v1"
      ],
      "produces": [
        "axm.publish-artifact/v1",
        "axm.spatial.project/v1",
        "axm.spatial.scene/v1",
        "image/png",
        "model/obj"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.asset-hand-result/v1:validated-editable-spatial-project-or-material-graph",
          "hub:init",
          "hub:settings:value",
          "user-file:axm.spatial.project/v1"
        ],
        "emits": [
          "axm.publish-artifact/v1",
          "axm.spatial.project/v1",
          "axm.spatial.scene/v1",
          "image/png",
          "model/obj"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.spatial.project/v1",
            "axm.spatial.scene/v1"
          ],
          "contractOnly": [
            "axm.asset-hand-result/v1:validated-editable-spatial-project-or-material-graph",
            "hub:init",
            "hub:settings:value",
            "user-file:axm.spatial.project/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_COMPARED",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "studio",
      "folder": "studio",
      "name": "AXM Studio",
      "version": "v2.5",
      "status": "TEST",
      "accepts": [
        "axm.asset-creation-recipe/v1",
        "axm.asset-hand-result/v1",
        "axm.asset-handoff/v1",
        "axm.asset-validation-receipt/v1",
        "axm.target-canvas/v1",
        "image/*"
      ],
      "produces": [
        "axm.studio-project/v2",
        "image/png",
        "image/svg+xml"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm-asset-vault",
          "axm.asset-hand-result/v1",
          "axm.asset-source-artifact/v1",
          "axm.drawpacket/v1",
          "axm.studio-asset/v1",
          "axm.uiux-workspace/v1",
          "skin.config.json"
        ],
        "emits": [
          "axm-asset-pack",
          "axm.game-asset/v1",
          "axm.uiux-proposal/v1",
          "skin.config.json"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.asset-creation-recipe/v1",
            "axm.asset-handoff/v1",
            "axm.asset-validation-receipt/v1",
            "axm.target-canvas/v1",
            "image/*"
          ],
          "contractOnly": [
            "axm-asset-vault",
            "axm.asset-source-artifact/v1",
            "axm.drawpacket/v1",
            "axm.studio-asset/v1",
            "axm.uiux-workspace/v1",
            "skin.config.json"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.studio-project/v2",
            "image/png",
            "image/svg+xml"
          ],
          "contractOnly": [
            "axm-asset-pack",
            "axm.game-asset/v1",
            "axm.uiux-proposal/v1",
            "skin.config.json"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "sustainability-metrology-lab",
      "folder": "sustainability-metrology-lab",
      "name": "Sustainability Metrology Lab",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "DIRECT_POWER_METER_OBSERVATION",
        "SUSTAINABILITY_ATTESTATION"
      ],
      "produces": [
        "SUSTAINABILITY_METROLOGY_RECEIPT"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "DIRECT_POWER_METER_OBSERVATION",
          "SUSTAINABILITY_ATTESTATION"
        ],
        "emits": [
          "SUSTAINABILITY_METROLOGY_RECEIPT"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "technical-glasses",
      "folder": "technical-glasses",
      "name": "AXM Technical Glasses",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.technical-focus/v1",
        "plain-text/task-focus"
      ],
      "produces": [
        "axm.technical-glasses/v1",
        "text/plain/ai-technical-briefing"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.technical-focus/v1",
          "hub:init",
          "hub:settings:value",
          "plain-text/task-focus"
        ],
        "emits": [
          "axm.technical-glasses/v1",
          "text/plain/ai-technical-briefing"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "hub:init",
            "hub:settings:value"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "template-runtime-pack-engine",
      "folder": "template-runtime-pack-engine",
      "name": "Template Runtime & Pack Engine",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.template-pack/v1"
      ],
      "produces": [
        "axm.template-render-receipt/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.template-pack/v1"
        ],
        "emits": [
          "axm.template-pack/v1",
          "axm.template-render-receipt/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.template-pack/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "ui-ux-builder",
      "folder": "ui-ux-builder",
      "name": "AXM UI/UX Builder",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.ui-brief/v1"
      ],
      "produces": [
        "axm.ui-proposal/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.uiux-workspace/v1"
        ],
        "emits": [
          "axm.uiux-proposal/v1",
          "axm.uiux-workspace/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.ui-brief/v1"
          ],
          "contractOnly": [
            "axm.uiux-workspace/v1"
          ],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "FALLBACK_DRIFT",
          "effectiveOnly": [
            "axm.ui-proposal/v1"
          ],
          "contractOnly": [
            "axm.uiux-proposal/v1",
            "axm.uiux-workspace/v1"
          ],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "verifier",
      "folder": "verifier",
      "name": "Verifier",
      "version": "v1.0",
      "status": "TEST",
      "accepts": [
        "axm.test-plan/v1"
      ],
      "produces": [
        "axm.verification-report/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.test-plan/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.verification-report/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "workshop-command-center",
      "folder": "workshop-command-center",
      "name": "Workshop Command Center",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.cognitive-resource.command-center-controls/v1",
        "axm.workshop-direction.request/v1"
      ],
      "produces": [
        "axm.review-vote/v1",
        "axm.workshop-command-center.snapshot/v1",
        "axm.workshop-direction.plan/v1",
        "axm.workshop-direction.steward-assessment/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.body-pulse.status/v1",
          "axm.cognitive-resource-meter-status/v1",
          "axm.technical-glasses/v1",
          "axm.workshop-direction.status/v1"
        ],
        "emits": [
          "axm.review-vote/v1",
          "axm.workshop-direction.request/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.cognitive-resource.command-center-controls/v1",
            "axm.workshop-direction.request/v1"
          ],
          "contractOnly": [
            "axm.body-pulse.status/v1",
            "axm.cognitive-resource-meter-status/v1",
            "axm.technical-glasses/v1",
            "axm.workshop-direction.status/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-command-center.snapshot/v1",
            "axm.workshop-direction.plan/v1",
            "axm.workshop-direction.steward-assessment/v1"
          ],
          "contractOnly": [
            "axm.workshop-direction.request/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "workshop-direction",
      "folder": "workshop-direction",
      "name": "Workshop Direction",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "accepts": [
        "axm.workshop-direction.request/v1"
      ],
      "produces": [
        "axm.review-item/v1",
        "axm.workshop-direction.hand-request/v1",
        "axm.workshop-direction.plan/v1",
        "axm.workshop-direction.steward-assessment/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.workshop-direction.request/v1"
        ],
        "emits": [
          "axm.body-pulse.goal/v1",
          "axm.review-item/v1",
          "axm.workshop-direction.hand-request/v1",
          "axm.workshop-direction.plan/v1",
          "axm.workshop-direction.steward-assessment/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "EXACT",
          "effectiveOnly": [],
          "contractOnly": [],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [],
          "contractOnly": [
            "axm.body-pulse.goal/v1"
          ],
          "source": "manifest"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "workshop-packager",
      "folder": "workshop-packager",
      "name": "Workshop Packager",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.workshop-package-request/v1"
      ],
      "produces": [
        "axm.workshop-package/v1"
      ],
      "sources": {
        "accepts": "capability-metadata-fallback",
        "produces": "capability-metadata-fallback"
      },
      "contract": {
        "state": "NOT_DECLARED",
        "issue": "module contract not declared",
        "accepts": [],
        "emits": []
      },
      "reconciliation": {
        "accepts": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.workshop-package-request/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        },
        "emits": {
          "state": "CONTRACT_UNKNOWN",
          "effectiveOnly": [
            "axm.workshop-package/v1"
          ],
          "contractOnly": [],
          "source": "capability-metadata-fallback"
        }
      }
    },
    {
      "schema": "axm.handoff-module-envelope/v1",
      "id": "workshop-search-provenance",
      "folder": "workshop-search-provenance",
      "name": "AXM Workshop Search & Provenance Index",
      "version": "v0.1",
      "status": "TEST",
      "accepts": [
        "axm.workshop-search-query/v1",
        "text/plain"
      ],
      "produces": [
        "axm.workshop-search-results/v1"
      ],
      "sources": {
        "accepts": "manifest",
        "produces": "manifest"
      },
      "contract": {
        "state": "DECLARED",
        "issue": null,
        "accepts": [
          "axm.search-query/v1"
        ],
        "emits": [
          "axm.search-result/v1",
          "axm.source-reference/v1"
        ]
      },
      "reconciliation": {
        "accepts": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-search-query/v1",
            "text/plain"
          ],
          "contractOnly": [
            "axm.search-query/v1"
          ],
          "source": "manifest"
        },
        "emits": {
          "state": "DRIFT",
          "effectiveOnly": [
            "axm.workshop-search-results/v1"
          ],
          "contractOnly": [
            "axm.search-result/v1",
            "axm.source-reference/v1"
          ],
          "source": "manifest"
        }
      }
    }
  ],
  "artifacts": [
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "application/json",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "evidence-desk",
        "graft"
      ],
      "distinctModules": [
        "evidence-desk",
        "graft"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "ATTENTION_CONSENT_WITHDRAWAL",
      "state": "PRODUCER_ONLY",
      "providers": [
        "human-attention-ledger"
      ],
      "consumers": [],
      "distinctModules": [
        "human-attention-ledger"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "audio/*",
      "state": "EXACTLY_WIRED",
      "providers": [
        "audio-studio"
      ],
      "consumers": [
        "audio-studio",
        "film-motion-studio"
      ],
      "distinctModules": [
        "audio-studio",
        "film-motion-studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.action/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "discord-bridge"
      ],
      "distinctModules": [
        "discord-bridge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.agent-handoff/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "agent-command-center",
        "ai-task-talk",
        "ai-team",
        "claude-connector"
      ],
      "consumers": [],
      "distinctModules": [
        "agent-command-center",
        "ai-task-talk",
        "ai-team",
        "claude-connector"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.agent-requirement/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "agent-tool-forge"
      ],
      "distinctModules": [
        "agent-tool-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.agent-task/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "agent-command-center",
        "ai-task-talk",
        "ai-team",
        "claude-connector",
        "duo-test",
        "reasoning-shell"
      ],
      "distinctModules": [
        "agent-command-center",
        "ai-task-talk",
        "ai-team",
        "claude-connector",
        "duo-test",
        "reasoning-shell"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ai-learning.curriculum/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "learning-lab",
        "mirror-learning-shell"
      ],
      "distinctModules": [
        "learning-lab",
        "mirror-learning-shell"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ai-learning.session-proposal/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "learning-lab"
      ],
      "consumers": [
        "mirror-learning-shell"
      ],
      "distinctModules": [
        "learning-lab",
        "mirror-learning-shell"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-brief/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric"
      ],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-creation-recipe/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric",
        "studio"
      ],
      "distinctModules": [
        "asset-fabric",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-fabric.candidate/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "asset-fabric"
      ],
      "consumers": [
        "evolution-foundry"
      ],
      "distinctModules": [
        "asset-fabric",
        "evolution-foundry"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-fabric.machine-review-receipt/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric"
      ],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-fabric.machine-review-request/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "asset-fabric"
      ],
      "consumers": [],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-hand-result/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric",
        "studio"
      ],
      "distinctModules": [
        "asset-fabric",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-handoff/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "asset-vault"
      ],
      "consumers": [
        "audio-studio",
        "publish-library",
        "studio"
      ],
      "distinctModules": [
        "asset-vault",
        "audio-studio",
        "publish-library",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-index/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "asset-filesystem-service"
      ],
      "consumers": [],
      "distinctModules": [
        "asset-filesystem-service"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-need/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric"
      ],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-pack/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "asset-filesystem-service",
        "asset-pack-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "asset-filesystem-service",
        "asset-pack-lab"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-record/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-filesystem-service",
        "asset-pack-lab",
        "asset-vault"
      ],
      "distinctModules": [
        "asset-filesystem-service",
        "asset-pack-lab",
        "asset-vault"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-selection/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-filesystem-service"
      ],
      "distinctModules": [
        "asset-filesystem-service"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-source-selection/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "ps2-asset-forge"
      ],
      "distinctModules": [
        "ps2-asset-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-validation-receipt/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric",
        "studio"
      ],
      "distinctModules": [
        "asset-fabric",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.asset-vocabulary-entry/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "asset-fabric"
      ],
      "consumers": [],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.audio-project/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "audio-studio"
      ],
      "consumers": [],
      "distinctModules": [
        "audio-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.body-pulse.goal/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "body-pulse"
      ],
      "distinctModules": [
        "body-pulse"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.body-pulse.lease/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "body-pulse"
      ],
      "consumers": [
        "asset-fabric",
        "governed-evolution-lab"
      ],
      "distinctModules": [
        "asset-fabric",
        "body-pulse",
        "governed-evolution-lab"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.body-pulse.module/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "body-pulse"
      ],
      "distinctModules": [
        "body-pulse"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.body-pulse.receipt/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "body-pulse"
      ],
      "consumers": [
        "evolution-foundry"
      ],
      "distinctModules": [
        "body-pulse",
        "evolution-foundry"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.cognitive-resource.command-center-controls/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "workshop-command-center"
      ],
      "distinctModules": [
        "workshop-command-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.connector-proposal/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "chatgpt-connector"
      ],
      "consumers": [],
      "distinctModules": [
        "chatgpt-connector"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.controller-input/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "multiplayer-controller-transport"
      ],
      "distinctModules": [
        "multiplayer-controller-transport"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.creation.archive/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric"
      ],
      "distinctModules": [
        "asset-fabric"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.deep-judgement-artifact/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "judgement-chamber"
      ],
      "consumers": [],
      "distinctModules": [
        "judgement-chamber"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.deployment-plan/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "marketplace-deployment"
      ],
      "consumers": [
        "publish-library"
      ],
      "distinctModules": [
        "marketplace-deployment",
        "publish-library"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.device-handoff-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "device-handoff"
      ],
      "consumers": [],
      "distinctModules": [
        "device-handoff"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.device-handoff-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "device-handoff"
      ],
      "distinctModules": [
        "device-handoff"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.diagnostics-query/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "diagnostics-operations-center"
      ],
      "distinctModules": [
        "diagnostics-operations-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.diagnostics-report/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "diagnostics-operations-center"
      ],
      "consumers": [],
      "distinctModules": [
        "diagnostics-operations-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.discord.proposal/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "discord-bridge"
      ],
      "consumers": [
        "discord-bridge"
      ],
      "distinctModules": [
        "discord-bridge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.discord.sanitized-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "discord-bridge"
      ],
      "consumers": [],
      "distinctModules": [
        "discord-bridge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.discovery-lab.bundle/0.1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "discovery-engine"
      ],
      "consumers": [
        "discovery-engine"
      ],
      "distinctModules": [
        "discovery-engine"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.evidence-packet/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "evidence-desk"
      ],
      "consumers": [],
      "distinctModules": [
        "evidence-desk"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.evolution-foundry.overview/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "evolution-foundry"
      ],
      "consumers": [],
      "distinctModules": [
        "evolution-foundry"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.film-motion-project/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "film-motion-studio"
      ],
      "consumers": [],
      "distinctModules": [
        "film-motion-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.finance-observation/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "finance-world-room"
      ],
      "distinctModules": [
        "finance-world-room"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.finance-world-room/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "finance-world-room"
      ],
      "consumers": [],
      "distinctModules": [
        "finance-world-room"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.foundation-contract-catalog/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "foundation-intake-steward"
      ],
      "distinctModules": [
        "foundation-intake-steward"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.foundation-implementation-map/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "foundation-intake-steward"
      ],
      "distinctModules": [
        "foundation-intake-steward"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.foundation-intake-ledger/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "foundation-intake-steward"
      ],
      "consumers": [],
      "distinctModules": [
        "foundation-intake-steward"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.foundation-intake-report/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "foundation-intake-steward"
      ],
      "consumers": [],
      "distinctModules": [
        "foundation-intake-steward"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.game-forge-project/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "game-forge"
      ],
      "consumers": [
        "game-forge",
        "sandbox"
      ],
      "distinctModules": [
        "game-forge",
        "sandbox"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.game-package-candidate/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "game-forge"
      ],
      "consumers": [],
      "distinctModules": [
        "game-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.game-package/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "game-hub"
      ],
      "distinctModules": [
        "game-hub"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.game-prototype/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "sandbox"
      ],
      "consumers": [],
      "distinctModules": [
        "sandbox"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.game-session/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "game-hub"
      ],
      "consumers": [],
      "distinctModules": [
        "game-hub"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.governed-evolution.lineage/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "governed-evolution-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "governed-evolution-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.governed-evolution.receipt/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "governed-evolution-lab"
      ],
      "consumers": [
        "evolution-foundry"
      ],
      "distinctModules": [
        "evolution-foundry",
        "governed-evolution-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.graft-plan/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "graft"
      ],
      "consumers": [],
      "distinctModules": [
        "graft"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.grafthold.world-exam-result/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "governed-evolution-lab"
      ],
      "distinctModules": [
        "governed-evolution-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.guardian-event/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "shell-guardian"
      ],
      "distinctModules": [
        "shell-guardian"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.guardian-status/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "shell-guardian"
      ],
      "consumers": [],
      "distinctModules": [
        "shell-guardian"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.hub-state/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "main-hub"
      ],
      "consumers": [
        "main-hub"
      ],
      "distinctModules": [
        "main-hub"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.knowledge-canvas-project/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "knowledge-canvas"
      ],
      "consumers": [],
      "distinctModules": [
        "knowledge-canvas"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.knowledge-project-handoff/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "discovery-engine",
        "evidence-desk",
        "knowledge-canvas"
      ],
      "consumers": [
        "knowledge-canvas",
        "project-room"
      ],
      "distinctModules": [
        "discovery-engine",
        "evidence-desk",
        "knowledge-canvas",
        "project-room"
      ],
      "multiProvider": true,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.launcher-card-candidate/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "launcher-card-installer"
      ],
      "consumers": [],
      "distinctModules": [
        "launcher-card-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.launcher-card/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "launcher-card-installer"
      ],
      "distinctModules": [
        "launcher-card-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.learning-lab.assessment/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "learning-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "learning-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.learning-lab.code-run/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "learning-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "learning-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.learning-lab.project/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "learning-lab"
      ],
      "consumers": [
        "learning-lab"
      ],
      "distinctModules": [
        "learning-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.learning-lab.simulation-result/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "learning-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "learning-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world-catalog/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "living-world-state-server"
      ],
      "consumers": [],
      "distinctModules": [
        "living-world-state-server"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world.changes/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "living-world-state-server"
      ],
      "consumers": [],
      "distinctModules": [
        "living-world-state-server"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world.create/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "living-world-state-server"
      ],
      "distinctModules": [
        "living-world-state-server"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world.intent/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "living-world-ruleset-physics-adapter-kit"
      ],
      "consumers": [],
      "distinctModules": [
        "living-world-ruleset-physics-adapter-kit"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world.patch/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "living-world-state-server"
      ],
      "distinctModules": [
        "living-world-state-server"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.living-world.snapshot/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "living-world-state-server"
      ],
      "consumers": [
        "living-world-ruleset-physics-adapter-kit"
      ],
      "distinctModules": [
        "living-world-ruleset-physics-adapter-kit",
        "living-world-state-server"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.machine-action-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "machine-host"
      ],
      "distinctModules": [
        "machine-host"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.machine-job-result/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "machine-host"
      ],
      "consumers": [],
      "distinctModules": [
        "machine-host"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.market-observation/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "geographic-market-map"
      ],
      "distinctModules": [
        "geographic-market-map"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.market-report/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "geographic-market-map"
      ],
      "consumers": [],
      "distinctModules": [
        "geographic-market-map"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.marketplace-listing/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "marketplace-deployment"
      ],
      "consumers": [
        "publish-library"
      ],
      "distinctModules": [
        "marketplace-deployment",
        "publish-library"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.media-render-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "media-render-transcode-service"
      ],
      "consumers": [],
      "distinctModules": [
        "media-render-transcode-service"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.media-render-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "media-render-transcode-service"
      ],
      "distinctModules": [
        "media-render-transcode-service"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.mirror-observation-consent/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "read-only-mirror-world-adapter"
      ],
      "distinctModules": [
        "read-only-mirror-world-adapter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.mirror-world-observation/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "read-only-mirror-world-adapter"
      ],
      "consumers": [],
      "distinctModules": [
        "read-only-mirror-world-adapter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.mirror.learning-shell-session/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "mirror-learning-shell"
      ],
      "consumers": [],
      "distinctModules": [
        "mirror-learning-shell"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.mirror.world-genome-candidate-set/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "governed-evolution-lab"
      ],
      "distinctModules": [
        "governed-evolution-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.model-evaluation/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "ai-team",
        "duo-test",
        "model-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "ai-team",
        "duo-test",
        "model-lab"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.model-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "hermes-local"
      ],
      "distinctModules": [
        "hermes-local"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.model-response/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "hermes-local"
      ],
      "consumers": [],
      "distinctModules": [
        "hermes-local"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-bundle/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "module-contract-workbench"
      ],
      "consumers": [
        "module-installer"
      ],
      "distinctModules": [
        "module-contract-workbench",
        "module-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-candidate/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "forge-line"
      ],
      "consumers": [],
      "distinctModules": [
        "forge-line"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-contract-validation/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "module-contract-workbench"
      ],
      "consumers": [],
      "distinctModules": [
        "module-contract-workbench"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-contract/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "module-contract-workbench"
      ],
      "distinctModules": [
        "module-contract-workbench"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-install-candidate/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "module-installer"
      ],
      "consumers": [],
      "distinctModules": [
        "module-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-install-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "module-installer"
      ],
      "consumers": [],
      "distinctModules": [
        "module-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-manifest/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "module-contract-workbench"
      ],
      "distinctModules": [
        "module-contract-workbench"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.module-rollback-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "module-installer"
      ],
      "consumers": [],
      "distinctModules": [
        "module-installer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.multiplayer-session-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "multiplayer-controller-transport"
      ],
      "consumers": [],
      "distinctModules": [
        "multiplayer-controller-transport"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.novelty-candidate-set/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "novelty-diversity-engine"
      ],
      "distinctModules": [
        "novelty-diversity-engine"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.novelty-experiment/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "novelty-diversity-engine"
      ],
      "consumers": [],
      "distinctModules": [
        "novelty-diversity-engine"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.output-job/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "publish-library"
      ],
      "distinctModules": [
        "publish-library"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.permission-decision-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "secrets-permissions-console"
      ],
      "distinctModules": [
        "secrets-permissions-console"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.permission-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "secrets-permissions-console"
      ],
      "consumers": [],
      "distinctModules": [
        "secrets-permissions-console"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.plugin-distribution-proposal/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "marketplace-deployment"
      ],
      "consumers": [],
      "distinctModules": [
        "marketplace-deployment"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.project-room/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "project-room"
      ],
      "distinctModules": [
        "project-room"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.project-room/v2",
      "state": "PRODUCER_ONLY",
      "providers": [
        "project-room"
      ],
      "consumers": [],
      "distinctModules": [
        "project-room"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.prompt/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "prompt-vault"
      ],
      "consumers": [
        "ai-team",
        "model-lab",
        "prompt-vault"
      ],
      "distinctModules": [
        "ai-team",
        "model-lab",
        "prompt-vault"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ps2-asset-brief/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "ps2-asset-forge"
      ],
      "distinctModules": [
        "ps2-asset-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ps2-asset-candidate/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "ps2-asset-forge"
      ],
      "consumers": [],
      "distinctModules": [
        "ps2-asset-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.public-deployment-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "public-release-deployment-adapter"
      ],
      "consumers": [],
      "distinctModules": [
        "public-release-deployment-adapter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.publish-artifact/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "spatial-studio"
      ],
      "consumers": [
        "marketplace-deployment"
      ],
      "distinctModules": [
        "marketplace-deployment",
        "spatial-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.qa-device-evidence/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "browser-lan-hardware-qa-lab"
      ],
      "distinctModules": [
        "browser-lan-hardware-qa-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.qa-journey-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "browser-lan-hardware-qa-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "browser-lan-hardware-qa-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.reasoning-draft/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "reasoning-shell"
      ],
      "consumers": [],
      "distinctModules": [
        "reasoning-shell"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.recovery-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "recovery-center"
      ],
      "distinctModules": [
        "recovery-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.recovery-restore-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "recovery-center"
      ],
      "consumers": [],
      "distinctModules": [
        "recovery-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.recovery-snapshot/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "recovery-center"
      ],
      "consumers": [],
      "distinctModules": [
        "recovery-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.release-candidate/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "publish-library"
      ],
      "consumers": [
        "public-release-deployment-adapter"
      ],
      "distinctModules": [
        "public-release-deployment-adapter",
        "publish-library"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.release-manifest/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "marketplace-deployment"
      ],
      "distinctModules": [
        "marketplace-deployment"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-candidate/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "review-inbox"
      ],
      "distinctModules": [
        "review-inbox"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-decision/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "review-inbox"
      ],
      "consumers": [],
      "distinctModules": [
        "review-inbox"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-discussion/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "review-inbox"
      ],
      "consumers": [],
      "distinctModules": [
        "review-inbox"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-item/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "workshop-direction"
      ],
      "consumers": [
        "judgement-chamber"
      ],
      "distinctModules": [
        "judgement-chamber",
        "workshop-direction"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-receipt/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "review-inbox"
      ],
      "consumers": [
        "module-installer"
      ],
      "distinctModules": [
        "module-installer",
        "review-inbox"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.review-vote/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "judgement-chamber",
        "workshop-command-center"
      ],
      "consumers": [],
      "distinctModules": [
        "judgement-chamber",
        "workshop-command-center"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.route-resume/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "route"
      ],
      "consumers": [],
      "distinctModules": [
        "route"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.route/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "route"
      ],
      "distinctModules": [
        "route"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.secret-metadata/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "secrets-permissions-console"
      ],
      "consumers": [],
      "distinctModules": [
        "secrets-permissions-console"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.secret-write-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "secrets-permissions-console"
      ],
      "distinctModules": [
        "secrets-permissions-console"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.signed-public-release/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "public-release-deployment-adapter"
      ],
      "consumers": [],
      "distinctModules": [
        "public-release-deployment-adapter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.skin/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "skinner"
      ],
      "consumers": [
        "skinner"
      ],
      "distinctModules": [
        "skinner"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.software-proposal/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "agent-tool-forge"
      ],
      "consumers": [],
      "distinctModules": [
        "agent-tool-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.source-query/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "source-connector-hub"
      ],
      "distinctModules": [
        "source-connector-hub"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.source-snapshot/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "source-connector-hub"
      ],
      "consumers": [],
      "distinctModules": [
        "source-connector-hub"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.spatial.project/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "spatial-studio"
      ],
      "consumers": [
        "spatial-studio"
      ],
      "distinctModules": [
        "spatial-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.spatial.scene/v1",
      "state": "SELF_LOOP_ONLY",
      "providers": [
        "spatial-studio"
      ],
      "consumers": [
        "spatial-studio"
      ],
      "distinctModules": [
        "spatial-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.specialist-package/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "agent-tool-forge"
      ],
      "consumers": [],
      "distinctModules": [
        "agent-tool-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.studio-asset/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "game-forge"
      ],
      "distinctModules": [
        "game-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.studio-project/v2",
      "state": "PRODUCER_ONLY",
      "providers": [
        "studio"
      ],
      "consumers": [],
      "distinctModules": [
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.target-canvas/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "asset-fabric",
        "studio"
      ],
      "distinctModules": [
        "asset-fabric",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.technical-focus/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "technical-glasses"
      ],
      "distinctModules": [
        "technical-glasses"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.technical-glasses/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "technical-glasses"
      ],
      "consumers": [],
      "distinctModules": [
        "technical-glasses"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.template-pack/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "template-runtime-pack-engine"
      ],
      "distinctModules": [
        "template-runtime-pack-engine"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.template-render-receipt/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "template-runtime-pack-engine"
      ],
      "consumers": [],
      "distinctModules": [
        "template-runtime-pack-engine"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.test-plan/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "hub-test-room",
        "runner",
        "verifier"
      ],
      "distinctModules": [
        "hub-test-room",
        "runner",
        "verifier"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.test-result/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "hub-test-room",
        "runner"
      ],
      "consumers": [],
      "distinctModules": [
        "hub-test-room",
        "runner"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.tool-proposal/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "forge"
      ],
      "consumers": [
        "forge-line"
      ],
      "distinctModules": [
        "forge",
        "forge-line"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ui-brief/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "ui-ux-builder"
      ],
      "distinctModules": [
        "ui-ux-builder"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.ui-proposal/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "ui-ux-builder"
      ],
      "consumers": [],
      "distinctModules": [
        "ui-ux-builder"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.update-feed-proposal/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "marketplace-deployment"
      ],
      "consumers": [],
      "distinctModules": [
        "marketplace-deployment"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.verification-report/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "verifier"
      ],
      "consumers": [],
      "distinctModules": [
        "verifier"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-command-center.snapshot/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "workshop-command-center"
      ],
      "consumers": [],
      "distinctModules": [
        "workshop-command-center"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-continue/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "project-room"
      ],
      "consumers": [],
      "distinctModules": [
        "project-room"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-direction.hand-request/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "workshop-direction"
      ],
      "consumers": [],
      "distinctModules": [
        "workshop-direction"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-direction.plan/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "judgement-chamber",
        "workshop-command-center",
        "workshop-direction"
      ],
      "consumers": [
        "evolution-foundry"
      ],
      "distinctModules": [
        "evolution-foundry",
        "judgement-chamber",
        "workshop-command-center",
        "workshop-direction"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-direction.request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "judgement-chamber",
        "workshop-command-center",
        "workshop-direction"
      ],
      "distinctModules": [
        "judgement-chamber",
        "workshop-command-center",
        "workshop-direction"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-direction.steward-assessment/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "workshop-command-center",
        "workshop-direction"
      ],
      "consumers": [],
      "distinctModules": [
        "workshop-command-center",
        "workshop-direction"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-package-request/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "workshop-packager"
      ],
      "distinctModules": [
        "workshop-packager"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-package/v1",
      "state": "EXACTLY_WIRED",
      "providers": [
        "publish-library",
        "workshop-packager"
      ],
      "consumers": [
        "marketplace-deployment",
        "recovery-center"
      ],
      "distinctModules": [
        "marketplace-deployment",
        "publish-library",
        "recovery-center",
        "workshop-packager"
      ],
      "multiProvider": true,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-search-query/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "workshop-search-provenance"
      ],
      "distinctModules": [
        "workshop-search-provenance"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop-search-results/v1",
      "state": "PRODUCER_ONLY",
      "providers": [
        "workshop-search-provenance"
      ],
      "consumers": [],
      "distinctModules": [
        "workshop-search-provenance"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "axm.workshop.codex-goal-completion-receipt/v1",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "CALIBRATION_COMPARISON_RECEIPT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-calibration-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-calibration-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "COGNITIVE_EVIDENCE_BUNDLE",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "COGNITIVE_EVIDENCE_LAB_RECORD",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-evidence-explorer"
      ],
      "distinctModules": [
        "cognitive-evidence-explorer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "COGNITIVE_RESOURCE_LEDGER_RECEIPT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "COGNITIVE_WORK_OBSERVATION_DRAFT",
      "state": "EXACTLY_WIRED",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [
        "cognitive-calibration-lab"
      ],
      "distinctModules": [
        "cognitive-calibration-lab",
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "DECLARED_RESOURCE_PREDICTION_INTERVAL",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-calibration-lab"
      ],
      "distinctModules": [
        "cognitive-calibration-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "DIRECT_POWER_METER_OBSERVATION",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "sustainability-metrology-lab"
      ],
      "distinctModules": [
        "sustainability-metrology-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "EXPLICIT_LOCAL_METER_WINDOW",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "image/*",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "film-motion-studio",
        "studio"
      ],
      "distinctModules": [
        "film-motion-studio",
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "image/jpeg",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "claude-connector"
      ],
      "distinctModules": [
        "claude-connector"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "image/png",
      "state": "EXACTLY_WIRED",
      "providers": [
        "film-motion-studio",
        "spatial-studio",
        "studio"
      ],
      "consumers": [
        "chatgpt-connector"
      ],
      "distinctModules": [
        "chatgpt-connector",
        "film-motion-studio",
        "spatial-studio",
        "studio"
      ],
      "multiProvider": true,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "image/svg+xml",
      "state": "PRODUCER_ONLY",
      "providers": [
        "studio"
      ],
      "consumers": [],
      "distinctModules": [
        "studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "LOCAL_HARDWARE_RATE_SCHEDULE",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "midi",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "audio-studio"
      ],
      "distinctModules": [
        "audio-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "MIRROR_INTAKE_RECEIPT",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "mirror-intake-monitor"
      ],
      "distinctModules": [
        "mirror-intake-monitor"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "model/gltf-binary",
      "state": "PRODUCER_ONLY",
      "providers": [
        "ps2-asset-forge"
      ],
      "consumers": [],
      "distinctModules": [
        "ps2-asset-forge"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "model/obj",
      "state": "PRODUCER_ONLY",
      "providers": [
        "spatial-studio"
      ],
      "consumers": [],
      "distinctModules": [
        "spatial-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "multipart/form-data",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "device-handoff"
      ],
      "distinctModules": [
        "device-handoff"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "OPTED_IN_ATTENTION_OBSERVATION",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "human-attention-ledger"
      ],
      "distinctModules": [
        "human-attention-ledger"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "plain-text/task-focus",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "technical-glasses"
      ],
      "distinctModules": [
        "technical-glasses"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "PRIVACY_SAFE_MACHINE_PROFILE",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "PRIVACY_SAFE_MACHINE_PROFILE_DIGEST",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "PROVIDER_COMPUTE_TELEMETRY",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "PROVIDER_GOAL_RUN_RECEIPT",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "PSEUDONYMOUS_ATTENTION_RECEIPT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "human-attention-ledger"
      ],
      "consumers": [],
      "distinctModules": [
        "human-attention-ledger"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "READ_ONLY_COGNITIVE_EVIDENCE_VIEW",
      "state": "PRODUCER_ONLY",
      "providers": [
        "cognitive-evidence-explorer"
      ],
      "consumers": [],
      "distinctModules": [
        "cognitive-evidence-explorer"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "SEPARATE_DIMENSION_RESOURCE_TIMELINE",
      "state": "EXACTLY_WIRED",
      "providers": [
        "cognitive-resource-meter"
      ],
      "consumers": [
        "cognitive-evidence-explorer"
      ],
      "distinctModules": [
        "cognitive-evidence-explorer",
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "SUSTAINABILITY_ATTESTATION",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "sustainability-metrology-lab"
      ],
      "distinctModules": [
        "sustainability-metrology-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "SUSTAINABILITY_METROLOGY_RECEIPT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "sustainability-metrology-lab"
      ],
      "consumers": [],
      "distinctModules": [
        "sustainability-metrology-lab"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "text/csv",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "finance-world-room",
        "geographic-market-map",
        "knowledge-canvas"
      ],
      "distinctModules": [
        "finance-world-room",
        "geographic-market-map",
        "knowledge-canvas"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "text/plain",
      "state": "EXACTLY_WIRED",
      "providers": [
        "prehub"
      ],
      "consumers": [
        "chatgpt-connector",
        "discovery-engine",
        "evidence-desk",
        "forge",
        "graft",
        "prehub",
        "prompt-vault",
        "workshop-search-provenance"
      ],
      "distinctModules": [
        "chatgpt-connector",
        "discovery-engine",
        "evidence-desk",
        "forge",
        "graft",
        "prehub",
        "prompt-vault",
        "workshop-search-provenance"
      ],
      "multiProvider": false,
      "multiConsumer": true,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "text/plain/ai-technical-briefing",
      "state": "PRODUCER_ONLY",
      "providers": [
        "technical-glasses"
      ],
      "consumers": [],
      "distinctModules": [
        "technical-glasses"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "VERSIONED_PROVIDER_RATE_SCHEDULE",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "cognitive-resource-meter"
      ],
      "distinctModules": [
        "cognitive-resource-meter"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "video/*",
      "state": "CONSUMER_ONLY",
      "providers": [],
      "consumers": [
        "film-motion-studio"
      ],
      "distinctModules": [
        "film-motion-studio"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    },
    {
      "schema": "axm.handoff-artifact-record/v1",
      "artifact": "WORKSHOP_MIRROR_INTAKE_STATUS_RECEIPT",
      "state": "PRODUCER_ONLY",
      "providers": [
        "mirror-intake-monitor"
      ],
      "consumers": [],
      "distinctModules": [
        "mirror-intake-monitor"
      ],
      "multiProvider": false,
      "multiConsumer": false,
      "truth": {
        "exactStringMatchOnly": true,
        "wildcardCompatibilityInferred": false,
        "semanticCompatibilityInferred": false,
        "multiProviderCalledCollision": false,
        "runtimeReadinessInferred": false
      }
    }
  ],
  "relations": [
    {
      "artifact": "audio/*",
      "provider": "audio-studio",
      "consumer": "audio-studio",
      "self": true
    },
    {
      "artifact": "audio/*",
      "provider": "audio-studio",
      "consumer": "film-motion-studio",
      "self": false
    },
    {
      "artifact": "axm.ai-learning.session-proposal/v1",
      "provider": "learning-lab",
      "consumer": "mirror-learning-shell",
      "self": false
    },
    {
      "artifact": "axm.asset-fabric.candidate/v1",
      "provider": "asset-fabric",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.asset-handoff/v1",
      "provider": "asset-vault",
      "consumer": "audio-studio",
      "self": false
    },
    {
      "artifact": "axm.asset-handoff/v1",
      "provider": "asset-vault",
      "consumer": "publish-library",
      "self": false
    },
    {
      "artifact": "axm.asset-handoff/v1",
      "provider": "asset-vault",
      "consumer": "studio",
      "self": false
    },
    {
      "artifact": "axm.body-pulse.lease/v1",
      "provider": "body-pulse",
      "consumer": "asset-fabric",
      "self": false
    },
    {
      "artifact": "axm.body-pulse.lease/v1",
      "provider": "body-pulse",
      "consumer": "governed-evolution-lab",
      "self": false
    },
    {
      "artifact": "axm.body-pulse.receipt/v1",
      "provider": "body-pulse",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.deployment-plan/v1",
      "provider": "marketplace-deployment",
      "consumer": "publish-library",
      "self": false
    },
    {
      "artifact": "axm.discord.proposal/v1",
      "provider": "discord-bridge",
      "consumer": "discord-bridge",
      "self": true
    },
    {
      "artifact": "axm.discovery-lab.bundle/0.1",
      "provider": "discovery-engine",
      "consumer": "discovery-engine",
      "self": true
    },
    {
      "artifact": "axm.game-forge-project/v1",
      "provider": "game-forge",
      "consumer": "game-forge",
      "self": true
    },
    {
      "artifact": "axm.game-forge-project/v1",
      "provider": "game-forge",
      "consumer": "sandbox",
      "self": false
    },
    {
      "artifact": "axm.governed-evolution.receipt/v1",
      "provider": "governed-evolution-lab",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.hub-state/v1",
      "provider": "main-hub",
      "consumer": "main-hub",
      "self": true
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "discovery-engine",
      "consumer": "knowledge-canvas",
      "self": false
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "discovery-engine",
      "consumer": "project-room",
      "self": false
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "evidence-desk",
      "consumer": "knowledge-canvas",
      "self": false
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "evidence-desk",
      "consumer": "project-room",
      "self": false
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "knowledge-canvas",
      "consumer": "knowledge-canvas",
      "self": true
    },
    {
      "artifact": "axm.knowledge-project-handoff/v1",
      "provider": "knowledge-canvas",
      "consumer": "project-room",
      "self": false
    },
    {
      "artifact": "axm.learning-lab.project/v1",
      "provider": "learning-lab",
      "consumer": "learning-lab",
      "self": true
    },
    {
      "artifact": "axm.living-world.snapshot/v1",
      "provider": "living-world-state-server",
      "consumer": "living-world-ruleset-physics-adapter-kit",
      "self": false
    },
    {
      "artifact": "axm.marketplace-listing/v1",
      "provider": "marketplace-deployment",
      "consumer": "publish-library",
      "self": false
    },
    {
      "artifact": "axm.module-bundle/v1",
      "provider": "module-contract-workbench",
      "consumer": "module-installer",
      "self": false
    },
    {
      "artifact": "axm.prompt/v1",
      "provider": "prompt-vault",
      "consumer": "ai-team",
      "self": false
    },
    {
      "artifact": "axm.prompt/v1",
      "provider": "prompt-vault",
      "consumer": "model-lab",
      "self": false
    },
    {
      "artifact": "axm.prompt/v1",
      "provider": "prompt-vault",
      "consumer": "prompt-vault",
      "self": true
    },
    {
      "artifact": "axm.publish-artifact/v1",
      "provider": "spatial-studio",
      "consumer": "marketplace-deployment",
      "self": false
    },
    {
      "artifact": "axm.release-candidate/v1",
      "provider": "publish-library",
      "consumer": "public-release-deployment-adapter",
      "self": false
    },
    {
      "artifact": "axm.review-item/v1",
      "provider": "workshop-direction",
      "consumer": "judgement-chamber",
      "self": false
    },
    {
      "artifact": "axm.review-receipt/v1",
      "provider": "review-inbox",
      "consumer": "module-installer",
      "self": false
    },
    {
      "artifact": "axm.skin/v1",
      "provider": "skinner",
      "consumer": "skinner",
      "self": true
    },
    {
      "artifact": "axm.spatial.project/v1",
      "provider": "spatial-studio",
      "consumer": "spatial-studio",
      "self": true
    },
    {
      "artifact": "axm.spatial.scene/v1",
      "provider": "spatial-studio",
      "consumer": "spatial-studio",
      "self": true
    },
    {
      "artifact": "axm.tool-proposal/v1",
      "provider": "forge",
      "consumer": "forge-line",
      "self": false
    },
    {
      "artifact": "axm.workshop-direction.plan/v1",
      "provider": "judgement-chamber",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.workshop-direction.plan/v1",
      "provider": "workshop-command-center",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.workshop-direction.plan/v1",
      "provider": "workshop-direction",
      "consumer": "evolution-foundry",
      "self": false
    },
    {
      "artifact": "axm.workshop-package/v1",
      "provider": "publish-library",
      "consumer": "marketplace-deployment",
      "self": false
    },
    {
      "artifact": "axm.workshop-package/v1",
      "provider": "publish-library",
      "consumer": "recovery-center",
      "self": false
    },
    {
      "artifact": "axm.workshop-package/v1",
      "provider": "workshop-packager",
      "consumer": "marketplace-deployment",
      "self": false
    },
    {
      "artifact": "axm.workshop-package/v1",
      "provider": "workshop-packager",
      "consumer": "recovery-center",
      "self": false
    },
    {
      "artifact": "COGNITIVE_WORK_OBSERVATION_DRAFT",
      "provider": "cognitive-resource-meter",
      "consumer": "cognitive-calibration-lab",
      "self": false
    },
    {
      "artifact": "image/png",
      "provider": "film-motion-studio",
      "consumer": "chatgpt-connector",
      "self": false
    },
    {
      "artifact": "image/png",
      "provider": "spatial-studio",
      "consumer": "chatgpt-connector",
      "self": false
    },
    {
      "artifact": "image/png",
      "provider": "studio",
      "consumer": "chatgpt-connector",
      "self": false
    },
    {
      "artifact": "SEPARATE_DIMENSION_RESOURCE_TIMELINE",
      "provider": "cognitive-resource-meter",
      "consumer": "cognitive-evidence-explorer",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "chatgpt-connector",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "discovery-engine",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "evidence-desk",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "forge",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "graft",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "prehub",
      "self": true
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "prompt-vault",
      "self": false
    },
    {
      "artifact": "text/plain",
      "provider": "prehub",
      "consumer": "workshop-search-provenance",
      "self": false
    }
  ],
  "truth": {
    "exactArtifactStringsOnly": true,
    "schemaNamesNormalized": false,
    "wildcardCompatibilityInferred": false,
    "semanticCompatibilityInferred": false,
    "automaticAdaptersGenerated": false,
    "automaticRewirePerformed": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "installationPerformed": false,
    "permissionChanged": false,
    "rollbackChanged": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
