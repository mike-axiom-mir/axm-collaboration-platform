'use strict';
window.AXM_DUAL_DOOR_MAP = {
  "schema": "axm.dual-door-map\u002fv1",
  "version": "v0.2",
  "measuredAt": "2026-07-27T03:47:14.265Z",
  "freshnessTtlMs": 7200000,
  "source": {
    "label": "axm-workshop-v4",
    "fingerprint": "18a4bc21ef10e80a8f8171a8e4946bbfb7fcda3ded6782691b0f5f09cf2b8e01",
    "filesRead": 81,
    "symlinksFollowed": false,
    "skippedSymlinks": []
  },
  "summary": {
    "modules": 81,
    "humanDoorsDeclared": 81,
    "humanDoorsPresent": 81,
    "humanDoorIssues": 0,
    "machineDoorsDeclared": 2,
    "machineDoorsPresent": 2,
    "machineDoorsOptionalNotDeclared": 79,
    "machineDoorIssues": 0,
    "machineActionDeclarations": 10,
    "machineActionStringArrays": 1,
    "machineActionObjectMaps": 1,
    "readIssues": 0
  },
  "modules": [
    {
      "id": "agent-command-center",
      "folder": "agent-command-center",
      "version": "v0.4",
      "status": "TEST",
      "manifestSha256": "69df8d8121c9c7b07ba0000a18da022a3a0878b4945d99c659738510b58fddb4",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 13732,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "agent-tool-forge",
      "folder": "agent-tool-forge",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "200cf78db759e8c83f29bbd576ebc1db27ce35370c4672274e74365d331fe74e",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 14456,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": true,
        "optionalAbsence": false,
        "entry": {
          "declared": true,
          "path": "machine.js",
          "state": "PRESENT",
          "bytes": 1673
        },
        "status": "TEST",
        "apiVersion": "1.0",
        "effect": "draft-only",
        "actionShape": "STRING_ARRAY",
        "actions": [
          {
            "id": "draft.create",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "draft.inspect",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "draft.package",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "draft.render",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "draft.update",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "draft.validate",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "parts.list",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          },
          {
            "id": "templates.list",
            "declarationShape": "STRING_ID",
            "descriptionDeclared": false,
            "effectDeclared": false,
            "inputSchemaDeclared": false
          }
        ],
        "forbidden": [
          "canonize",
          "delete",
          "execute",
          "install",
          "overwrite",
          "promote"
        ],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "ai-task-talk",
      "folder": "ai-task-talk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f48a2f106a3c30144a984d0512594db06314679e26655fc8272c3f4fbff21a7c",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 33968,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "ai-team",
      "folder": "ai-team",
      "version": "v1.6",
      "status": "TEST",
      "manifestSha256": "ec9967ed3fc242da4999ab2c9fefb6f1e88de1b0d4232f12c4d6e05a57c31343",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 22209,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "asset-fabric",
      "folder": "asset-fabric",
      "version": "v0.9",
      "status": "EXPERIMENTAL",
      "manifestSha256": "39820dc432c5557767641b2faa93035cbc6f6da749a2d61e69cc97c2930f1dd0",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 18279,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "asset-filesystem-service",
      "folder": "asset-filesystem-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "fe8d5c9a7c817134d1f7a3633a6085ef683fd9d5c9d6db5c80fa2ea497b88f57",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1632,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "asset-pack-lab",
      "folder": "asset-pack-lab",
      "version": "v0_1",
      "status": "TEST",
      "manifestSha256": "0e6d937903d85af1c353caaa579cb1a166b8883415a92d078552e1768fa7d6e0",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 4472,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "asset-vault",
      "folder": "asset-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "0093d3c66fb9b32235d5ce0912357216c7c19e149c6e1816a97a302a090354c7",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 35183,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "audio-studio",
      "folder": "audio-studio",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "dcb77280455c850add26e05b203fe27b7e229d78c7bc73ff7a7dd0f745aba6b8",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 10231,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "body-pulse",
      "folder": "body-pulse",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "db55e7ebe04861ea16c590169e74346eb10ddeb8167a9700efa470483fe85c70",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 4384,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "browser-lan-hardware-qa-lab",
      "folder": "browser-lan-hardware-qa-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b0863665551424f6c0bfb4750efeaff3c1a84774076ab7bb36126b709a964ae9",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1503,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "chatgpt-connector",
      "folder": "chatgpt-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f7332d743398d4bdf9a645c655b7981b43c4c10538d590e67f88c1163a8a377a",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 6848,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "claude-connector",
      "folder": "claude-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a425c016edf3d7eff94328fbfc8ceab16d13f63541c7ee97cc0d27c8066790b2",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 4659,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "cognitive-calibration-lab",
      "folder": "cognitive-calibration-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2aabc53b7712e49a7343f8fb29351553f030e0093a852c4d2d6134ec63dd7db5",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1860,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "cognitive-evidence-explorer",
      "folder": "cognitive-evidence-explorer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "ceb9e0ae81a31e168ed3dd5007e305a743b5f49589a9e591b1fd6becb44c8355",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1440,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "cognitive-resource-meter",
      "folder": "cognitive-resource-meter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ba30cc5ef82fb6c75357d435d33106d4687c7d5a66e35480741638743c289a1",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7928,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "device-handoff",
      "folder": "device-handoff",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "121fc27bc7b8b055a70b70ca86c178d1616a313d34a3bf1bdc64636fb5dbf27a",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2078,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "diagnostics-operations-center",
      "folder": "diagnostics-operations-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b8e73dfaf90bb079fd8c1b0dbbcfb1f24c2bc1dac692c81b2e79ef6bd297958f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2024,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "discord-bridge",
      "folder": "discord-bridge",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b7c89071e4b2e1f0308014e8d2233518896e3be0e72dc92689b0d48c9c9104f6",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7851,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "discovery-engine",
      "folder": "discovery-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "52410d815be87e3c28519b7e31c0f843d0190e75dad6dcf86e29466458e046f8",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 76283,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "duo-test",
      "folder": "duo-test",
      "version": "v3",
      "status": "TEST",
      "manifestSha256": "897f42ecbe7381c932209e1dbb6602b7b0d74343f7535d2c879e2e94933acfb8",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 5387,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "evidence-desk",
      "folder": "evidence-desk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "010e29cd34b47ede7679f7b5c72ab74ee71b43d987d18d4ed57e68df7ac87e92",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 13299,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": true,
        "optionalAbsence": false,
        "entry": {
          "declared": true,
          "path": "machine.js",
          "state": "PRESENT",
          "bytes": 1304
        },
        "status": "TEST",
        "apiVersion": "1.0",
        "effect": null,
        "actionShape": "OBJECT_MAP",
        "actions": [
          {
            "id": "build",
            "declarationShape": "OBJECT_DECLARATION",
            "descriptionDeclared": true,
            "effectDeclared": true,
            "inputSchemaDeclared": true
          },
          {
            "id": "validate",
            "declarationShape": "OBJECT_DECLARATION",
            "descriptionDeclared": true,
            "effectDeclared": true,
            "inputSchemaDeclared": true
          }
        ],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "evolution-foundry",
      "folder": "evolution-foundry",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "f903daddad720a6a9a592324098a0f80053ed41fbef898d2a66fcc4853911f0f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3231,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "film-motion-studio",
      "folder": "film-motion-studio",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "1f21c86ff30928ae2b0a44e5656ee23c579bb4be691ea3c11dfa50d8bbe7c14c",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 15928,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "finance-world-room",
      "folder": "finance-world-room",
      "version": "v0.1-experimental",
      "status": "EXPERIMENTAL",
      "manifestSha256": "6149787ea95bb84b3e1daee9208895519e12057a66717a33b7118664e0bacdfb",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 8457,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "forge",
      "folder": "forge",
      "version": "v1",
      "status": "TEST",
      "manifestSha256": "2091a1a62f14fcf07bfa8bad509f7e8fe742b8a82c1ce4d52bacf91dd829a591",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 9891,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "forge-line",
      "folder": "forge-line",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3c938ff93a2f00b5b7bf33c6b31ed1d04eec02d36f4cd14b73bb2007e9529d29",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7450,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "foundation-intake-steward",
      "folder": "foundation-intake-steward",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3311a72239053bfecd476ae0bf3f3eeba93fa422d41f68ba0e13097d8ac3d8a4",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2419,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "game-forge",
      "folder": "game-forge",
      "version": "v1.2",
      "status": "TEST",
      "manifestSha256": "a67e304216a7b62ee78fd7efd4eb25ac9460f56f1457a600ff728f74a54af0fe",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 15325,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "game-hub",
      "folder": "game-hub",
      "version": "v0.4",
      "status": "TEST",
      "manifestSha256": "58bb348ce231e097cfa2e89e77e48a490988f2b81bf77ca297d031139264e797",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3841,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "geographic-market-map",
      "folder": "geographic-market-map",
      "version": "v0.1-polished-review",
      "status": "EXPERIMENTAL",
      "manifestSha256": "ecaa4efa23fe43841d74e708fe85b0325cae480c312970b35e81917c68d40521",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 14861,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "governed-evolution-lab",
      "folder": "governed-evolution-lab",
      "version": "v0.1.1-epoch",
      "status": "EXPERIMENTAL",
      "manifestSha256": "20035ea582af41af85a82db8641ce4bd12aa1075fbf072fb122a084c5ff539cf",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 6132,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "graft",
      "folder": "graft",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "31c10f7032c1cf4b88e15d111cffe414410bec661afc87a35394dfafc6c9808e",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 8867,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "hermes-local",
      "folder": "hermes",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3553916184c1f5d08e0757024e79e4dfc99ec8a9af4dd1a5949943461a2d1d21",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3560,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "hub-test-room",
      "folder": "hub-test-room",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "b04a50f1a79b91a3b1ffcbcee3eccf17e3a2cfe314637ee7d7ebf8fd75e2efe1",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7398,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "human-attention-ledger",
      "folder": "human-attention-ledger",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "1178063e1b19785606f974a387900ce9700c2c475bb929feb8d47795a6496d28",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1819,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "judgement-chamber",
      "folder": "judgement-chamber",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "9f84c4e43c61e330e68131739898316c992da2f50fbf6077c9fc90867aeb0f12",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 8625,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "knowledge-canvas",
      "folder": "knowledge-canvas",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "a17fdba57fc8f99d565d0d8ca4e95c21da00348fb5214eda988c73a8ebdd510f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 10394,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "launcher-card-installer",
      "folder": "launcher-card-installer",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "312b3f8f5817eeee290ff9ede16842b0dc494c31c9908ecb61c0f19c2cdfbda4",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 6999,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "learning-lab",
      "folder": "learning-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f2f189c429c283b66000ac31591bc31f06431a087104e7ea761a366a3095f8d8",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 16861,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "living-world-ruleset-physics-adapter-kit",
      "folder": "living-world-ruleset-physics-adapter-kit",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "e769d0297e27974466e26d113e04dee3a830257059ba8cb0e98315efcd3d74e4",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1621,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "living-world-state-server",
      "folder": "living-world-state-server",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "c5a5fc7a9d4795603413d45a6233ce47f37461af04eb279b3b13ae086b8135f0",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 4006,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "machine-host",
      "folder": "machine-host",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3a2f14eeb215ba5ccd460dc4735d8927bd33ff37787921bb6b016b1f4d3d4138",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1754,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "main-hub",
      "folder": "main-hub",
      "version": "v0.1",
      "status": "SHELL",
      "manifestSha256": "568965995d855a9a5d9e6f75e6df4bf237afb18fb95f19e17e2b6eb7d82b77b3",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3498,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "marketplace-deployment",
      "folder": "marketplace-deployment",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "28787e3e870446ae08fd977c241a817b473dabf7cf02f093fa9f94960ffd960f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 15884,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "media-render-transcode-service",
      "folder": "media-render-transcode-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "753ff72e597a6e4e40b153d85d12a5d2b28c15c3ca5fdd8491456f4d484feafc",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2116,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "mirror-intake-monitor",
      "folder": "mirror-intake-monitor",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "491446d13cd39708714a2c365c17bd64353d7d98230822a3809f50a3ef02d198",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1759,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "mirror-learning-shell",
      "folder": "mirror-learning-shell",
      "version": "v0.2-shared-door",
      "status": "TEST",
      "manifestSha256": "007e91010eaaf7ee72030fb644a3229d5902b8857f1069f432646ebbb3982dfb",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2940,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "model-lab",
      "folder": "model-lab",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "3d8c88c29e6fb6846149968af60c265622f469c6053167961131bf069a977941",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 17104,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "module-contract-workbench",
      "folder": "module-contract-workbench",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2cb41adf26848d530bd6d6b77da1f39e6ff8fe79f6e5a385d85008688365092a",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1901,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "module-installer",
      "folder": "module-installer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "39c0969090ff3c4655dcf712c521d06e477d1fd1c738cc1f34fa5ec7b100b3eb",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2589,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "multiplayer-controller-transport",
      "folder": "multiplayer-controller-transport",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9525ff047b7f8454dc85c0335230e6a09cef33363e85c302e1b4b072fc006ca9",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1635,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "novelty-diversity-engine",
      "folder": "novelty-diversity-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "7fbc62a2ff53d950e2f2488ddeec22952e1da99b2d10097ae9b94aa5c7cd25af",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1707,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "prehub",
      "folder": "prehub",
      "version": "v1",
      "status": "WORKING",
      "manifestSha256": "2be9d79a9107d71a3dbe5d47d7a447bdc9354ed36acc887fc6913dc904342d8f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 5917,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "project-room",
      "folder": "project-room",
      "version": "v0.3",
      "status": "TEST",
      "manifestSha256": "585e18a82d88561227b2348a58af6419febb7590230d09d177fa16af80e16bc9",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 15542,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "prompt-vault",
      "folder": "prompt-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "43595589df949012ab9a4c76d91cf32673223fb796d66ae4c95e70dec491cbac",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 28982,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "ps2-asset-forge",
      "folder": "ps2-asset-forge",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "dc9e11e38f0fd53717d384fdf713cace6b5ed52ce8e0f86189058b1aed9803bf",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7657,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "public-release-deployment-adapter",
      "folder": "public-release-deployment-adapter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "30223dfa7d71b124d00ec9d9eb252d621704cd9e8be531710943ab0749c02009",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1851,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "publish-library",
      "folder": "publish-library",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "09e2a23c12442583df76e4dbb6f3b9006a29437853ef62ca4f13a27153e2fe34",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 9923,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "read-only-mirror-world-adapter",
      "folder": "read-only-mirror-world-adapter",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "5f9d51195a1d4e27f6cc6847a659aa080fd64de20f13008db10560fe5dbce17e",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1623,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "reasoning-shell",
      "folder": "reasoning-shell",
      "version": "v0.1-branch",
      "status": "TEST",
      "manifestSha256": "edbb3418123c90d7be4dd9693e328a60efeb0fc6e6781f010b05cf1acdea9528",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 11847,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "recovery-center",
      "folder": "recovery-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5561fe713f07b5dcaa8b452970ca0b71bc1ef6e2099212b85ca65892a2145b44",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2744,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "review-inbox",
      "folder": "review-inbox",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "6dafb4a9d20580a353cac6559c6f08f147508f4397a05f5f9d53776a7d3c3306",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1892,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "route",
      "folder": "route",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a27d7be754746910d4af1e46f21a51f1d8b3004926ca8a5b0d356cf9feee67cb",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 19714,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "runner",
      "folder": "runner",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "9f3c3402cec092448476066027a7eda85ec15335c5816966bdefc0632b3b4285",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3835,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "sandbox",
      "folder": "sandbox",
      "version": "v0.1-session1",
      "status": "TEST",
      "manifestSha256": "d8834cad606c008760945a24eed2e5899b01c115c865eb8a1f0008790707fb57",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3770,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "secrets-permissions-console",
      "folder": "secrets-permissions-console",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "edb768d452c8c5d45b7c4f1db7269861c998d7b546554a2b579f794e9b2c9bdd",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 2835,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "shell-guardian",
      "folder": "shell-guardian",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5546920048530ec78a372b78b9457d8e1d4db67abaac37c7693c9f1f920e8511",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7339,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "skinner",
      "folder": "skinner",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "e279534e785c4fc6ddd54da6b59953c3113f727a2b9797b0e1f800fd81bd435f",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 24921,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "source-connector-hub",
      "folder": "source-connector-hub",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "db7e6c865e7af9b637893aa07626cb2dc24eec4e6037b57ee79e4f526d096387",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1885,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "spatial-studio",
      "folder": "spatial-studio",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "bf4b87c868e91acfa4f3e2cb4509bdb453cb7112d88a969e5f5cce411d0930ad",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 11825,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "studio",
      "folder": "studio",
      "version": "v2.5",
      "status": "TEST",
      "manifestSha256": "b61af3f4615f16750878725c984eb206620d59c02f65b83257ba351bbd4e5ec4",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 4298,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "sustainability-metrology-lab",
      "folder": "sustainability-metrology-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "77d7b2d3a7fb67892a31f7b2cc5d21c03329451321b83a845f1347a0aa5636b6",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1716,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "technical-glasses",
      "folder": "technical-glasses",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5a2930adf2f06184a1d0e1d496222802d8124203ee52403cf6e628c8172c463c",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3949,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "template-runtime-pack-engine",
      "folder": "template-runtime-pack-engine",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9f5f2f18a3a65a4fb6dbb7dfb1bf545682b37bf739e9fde5d1f5437996f0c96d",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1683,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "ui-ux-builder",
      "folder": "ui-ux-builder",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "c5a1e1484e2b10a69ffcd6ef61d52d79e61ac15d2da35d75783a346860e63df7",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 10397,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "verifier",
      "folder": "verifier",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "ee20bd953bec0a195f23278be712fd1ec4a921e936544c74768b078fe240c826",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 13780,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "workshop-command-center",
      "folder": "workshop-command-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ffa0ab48d7b25218328d710558cd5527650a1f313ccdb7ec2c99a55945084e9",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 11387,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "workshop-direction",
      "folder": "workshop-direction",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "8ca0ec56981b2c3571c7609fc1d1fc670b606c58db2f5d8f938d6b9a5a722d61",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 3915,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "workshop-packager",
      "folder": "workshop-packager",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "40d335d09d59946e418c19a777b157c003e71873dfe200877a832ce3a165bdd0",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 7200,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    },
    {
      "id": "workshop-search-provenance",
      "folder": "workshop-search-provenance",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "369328f81cf29263512294aeb8ac00c7ce171e1753e16e7f50a36414bfcfa9cd",
      "human": {
        "declared": true,
        "path": "index.html",
        "state": "PRESENT",
        "bytes": 1312,
        "kind": "HUMAN_WORKSPACE_ENTRY",
        "loadedOrRendered": false
      },
      "machine": {
        "declared": false,
        "optionalAbsence": true,
        "entry": {
          "declared": false,
          "path": null,
          "state": "NOT_DECLARED_OPTIONAL",
          "bytes": null
        },
        "status": null,
        "apiVersion": null,
        "effect": null,
        "actionShape": "NOT_DECLARED",
        "actions": [],
        "forbidden": [],
        "kind": "MACHINE_ACTION_ENTRY",
        "codeLoaded": false,
        "actionsExecuted": false
      }
    }
  ],
  "readIssues": [],
  "scopeBoundary": "Manifest-declared human and machine entry paths and machine action declaration shapes are inspected. Entry code is not loaded, UI is not rendered, and actions are not executed. A missing optional machine declaration is not classified as a defect.",
  "preservedOwners": {
    "humanRouting": "Hub and Capability Index",
    "machineExecution": "Machine Host",
    "actionSemantics": "declaring module owner",
    "readiness": "Technical Glasses",
    "permissions": "declared action and permission owners"
  },
  "truth": {
    "entryCodeLoaded": false,
    "humanDoorRendered": false,
    "machineActionExecuted": false,
    "routeProven": false,
    "actionSemanticsProven": false,
    "actionParityRequired": false,
    "readinessProven": false,
    "permissionGranted": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "installationPerformed": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
