'use strict';
window.AXM_DEPENDENCY_DECLARATION_MAP = {
  "schema": "axm.dependency-declaration-map/v1",
  "version": "v0.1",
  "measuredAt": "2026-07-27T02:16:29.698Z",
  "freshnessTtlMs": 7200000,
  "source": {
    "label": "axm-workshop-v4",
    "fingerprint": "3b5d5c76b8bc870eb20ac5a3b9f0ca5599dbcb68af8694e9717a00eed63ba55a",
    "filesRead": 134,
    "symlinksFollowed": false,
    "skippedSymlinks": []
  },
  "summary": {
    "modules": 81,
    "contractsPresent": 53,
    "contractUnknown": 28,
    "declarationOccurrences": 662,
    "exactModuleRelations": 93,
    "modulesInDeclaredCycles": 24,
    "declaredCycles": 4,
    "explicitTargetsNotTopLevelModules": 42,
    "genericTokensUninterpreted": 189,
    "duplicateManifestIds": 0,
    "readIssues": 0
  },
  "modules": [
    {
      "id": "agent-command-center",
      "folder": "agent-command-center",
      "version": "v0.4",
      "status": "TEST",
      "manifestSha256": "69df8d8121c9c7b07ba0000a18da022a3a0878b4945d99c659738510b58fddb4",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "gate",
        "identity",
        "storage",
        "wisdom"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "agent-tool-forge",
      "folder": "agent-tool-forge",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "200cf78db759e8c83f29bbd576ebc1db27ce35370c4672274e74365d331fe74e",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "ai-task-talk",
      "folder": "ai-task-talk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f48a2f106a3c30144a984d0512594db06314679e26655fc8272c3f4fbff21a7c",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "bridge",
        "gate",
        "identity",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "ai-team",
      "folder": "ai-team",
      "version": "v1.6",
      "status": "TEST",
      "manifestSha256": "ec9967ed3fc242da4999ab2c9fefb6f1e88de1b0d4232f12c4d6e05a57c31343",
      "contractState": "PRESENT",
      "contractSha256": "e468d6025035607217edcac9ca71c8d7d17da60965b451cc879a645349b2939f",
      "contractIssue": null,
      "exactTargets": [
        "agent-command-center",
        "agent-tool-forge",
        "ai-task-talk",
        "duo-test",
        "model-lab",
        "prompt-vault",
        "reasoning-shell",
        "shell-guardian",
        "technical-glasses"
      ],
      "explicitTargetsNotTopLevelModules": [
        "discovery-role-packs",
        "mirror-native-learning-shell"
      ],
      "genericTokens": [
        "ai",
        "bridge",
        "gate",
        "identity",
        "runtime",
        "storage",
        "workshop:connector-status",
        "workshop:presence-notices"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "asset-fabric",
      "folder": "asset-fabric",
      "version": "v0.9",
      "status": "EXPERIMENTAL",
      "manifestSha256": "39820dc432c5557767641b2faa93035cbc6f6da749a2d61e69cc97c2930f1dd0",
      "contractState": "PRESENT",
      "contractSha256": "67306f073af105b2009478daaecb8952bd057092bcb0ff57b919bd464f530ec3",
      "contractIssue": null,
      "exactTargets": [
        "evolution-foundry"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "KTX.2.0",
        "MaterialX.1.38",
        "Timeline.1",
        "asset-hands",
        "axm.animated-raster-recipe/v1",
        "axm.asset-brief/v1",
        "axm.asset-creation-recipe/v1",
        "axm.asset-fabric.machine-review-receipt/v1",
        "axm.asset-hand-gap-report/v1",
        "axm.asset-hand-result/v1",
        "axm.asset-hand/v2",
        "axm.asset-need/v1",
        "axm.asset-source-artifact/v1",
        "axm.asset-validation-receipt/v1",
        "axm.body-pulse.lease/v1",
        "axm.creation.archive/v1",
        "axm.film-motion.project/v1",
        "axm.ktx2-texture-recipe/v1",
        "axm.ktx2-validation-report/v1",
        "axm.material-graph/v1",
        "axm.print-document/v1",
        "axm.spatial.project/v1",
        "axm.target-canvas/v1",
        "axm.visual-kernel.tokens/v1",
        "basis-universal-wasm",
        "creation-incubator",
        "export",
        "film-motion-core",
        "future:axm.game-asset/v1",
        "game-runtime-optional",
        "glTF.2.0",
        "jspdf",
        "spatial-core",
        "storage",
        "visual-kernel"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "asset-filesystem-service",
      "folder": "asset-filesystem-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "fe8d5c9a7c817134d1f7a3633a6085ef683fd9d5c9d6db5c80fa2ea497b88f57",
      "contractState": "PRESENT",
      "contractSha256": "5f113ad934ea765bbe55607b60d5e3d98d7c216714e71baa45d5267604a5cfb2",
      "contractIssue": null,
      "exactTargets": [
        "asset-vault"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "files",
        "filesystem:assets",
        "selected-device-handoff-files",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "asset-pack-lab",
      "folder": "asset-pack-lab",
      "version": "v0_1",
      "status": "TEST",
      "manifestSha256": "0e6d937903d85af1c353caaa579cb1a166b8883415a92d078552e1768fa7d6e0",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "asset-librarian",
        "gate",
        "registry",
        "server-export",
        "settings",
        "storage",
        "template-source"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "asset-vault",
      "folder": "asset-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "0093d3c66fb9b32235d5ce0912357216c7c19e149c6e1816a97a302a090354c7",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "asset-librarian",
        "gate",
        "optional-ai",
        "registry",
        "server-export",
        "settings",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "audio-studio",
      "folder": "audio-studio",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "dcb77280455c850add26e05b203fe27b7e229d78c7bc73ff7a7dd0f745aba6b8",
      "contractState": "PRESENT",
      "contractSha256": "110e66bacdcd6ec1129386d622955ae59baae7206d3a11c6d7fa44403d8dfca3",
      "contractIssue": null,
      "exactTargets": [
        "ai-team",
        "asset-vault",
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [
        "shared-engines/project-v1"
      ],
      "genericTokens": [
        "ai",
        "export",
        "files",
        "shared-engines",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "body-pulse",
      "folder": "body-pulse",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "db55e7ebe04861ea16c590169e74346eb10ddeb8167a9700efa470483fe85c70",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "evolution-foundry"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "host-telemetry",
        "resource-governance",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "browser-lan-hardware-qa-lab",
      "folder": "browser-lan-hardware-qa-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b0863665551424f6c0bfb4750efeaff3c1a84774076ab7bb36126b709a964ae9",
      "contractState": "PRESENT",
      "contractSha256": "55c930b7317816e7388cac10c9b0e91a5e2a48b4c8bf46d271eb6d8ccaab9783",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [
        "runtime"
      ],
      "genericTokens": [
        "browser-device-metadata",
        "gate",
        "local-network",
        "qa.run",
        "runtime"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "chatgpt-connector",
      "folder": "chatgpt-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f7332d743398d4bdf9a645c655b7981b43c4c10538d590e67f88c1163a8a377a",
      "contractState": "PRESENT",
      "contractSha256": "68f2a0195b1ba580438c92fff2341bdd6a43d65b6532c8d51eb79c79371a186c",
      "contractIssue": null,
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "bridge",
        "chatgpt:web-image-generation",
        "files",
        "game-hub:asset-handoff",
        "gate",
        "workshop:chatgpt-connector-status"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "claude-connector",
      "folder": "claude-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a425c016edf3d7eff94328fbfc8ceab16d13f63541c7ee97cc0d27c8066790b2",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "bridge",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "cognitive-calibration-lab",
      "folder": "cognitive-calibration-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2aabc53b7712e49a7343f8fb29351553f030e0093a852c4d2d6134ec63dd7db5",
      "contractState": "PRESENT",
      "contractSha256": "c6921ef254fbb33711843799140dfebb1c467652bdfcbefbe908e0bbf5e72a7a",
      "contractIssue": null,
      "exactTargets": [
        "cognitive-resource-meter"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "cognitive.calibration.write",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "cognitive-evidence-explorer",
      "folder": "cognitive-evidence-explorer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "ceb9e0ae81a31e168ed3dd5007e305a743b5f49589a9e591b1fd6becb44c8355",
      "contractState": "PRESENT",
      "contractSha256": "7441cbeb0ff3250342955183b2277c2c7f1839d68dd5cdf09c13a30a4272dd0f",
      "contractIssue": null,
      "exactTargets": [
        "cognitive-resource-meter"
      ],
      "explicitTargetsNotTopLevelModules": [
        "cognitive-evidence-labs"
      ],
      "genericTokens": [
        "cognitive-evidence-labs",
        "runtime"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "cognitive-resource-meter",
      "folder": "cognitive-resource-meter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ba30cc5ef82fb6c75357d435d33106d4687c7d5a66e35480741638743c289a1",
      "contractState": "PRESENT",
      "contractSha256": "6e503acd149d8592ce244032015e2d0e0d8ab07dbfcdd994ac081890328a3b8a",
      "contractIssue": null,
      "exactTargets": [
        "technical-glasses"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "cognitive.evidence.write",
        "cognitive.measure.local",
        "contract:axm.mirror.cognitive-resource-economics-profile-draft/v1@fa66b93360b0a43da9ac35bd6b128d2c62e9e341d06a4f1fad9c15f31f073ef3",
        "contract:axm.mirror.cognitive-work-observation-draft/v1@74a135eca16239f502d73ecbee296ae49fa8a09316cae4437188b923c500286d",
        "export",
        "files",
        "gate",
        "provider-declarations",
        "provider:explicit-declaration",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "device-handoff",
      "folder": "device-handoff",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "121fc27bc7b8b055a70b70ca86c178d1616a313d34a3bf1bdc64636fb5dbf27a",
      "contractState": "PRESENT",
      "contractSha256": "99179177c998708610d8b63c6af7d83a6e10741aaabb383ca014a3922da34455",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [
        "gate"
      ],
      "genericTokens": [
        "browser-file-picker",
        "device.listen",
        "files",
        "gate",
        "local-network",
        "private-lan",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "diagnostics-operations-center",
      "folder": "diagnostics-operations-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b8e73dfaf90bb079fd8c1b0dbbcfb1f24c2bc1dac692c81b2e79ef6bd297958f",
      "contractState": "PRESENT",
      "contractSha256": "a36c359a04bc91388344834076aea413023413c12beca806710667aed1ec8ea0",
      "contractIssue": null,
      "exactTargets": [
        "device-handoff",
        "machine-host",
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [
        "assets",
        "permissions",
        "recovery",
        "runtime",
        "search"
      ],
      "genericTokens": [
        "capability-index",
        "logs",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "discord-bridge",
      "folder": "discord-bridge",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b7c89071e4b2e1f0308014e8d2233518896e3be0e72dc92689b0d48c9c9104f6",
      "contractState": "PRESENT",
      "contractSha256": "9952a1705e2cd70f1f0b602d6b15e56891bc8418b9f367a82fd175fe3b763ebb",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.action/v1",
        "discord:gateway-guild-events",
        "discord:guild-install",
        "files",
        "gate",
        "network-optional"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "discovery-engine",
      "folder": "discovery-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "52410d815be87e3c28519b7e31c0f843d0190e75dad6dcf86e29466458e046f8",
      "contractState": "PRESENT",
      "contractSha256": "6f72b569141b16d5692a3160170de6ed82a6d10d4de4a30b35b8b29bb23cc901",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "export",
        "gate",
        "gate:axm",
        "provider-router:axm-ask",
        "storage",
        "storage:axm"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "duo-test",
      "folder": "duo-test",
      "version": "v3",
      "status": "TEST",
      "manifestSha256": "897f42ecbe7381c932209e1dbb6602b7b0d74343f7535d2c879e2e94933acfb8",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "bridge",
        "identity",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "evidence-desk",
      "folder": "evidence-desk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "010e29cd34b47ede7679f7b5c72ab74ee71b43d987d18d4ed57e68df7ac87e92",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "evolution-foundry",
      "folder": "evolution-foundry",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "f903daddad720a6a9a592324098a0f80053ed41fbef898d2a66fcc4853911f0f",
      "contractState": "PRESENT",
      "contractSha256": "2e1952c2a7d65b445813996ad16ac80fdedbfecd563ab9ce2ba47bd12f9c1370",
      "contractIssue": null,
      "exactTargets": [
        "asset-fabric",
        "body-pulse",
        "governed-evolution-lab",
        "workshop-direction"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "film-motion-studio",
      "folder": "film-motion-studio",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "1f21c86ff30928ae2b0a44e5656ee23c579bb4be691ea3c11dfa50d8bbe7c14c",
      "contractState": "PRESENT",
      "contractSha256": "d738c75f735d1330200b6a167f3d0d82b7490965cb31d81b79094154dd5f9a4e",
      "contractIssue": null,
      "exactTargets": [
        "asset-vault",
        "audio-studio",
        "publish-library",
        "studio"
      ],
      "explicitTargetsNotTopLevelModules": [
        "asset-hands",
        "shared-engines/collaboration-v1",
        "shared-engines/project-v1",
        "shared-engines/scene-v1",
        "shared-engines/timeline-v1"
      ],
      "genericTokens": [
        "asset-hands",
        "camera",
        "export",
        "files",
        "gate",
        "shared-engines",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "finance-world-room",
      "folder": "finance-world-room",
      "version": "v0.1-experimental",
      "status": "EXPERIMENTAL",
      "manifestSha256": "6149787ea95bb84b3e1daee9208895519e12057a66717a33b7118664e0bacdfb",
      "contractState": "PRESENT",
      "contractSha256": "bb3e064878281da31e7fe3c947c1f3d7cbc63a85f04a6d431e31590feee952a7",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "gate",
        "gate:axm",
        "network",
        "network:explicit-world-bank-v2",
        "storage",
        "storage:axm",
        "user-file:csv-json"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "forge",
      "folder": "forge",
      "version": "v1",
      "status": "TEST",
      "manifestSha256": "2091a1a62f14fcf07bfa8bad509f7e8fe742b8a82c1ce4d52bacf91dd829a591",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "forge-line",
      "folder": "forge-line",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3c938ff93a2f00b5b7bf33c6b31ed1d04eec02d36f4cd14b73bb2007e9529d29",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "foundation-intake-steward",
      "folder": "foundation-intake-steward",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3311a72239053bfecd476ae0bf3f3eeba93fa422d41f68ba0e13097d8ac3d8a4",
      "contractState": "PRESENT",
      "contractSha256": "a342467e45eca2e73f10c9a7e6674b9f05c1ec4e670ee15e2d0a7f0b6d73ec00",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.foundation-contract-catalog/v1",
        "axm.foundation-implementation-map/v1",
        "catalog",
        "filesystem-evidence",
        "growth",
        "merge-gate",
        "verification",
        "workshop-relative-evidence-paths"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "game-forge",
      "folder": "game-forge",
      "version": "v1.2",
      "status": "TEST",
      "manifestSha256": "a67e304216a7b62ee78fd7efd4eb25ac9460f56f1457a600ff728f74a54af0fe",
      "contractState": "PRESENT",
      "contractSha256": "556c76e85f39545cc7ebc431c5433d9d6a54fa4dbcd6b2b9c5c406060db96638",
      "contractIssue": null,
      "exactTargets": [
        "game-hub",
        "sandbox",
        "studio"
      ],
      "explicitTargetsNotTopLevelModules": [
        "axm-physics-2d"
      ],
      "genericTokens": [
        "axm.game-asset/v1",
        "export",
        "files",
        "game.manifest.json",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "game-hub",
      "folder": "game-hub",
      "version": "v0.4",
      "status": "TEST",
      "manifestSha256": "58bb348ce231e097cfa2e89e77e48a490988f2b81bf77ca297d031139264e797",
      "contractState": "PRESENT",
      "contractSha256": "683285382423fc736a735d9161681231236d5295eb4fa824e40c40e9f141054e",
      "contractIssue": null,
      "exactTargets": [
        "game-forge"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.game-asset/v1",
        "files",
        "game.manifest.json",
        "gate"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "geographic-market-map",
      "folder": "geographic-market-map",
      "version": "v0.1-polished-review",
      "status": "EXPERIMENTAL",
      "manifestSha256": "ecaa4efa23fe43841d74e708fe85b0325cae480c312970b35e81917c68d40521",
      "contractState": "PRESENT",
      "contractSha256": "9858b1e2f8650aad4db497559af0832c8076707863a04dd75e282d289f1beb42",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "gate",
        "gate:axm",
        "storage",
        "storage:axm",
        "user-file:csv-json"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "governed-evolution-lab",
      "folder": "governed-evolution-lab",
      "version": "v0.1.1-epoch",
      "status": "EXPERIMENTAL",
      "manifestSha256": "20035ea582af41af85a82db8641ce4bd12aa1075fbf072fb122a084c5ff539cf",
      "contractState": "PRESENT",
      "contractSha256": "24f8acce91fb11dded1e818e08eb72a88d9af98f2e35c72101b95d8d39c90745",
      "contractIssue": null,
      "exactTargets": [
        "body-pulse",
        "discovery-engine",
        "evidence-desk",
        "evolution-foundry",
        "project-room"
      ],
      "explicitTargetsNotTopLevelModules": [
        "mirror-native-world-genome-organ"
      ],
      "genericTokens": [
        "discovery",
        "evidence",
        "export",
        "future:workshop-capability-catalog",
        "future:world-observation-stream",
        "mirror-native",
        "storage",
        "subject:grafthold-globe-v0.9-pulse-copy"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "graft",
      "folder": "graft",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "31c10f7032c1cf4b88e15d111cffe414410bec661afc87a35394dfafc6c9808e",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "hermes-local",
      "folder": "hermes",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3553916184c1f5d08e0757024e79e4dfc99ec8a9af4dd1a5949943461a2d1d21",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "hub-test-room",
      "folder": "hub-test-room",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "b04a50f1a79b91a3b1ffcbcee3eccf17e3a2cfe314637ee7d7ebf8fd75e2efe1",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "human-attention-ledger",
      "folder": "human-attention-ledger",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "1178063e1b19785606f974a387900ce9700c2c475bb929feb8d47795a6496d28",
      "contractState": "PRESENT",
      "contractSha256": "c16981d71e28216c789c4aeaa897bcf0297605ea1c01b36f8cbeb4dc84b006fe",
      "contractIssue": null,
      "exactTargets": [
        "cognitive-resource-meter"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "human.attention.write",
        "human:explicit-consent",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "judgement-chamber",
      "folder": "judgement-chamber",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "9f84c4e43c61e330e68131739898316c992da2f50fbf6077c9fc90867aeb0f12",
      "contractState": "PRESENT",
      "contractSha256": "1a37a8297e11101cd02fa7aae7ed1eac3e7e4407386c0fd8781e00c4ca57fdce",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox",
        "workshop-direction"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "knowledge-canvas",
      "folder": "knowledge-canvas",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "a17fdba57fc8f99d565d0d8ca4e95c21da00348fb5214eda988c73a8ebdd510f",
      "contractState": "PRESENT",
      "contractSha256": "2001402ba9cda6e4896afc0d24f70470203c1117fbf244044dadd0fb2c1fead4",
      "contractIssue": null,
      "exactTargets": [
        "discovery-engine",
        "evidence-desk"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.knowledge.research/v1",
        "export",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "launcher-card-installer",
      "folder": "launcher-card-installer",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "312b3f8f5817eeee290ff9ede16842b0dc494c31c9908ecb61c0f19c2cdfbda4",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "asset-librarian",
        "export",
        "gate",
        "registry"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "learning-lab",
      "folder": "learning-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f2f189c429c283b66000ac31591bc31f06431a087104e7ea761a366a3095f8d8",
      "contractState": "PRESENT",
      "contractSha256": "6b3337b43e9e041f215f87cfd026a445d6a8b7090b7ca58e83d4bfba21be68ab",
      "contractIssue": null,
      "exactTargets": [
        "ai-team",
        "knowledge-canvas",
        "project-room"
      ],
      "explicitTargetsNotTopLevelModules": [
        "mirror-learning-forge",
        "shared-engines/collaboration-v1",
        "shared-engines/evidence-v1",
        "shared-engines/project-v1"
      ],
      "genericTokens": [
        "child:mirror-learning-shell",
        "export",
        "mirror-learning-forge",
        "shared-engines",
        "storage",
        "workspace:ai-team",
        "workspace:game-forge",
        "workspace:knowledge-canvas",
        "workspace:project-room"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "living-world-ruleset-physics-adapter-kit",
      "folder": "living-world-ruleset-physics-adapter-kit",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "e769d0297e27974466e26d113e04dee3a830257059ba8cb0e98315efcd3d74e4",
      "contractState": "PRESENT",
      "contractSha256": "a65a6329269ed8370835b839761d1b2bee47da56b4d6b13e13b0851af58cb938",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "adapter.register",
        "axm.living-world.snapshot/v1",
        "gate",
        "shared-physics",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "living-world-state-server",
      "folder": "living-world-state-server",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "c5a5fc7a9d4795603413d45a6233ce47f37461af04eb279b3b13ae086b8135f0",
      "contractState": "PRESENT",
      "contractSha256": "86d90d3191462b30308ac6927c1f999b45a59343eec7badde8836a2e6fe2a778",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.living-world.create/v1",
        "axm.living-world.patch/v1",
        "gate",
        "storage",
        "world.mutate",
        "world.restore"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "machine-host",
      "folder": "machine-host",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3a2f14eeb215ba5ccd460dc4735d8927bd33ff37787921bb6b016b1f4d3d4138",
      "contractState": "PRESENT",
      "contractSha256": "ee1a6c6093096a001c39436597f921635bcd6b802e6d1f83a7da6a7008b98aaa",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [
        "gate",
        "runtime"
      ],
      "genericTokens": [
        "gate",
        "machine.execute",
        "module-selftest-entrypoints",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "main-hub",
      "folder": "main-hub",
      "version": "v0.1",
      "status": "SHELL",
      "manifestSha256": "568965995d855a9a5d9e6f75e6df4bf237afb18fb95f19e17e2b6eb7d82b77b3",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "marketplace-deployment",
      "folder": "marketplace-deployment",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "28787e3e870446ae08fd977c241a817b473dabf7cf02f093fa9f94960ffd960f",
      "contractState": "PRESENT",
      "contractSha256": "3376966b11173b0e952e798839ebb25e030c9973eb8ba43792191dbfb7c07f91",
      "contractIssue": null,
      "exactTargets": [
        "asset-vault",
        "launcher-card-installer",
        "publish-library",
        "workshop-packager"
      ],
      "explicitTargetsNotTopLevelModules": [
        "backup",
        "plugin-registry",
        "runtime"
      ],
      "genericTokens": [
        "backup",
        "export",
        "gate",
        "plugins",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "media-render-transcode-service",
      "folder": "media-render-transcode-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "753ff72e597a6e4e40b153d85d12a5d2b28c15c3ca5fdd8491456f4d484feafc",
      "contractState": "PRESENT",
      "contractSha256": "640c10658848bc662c93432a37962cf1ee1e62470da22defb32ed7b4cf4b5160",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "files",
        "filesystem:assets",
        "filesystem:exports",
        "gate",
        "media.render",
        "optional-adapter:ffmpeg",
        "runtime"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "mirror-intake-monitor",
      "folder": "mirror-intake-monitor",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "491446d13cd39708714a2c365c17bd64353d7d98230822a3809f50a3ef02d198",
      "contractState": "PRESENT",
      "contractSha256": "9da2265518274632ff0f922f26cfec6c4643fadcfe6923b43e3216c731b60964",
      "contractIssue": null,
      "exactTargets": [
        "cognitive-resource-meter"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "mirror.intake-receipt.import",
        "provider:explicit-mirror-intake-receipt",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "mirror-learning-shell",
      "folder": "mirror-learning-shell",
      "version": "v0.2-shared-door",
      "status": "TEST",
      "manifestSha256": "007e91010eaaf7ee72030fb644a3229d5902b8857f1069f432646ebbb3982dfb",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "learning-lab"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "identity-core",
        "mirror-kernel",
        "profile",
        "reasoning",
        "specialists",
        "training",
        "wisdom"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "model-lab",
      "folder": "model-lab",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "3d8c88c29e6fb6846149968af60c265622f469c6053167961131bf069a977941",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "module-contract-workbench",
      "folder": "module-contract-workbench",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2cb41adf26848d530bd6d6b77da1f39e6ff8fe79f6e5a385d85008688365092a",
      "contractState": "PRESENT",
      "contractSha256": "a955c82f5e563efeed6133b1f755d1a854c203a47f78343a7cf6985e1b1f6380",
      "contractIssue": null,
      "exactTargets": [
        "module-installer",
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.module-contract/v1",
        "axm.module-seam-gap-report/v1",
        "gate",
        "module-manifest",
        "plugins",
        "review",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "module-installer",
      "folder": "module-installer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "39c0969090ff3c4655dcf712c521d06e477d1fd1c738cc1f34fa5ec7b100b3eb",
      "contractState": "PRESENT",
      "contractSha256": "e41338e7906578990073a9343d617c19bf80c865b450b7f11c2d9625ff268ac0",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [
        "backup",
        "gate"
      ],
      "genericTokens": [
        "axm.module-bundle/v1",
        "backup",
        "gate",
        "module.install",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "multiplayer-controller-transport",
      "folder": "multiplayer-controller-transport",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9525ff047b7f8454dc85c0335230e6a09cef33363e85c302e1b4b072fc006ca9",
      "contractState": "PRESENT",
      "contractSha256": "5b166cf5fbe77e9f039e7970dc4e8228c9c563aaa31959f3918a69b060c81314",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "browser-gamepad-api",
        "gate",
        "local-network",
        "network.listen",
        "private-lan",
        "runtime"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "novelty-diversity-engine",
      "folder": "novelty-diversity-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "7fbc62a2ff53d950e2f2488ddeec22952e1da99b2d10097ae9b94aa5c7cd25af",
      "contractState": "PRESENT",
      "contractSha256": "76c7e71849ac5ddbff9d7f0b22607c01e6647a4fe0d7b38c21c83d1e3530e748",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.novelty-candidate-set/v1",
        "runtime",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "prehub",
      "folder": "prehub",
      "version": "v1",
      "status": "WORKING",
      "manifestSha256": "2be9d79a9107d71a3dbe5d47d7a447bdc9354ed36acc887fc6913dc904342d8f",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "project-room",
      "folder": "project-room",
      "version": "v0.3",
      "status": "TEST",
      "manifestSha256": "585e18a82d88561227b2348a58af6419febb7590230d09d177fa16af80e16bc9",
      "contractState": "PRESENT",
      "contractSha256": "195ff276717664b56540265b0f0bd8d84d5485e67cc2de489117937c30a4daea",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.knowledge-project-handoff/v1",
        "export",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "prompt-vault",
      "folder": "prompt-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "43595589df949012ab9a4c76d91cf32673223fb796d66ae4c95e70dec491cbac",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "optional-ai",
        "registry",
        "server-export",
        "settings",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "ps2-asset-forge",
      "folder": "ps2-asset-forge",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "dc9e11e38f0fd53717d384fdf713cace6b5ed52ce8e0f86189058b1aed9803bf",
      "contractState": "PRESENT",
      "contractSha256": "beb1d51adf62fd1656d1b9f6b50343e1b661b2808757d051385130dedcd11340",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "CC0-1.0",
        "axm.asset-fabric.need/v2",
        "export",
        "files",
        "glTF.2.0",
        "gltf-2.0",
        "human-review",
        "human-visual-approval",
        "local-cc0-source-library",
        "three-webgl"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "public-release-deployment-adapter",
      "folder": "public-release-deployment-adapter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "30223dfa7d71b124d00ec9d9eb252d621704cd9e8be531710943ab0749c02009",
      "contractState": "PRESENT",
      "contractSha256": "c275a331e7c70b8460f2b7a1c4e9c8c80e2a80fe359c6fea7abb7511b158d211",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [
        "encrypted-secret-vault"
      ],
      "genericTokens": [
        "export",
        "files",
        "filesystem:exports",
        "gate",
        "identity",
        "release.deploy"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "publish-library",
      "folder": "publish-library",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "09e2a23c12442583df76e4dbb6f3b9006a29437853ef62ca4f13a27153e2fe34",
      "contractState": "PRESENT",
      "contractSha256": "dbc050c9e5fe69b38d2d93bb708a8ee33c41c7eb27b9ebf96404d15c9c31a1fb",
      "contractIssue": null,
      "exactTargets": [
        "asset-pack-lab",
        "asset-vault",
        "launcher-card-installer",
        "marketplace-deployment",
        "workshop-packager"
      ],
      "explicitTargetsNotTopLevelModules": [
        "shared-output-engine-v0.1"
      ],
      "genericTokens": [
        "asset-librarian",
        "export",
        "gate",
        "server-export",
        "shared-output-engine",
        "storage",
        "worker-threads"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "read-only-mirror-world-adapter",
      "folder": "read-only-mirror-world-adapter",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "5f9d51195a1d4e27f6cc6847a659aa080fd64de20f13008db10560fe5dbce17e",
      "contractState": "PRESENT",
      "contractSha256": "28db9400a476e79117403c9e3571f30ac0fd8364ab697cb2f147cc1237c8800d",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.living-world.snapshot/v1",
        "axm.mirror-observation-consent/v1",
        "gate",
        "identity",
        "mirror.observe",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "reasoning-shell",
      "folder": "reasoning-shell",
      "version": "v0.1-branch",
      "status": "TEST",
      "manifestSha256": "edbb3418123c90d7be4dd9693e328a60efeb0fc6e6781f010b05cf1acdea9528",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "ai",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "recovery-center",
      "folder": "recovery-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5561fe713f07b5dcaa8b452970ca0b71bc1ef6e2099212b85ca65892a2145b44",
      "contractState": "PRESENT",
      "contractSha256": "4ca51cbb9e00175fd035c5c534be0986c98b908d66326843db2e0ef75b4e3fe9",
      "contractIssue": null,
      "exactTargets": [
        "workshop-packager"
      ],
      "explicitTargetsNotTopLevelModules": [
        "gate",
        "storage"
      ],
      "genericTokens": [
        "backup",
        "gate",
        "recovery.apply",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "review-inbox",
      "folder": "review-inbox",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "6dafb4a9d20580a353cac6559c6f08f147508f4397a05f5f9d53776a7d3c3306",
      "contractState": "PRESENT",
      "contractSha256": "b6faf1d0ce5035359d1399312ff1b8dedfa6998e81beaf119da24076ed04cdcb",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "artifact-sha256",
        "attributed-review-votes",
        "axm.review-item/v1",
        "gate",
        "governance",
        "identity",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "route",
      "folder": "route",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a27d7be754746910d4af1e46f21a51f1d8b3004926ca8a5b0d356cf9feee67cb",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "runner",
      "folder": "runner",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "9f3c3402cec092448476066027a7eda85ec15335c5816966bdefc0632b3b4285",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "sandbox",
      "folder": "sandbox",
      "version": "v0.1-session1",
      "status": "TEST",
      "manifestSha256": "d8834cad606c008760945a24eed2e5899b01c115c865eb8a1f0008790707fb57",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "game-forge"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "secrets-permissions-console",
      "folder": "secrets-permissions-console",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "edb768d452c8c5d45b7c4f1db7269861c998d7b546554a2b579f794e9b2c9bdd",
      "contractState": "PRESENT",
      "contractSha256": "342f4455903e2ab9b324804c0e7c709dfc433d3d212eba89ee12b4e63585a989",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [
        "gate"
      ],
      "genericTokens": [
        "gate",
        "human-passphrase",
        "identity",
        "module-manifests",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "shell-guardian",
      "folder": "shell-guardian",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5546920048530ec78a372b78b9457d8e1d4db67abaac37c7693c9f1f920e8511",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "bridge",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "skinner",
      "folder": "skinner",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "e279534e785c4fc6ddd54da6b59953c3113f727a2b9797b0e1f800fd81bd435f",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "studio"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "source-connector-hub",
      "folder": "source-connector-hub",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "db7e6c865e7af9b637893aa07626cb2dc24eec4e6037b57ee79e4f526d096387",
      "contractState": "PRESENT",
      "contractSha256": "f3fd3db09661d6bfafcdf07f8bd93313937141b9bbac117db8c24699e830bf6c",
      "contractIssue": null,
      "exactTargets": [
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "network-optional",
        "network.fetch",
        "official-https-origins"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "spatial-studio",
      "folder": "spatial-studio",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "bf4b87c868e91acfa4f3e2cb4509bdb453cb7112d88a969e5f5cce411d0930ad",
      "contractState": "PRESENT",
      "contractSha256": "e8bf0d69a771bfbfd453bcba8c44a7f6e0ee10667eec341be5ca6eb07bcfe0af",
      "contractIssue": null,
      "exactTargets": [
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [
        "asset-hands/axm.asset-hand-result/v1",
        "shared-engines/physics-registry-v1",
        "shared-engines/project-v1",
        "shared-engines/renderer-registry-v1",
        "shared-engines/scene-v1",
        "shared-engines/timeline-v1",
        "shared-physics/axm-physics-2d"
      ],
      "genericTokens": [
        "asset-hands",
        "export",
        "files",
        "gate",
        "shared-engines",
        "shared-physics",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "studio",
      "folder": "studio",
      "version": "v2.5",
      "status": "TEST",
      "manifestSha256": "b61af3f4615f16750878725c984eb206620d59c02f65b83257ba351bbd4e5ec4",
      "contractState": "PRESENT",
      "contractSha256": "0034ba4ac17568a19f6e03f16ef2ce51d912aec279f53cca0269607dc89bd9b9",
      "contractIssue": null,
      "exactTargets": [
        "asset-vault"
      ],
      "explicitTargetsNotTopLevelModules": [
        "asset-hands"
      ],
      "genericTokens": [
        "ai",
        "asset-hands",
        "axm.asset-creation-recipe/v1",
        "axm.asset-hand-result/v1",
        "axm.asset-hand/v2",
        "axm.asset-source-artifact/v1",
        "axm.asset-validation-receipt/v1",
        "axm.asset-verification-envelope/v1",
        "axm.drawpacket/v1",
        "axm.target-canvas/v1",
        "axm.visual-kernel.tokens/v1",
        "export",
        "files",
        "gate",
        "identity:gemini-local",
        "identity:nova",
        "storage",
        "visual-kernel"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "sustainability-metrology-lab",
      "folder": "sustainability-metrology-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "77d7b2d3a7fb67892a31f7b2cc5d21c03329451321b83a845f1347a0aa5636b6",
      "contractState": "PRESENT",
      "contractSha256": "b4a05f0001bf75ddb1a04e29ef8a13a9cfacb18174380ab40bd64148ac3d91ab",
      "contractIssue": null,
      "exactTargets": [
        "cognitive-resource-meter"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "gate",
        "profile:hardware",
        "source:explicit-power-or-carbon-evidence",
        "storage",
        "sustainability.evidence.write"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "technical-glasses",
      "folder": "technical-glasses",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5a2930adf2f06184a1d0e1d496222802d8124203ee52403cf6e628c8172c463c",
      "contractState": "PRESENT",
      "contractSha256": "de740ba5ef172efbb0bb4d298cec7b09dd351d3d67f86a59b40762b5c9e8ff90",
      "contractIssue": null,
      "exactTargets": [
        "ai-team"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "capability-index",
        "gate",
        "runtime",
        "storage",
        "workshop:body-pulse-state",
        "workshop:capability-index",
        "workshop:live-readiness",
        "workshop:module-contracts",
        "workshop:source-metadata",
        "workshop:test-declarations",
        "workshop:tool-manifests"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "template-runtime-pack-engine",
      "folder": "template-runtime-pack-engine",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9f5f2f18a3a65a4fb6dbb7dfb1bf545682b37bf739e9fde5d1f5437996f0c96d",
      "contractState": "PRESENT",
      "contractSha256": "b6f6edc3b71986c51a9db07e2a6d7245bc2bdf1fd1877396cb69e4d8b45e35b1",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.template-pack/v1",
        "export",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "ui-ux-builder",
      "folder": "ui-ux-builder",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "c5a1e1484e2b10a69ffcd6ef61d52d79e61ac15d2da35d75783a346860e63df7",
      "contractState": "PRESENT",
      "contractSha256": "a7fee666276df11a982482d545940bc75df33fed1bb3efbe30ece7333fb32887",
      "contractIssue": null,
      "exactTargets": [
        "studio"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "gate",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "verifier",
      "folder": "verifier",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "ee20bd953bec0a195f23278be712fd1ec4a921e936544c74768b078fe240c826",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [],
      "inDeclaredCycle": false
    },
    {
      "id": "workshop-command-center",
      "folder": "workshop-command-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ffa0ab48d7b25218328d710558cd5527650a1f313ccdb7ec2c99a55945084e9",
      "contractState": "PRESENT",
      "contractSha256": "940eb34276050eed62cd398fd0c98ca3ef2b5ed4b1b1649a425aed145c59828f",
      "contractIssue": null,
      "exactTargets": [
        "body-pulse",
        "cognitive-resource-meter",
        "review-inbox",
        "technical-glasses",
        "workshop-direction"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.body-pulse.status/v1",
        "axm.cognitive-resource-meter-status/v1",
        "axm.cognitive-resource.command-center-controls/v1",
        "axm.review-item/v1",
        "axm.technical-glasses/v1",
        "axm.workshop-direction.plan/v1",
        "axm.workshop-direction.steward-assessment/v1",
        "storage"
      ],
      "inDeclaredCycle": false
    },
    {
      "id": "workshop-direction",
      "folder": "workshop-direction",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "8ca0ec56981b2c3571c7609fc1d1fc670b606c58db2f5d8f938d6b9a5a722d61",
      "contractState": "PRESENT",
      "contractSha256": "43d39c69a7cd9cc414a87b7f3773fd51411651d84acaf11d8be0d471c107e466",
      "contractIssue": null,
      "exactTargets": [
        "body-pulse",
        "review-inbox"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "axm.body-pulse.goal/v1",
        "axm.workshop-capability-index/v1",
        "capability-index",
        "storage"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "workshop-packager",
      "folder": "workshop-packager",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "40d335d09d59946e418c19a777b157c003e71873dfe200877a832ce3a165bdd0",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "contractIssue": "module contract not declared",
      "exactTargets": [
        "publish-library"
      ],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "export",
        "files",
        "gate",
        "server-export"
      ],
      "inDeclaredCycle": true
    },
    {
      "id": "workshop-search-provenance",
      "folder": "workshop-search-provenance",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "369328f81cf29263512294aeb8ac00c7ce171e1753e16e7f50a36414bfcfa9cd",
      "contractState": "PRESENT",
      "contractSha256": "47f0e7d3f8ad4fe99f6f124aba20f4ad706626098de657914c5c3bd825703e31",
      "contractIssue": null,
      "exactTargets": [],
      "explicitTargetsNotTopLevelModules": [],
      "genericTokens": [
        "asset-metadata",
        "capability-index",
        "files",
        "project-files",
        "public-workshop-source",
        "storage"
      ],
      "inDeclaredCycle": false
    }
  ],
  "edges": [
    {
      "from": "agent-command-center",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "agent-tool-forge",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "ai-task-talk",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "ai-team",
      "to": "agent-command-center",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:agent-command-center"
      ]
    },
    {
      "from": "ai-team",
      "to": "agent-tool-forge",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:agent-tool-forge"
      ]
    },
    {
      "from": "ai-team",
      "to": "ai-task-talk",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:ai-task-talk"
      ]
    },
    {
      "from": "ai-team",
      "to": "duo-test",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:duo-test"
      ]
    },
    {
      "from": "ai-team",
      "to": "model-lab",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:model-lab"
      ]
    },
    {
      "from": "ai-team",
      "to": "prompt-vault",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:prompt-vault"
      ]
    },
    {
      "from": "ai-team",
      "to": "reasoning-shell",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:reasoning-shell"
      ]
    },
    {
      "from": "ai-team",
      "to": "shell-guardian",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:shell-guardian"
      ]
    },
    {
      "from": "ai-team",
      "to": "technical-glasses",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:technical-glasses"
      ]
    },
    {
      "from": "asset-fabric",
      "to": "evolution-foundry",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "evolution-foundry"
      ]
    },
    {
      "from": "asset-filesystem-service",
      "to": "asset-vault",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "asset-vault"
      ]
    },
    {
      "from": "asset-pack-lab",
      "to": "publish-library",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "publish-library"
      ]
    },
    {
      "from": "asset-vault",
      "to": "publish-library",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "publish-library"
      ]
    },
    {
      "from": "audio-studio",
      "to": "ai-team",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:ai-team"
      ]
    },
    {
      "from": "audio-studio",
      "to": "asset-vault",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "asset-vault",
        "service:asset-vault"
      ]
    },
    {
      "from": "audio-studio",
      "to": "publish-library",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:publish-library"
      ]
    },
    {
      "from": "body-pulse",
      "to": "evolution-foundry",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "evolution-foundry"
      ]
    },
    {
      "from": "chatgpt-connector",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "claude-connector",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "cognitive-calibration-lab",
      "to": "cognitive-resource-meter",
      "sources": [
        "contract.consumes",
        "manifest.integratedInto",
        "manifest.uses"
      ],
      "tokens": [
        "cognitive-resource-meter",
        "module:cognitive-resource-meter"
      ]
    },
    {
      "from": "cognitive-evidence-explorer",
      "to": "cognitive-resource-meter",
      "sources": [
        "contract.consumes",
        "manifest.integratedInto",
        "manifest.uses"
      ],
      "tokens": [
        "cognitive-resource-meter",
        "module:cognitive-resource-meter"
      ]
    },
    {
      "from": "cognitive-resource-meter",
      "to": "technical-glasses",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "service:technical-glasses",
        "technical-glasses"
      ]
    },
    {
      "from": "diagnostics-operations-center",
      "to": "device-handoff",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:device-handoff"
      ]
    },
    {
      "from": "diagnostics-operations-center",
      "to": "machine-host",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:machine-host"
      ]
    },
    {
      "from": "diagnostics-operations-center",
      "to": "review-inbox",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:review-inbox"
      ]
    },
    {
      "from": "duo-test",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "evolution-foundry",
      "to": "asset-fabric",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "asset-fabric",
        "service:asset-fabric"
      ]
    },
    {
      "from": "evolution-foundry",
      "to": "body-pulse",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "body-pulse",
        "service:body-pulse"
      ]
    },
    {
      "from": "evolution-foundry",
      "to": "governed-evolution-lab",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "governed-evolution-lab",
        "service:governed-evolution-lab"
      ]
    },
    {
      "from": "evolution-foundry",
      "to": "workshop-direction",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "service:workshop-direction",
        "workshop-direction"
      ]
    },
    {
      "from": "film-motion-studio",
      "to": "asset-vault",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "asset-vault",
        "service:asset-vault"
      ]
    },
    {
      "from": "film-motion-studio",
      "to": "audio-studio",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:audio-studio"
      ]
    },
    {
      "from": "film-motion-studio",
      "to": "publish-library",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:publish-library"
      ]
    },
    {
      "from": "film-motion-studio",
      "to": "studio",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:studio"
      ]
    },
    {
      "from": "foundation-intake-steward",
      "to": "review-inbox",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox"
      ]
    },
    {
      "from": "game-forge",
      "to": "game-hub",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:game-hub"
      ]
    },
    {
      "from": "game-forge",
      "to": "sandbox",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:sandbox"
      ]
    },
    {
      "from": "game-forge",
      "to": "studio",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:studio"
      ]
    },
    {
      "from": "game-hub",
      "to": "game-forge",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "game-forge"
      ]
    },
    {
      "from": "governed-evolution-lab",
      "to": "body-pulse",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:body-pulse"
      ]
    },
    {
      "from": "governed-evolution-lab",
      "to": "discovery-engine",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:discovery-engine"
      ]
    },
    {
      "from": "governed-evolution-lab",
      "to": "evidence-desk",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:evidence-desk"
      ]
    },
    {
      "from": "governed-evolution-lab",
      "to": "evolution-foundry",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "evolution-foundry"
      ]
    },
    {
      "from": "governed-evolution-lab",
      "to": "project-room",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "project-room",
        "service:project-room"
      ]
    },
    {
      "from": "human-attention-ledger",
      "to": "cognitive-resource-meter",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "cognitive-resource-meter"
      ]
    },
    {
      "from": "judgement-chamber",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "judgement-chamber",
      "to": "workshop-direction",
      "sources": [
        "contract.consumes",
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "service:workshop-direction",
        "workshop-direction"
      ]
    },
    {
      "from": "knowledge-canvas",
      "to": "discovery-engine",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:discovery-engine"
      ]
    },
    {
      "from": "knowledge-canvas",
      "to": "evidence-desk",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:evidence-desk"
      ]
    },
    {
      "from": "launcher-card-installer",
      "to": "publish-library",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "publish-library"
      ]
    },
    {
      "from": "learning-lab",
      "to": "ai-team",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "learning-lab",
      "to": "knowledge-canvas",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "knowledge-canvas"
      ]
    },
    {
      "from": "learning-lab",
      "to": "project-room",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "project-room"
      ]
    },
    {
      "from": "marketplace-deployment",
      "to": "asset-vault",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:asset-vault"
      ]
    },
    {
      "from": "marketplace-deployment",
      "to": "launcher-card-installer",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:launcher-card-installer"
      ]
    },
    {
      "from": "marketplace-deployment",
      "to": "publish-library",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "publish-library",
        "service:publish-library"
      ]
    },
    {
      "from": "marketplace-deployment",
      "to": "workshop-packager",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:workshop-packager"
      ]
    },
    {
      "from": "media-render-transcode-service",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "mirror-intake-monitor",
      "to": "cognitive-resource-meter",
      "sources": [
        "contract.consumes",
        "manifest.integratedInto",
        "manifest.uses"
      ],
      "tokens": [
        "cognitive-resource-meter",
        "module:cognitive-resource-meter"
      ]
    },
    {
      "from": "mirror-learning-shell",
      "to": "learning-lab",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "learning-lab"
      ]
    },
    {
      "from": "model-lab",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "module-contract-workbench",
      "to": "module-installer",
      "sources": [
        "contract.consumes",
        "manifest.readiness"
      ],
      "tokens": [
        "module-installer",
        "service:module-installer"
      ]
    },
    {
      "from": "module-contract-workbench",
      "to": "review-inbox",
      "sources": [
        "manifest.readiness"
      ],
      "tokens": [
        "review-inbox"
      ]
    },
    {
      "from": "module-installer",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.readiness"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "prompt-vault",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "public-release-deployment-adapter",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "publish-library",
      "to": "asset-pack-lab",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:asset-pack-lab"
      ]
    },
    {
      "from": "publish-library",
      "to": "asset-vault",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:asset-vault"
      ]
    },
    {
      "from": "publish-library",
      "to": "launcher-card-installer",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:launcher-card-installer"
      ]
    },
    {
      "from": "publish-library",
      "to": "marketplace-deployment",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "marketplace-deployment"
      ]
    },
    {
      "from": "publish-library",
      "to": "workshop-packager",
      "sources": [
        "contract.consumes"
      ],
      "tokens": [
        "service:workshop-packager"
      ]
    },
    {
      "from": "reasoning-shell",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "recovery-center",
      "to": "workshop-packager",
      "sources": [
        "contract.consumes",
        "manifest.readiness"
      ],
      "tokens": [
        "service:workshop-packager",
        "workshop-packager"
      ]
    },
    {
      "from": "sandbox",
      "to": "game-forge",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "game-forge"
      ]
    },
    {
      "from": "shell-guardian",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "skinner",
      "to": "studio",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "studio"
      ]
    },
    {
      "from": "source-connector-hub",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "spatial-studio",
      "to": "publish-library",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "publish-library",
        "service:publish-library"
      ]
    },
    {
      "from": "studio",
      "to": "asset-vault",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "asset-vault",
        "service:asset-vault"
      ]
    },
    {
      "from": "sustainability-metrology-lab",
      "to": "cognitive-resource-meter",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "cognitive-resource-meter"
      ]
    },
    {
      "from": "technical-glasses",
      "to": "ai-team",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "ai-team"
      ]
    },
    {
      "from": "ui-ux-builder",
      "to": "studio",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "studio"
      ]
    },
    {
      "from": "workshop-command-center",
      "to": "body-pulse",
      "sources": [
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "body-pulse"
      ]
    },
    {
      "from": "workshop-command-center",
      "to": "cognitive-resource-meter",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "cognitive-resource-meter"
      ]
    },
    {
      "from": "workshop-command-center",
      "to": "review-inbox",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox"
      ]
    },
    {
      "from": "workshop-command-center",
      "to": "technical-glasses",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "technical-glasses"
      ]
    },
    {
      "from": "workshop-command-center",
      "to": "workshop-direction",
      "sources": [
        "manifest.uses"
      ],
      "tokens": [
        "workshop-direction"
      ]
    },
    {
      "from": "workshop-direction",
      "to": "body-pulse",
      "sources": [
        "manifest.readiness",
        "manifest.uses"
      ],
      "tokens": [
        "body-pulse"
      ]
    },
    {
      "from": "workshop-direction",
      "to": "review-inbox",
      "sources": [
        "contract.consumes",
        "manifest.uses"
      ],
      "tokens": [
        "review-inbox",
        "service:review-inbox"
      ]
    },
    {
      "from": "workshop-packager",
      "to": "publish-library",
      "sources": [
        "manifest.integratedInto"
      ],
      "tokens": [
        "publish-library"
      ]
    }
  ],
  "cycles": [
    {
      "members": [
        "agent-command-center",
        "agent-tool-forge",
        "ai-task-talk",
        "ai-team",
        "duo-test",
        "model-lab",
        "prompt-vault",
        "reasoning-shell",
        "shell-guardian",
        "technical-glasses"
      ],
      "edges": [
        {
          "from": "agent-command-center",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "agent-tool-forge",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "ai-task-talk",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "ai-team",
          "to": "agent-command-center",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:agent-command-center"
          ]
        },
        {
          "from": "ai-team",
          "to": "agent-tool-forge",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:agent-tool-forge"
          ]
        },
        {
          "from": "ai-team",
          "to": "ai-task-talk",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:ai-task-talk"
          ]
        },
        {
          "from": "ai-team",
          "to": "duo-test",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:duo-test"
          ]
        },
        {
          "from": "ai-team",
          "to": "model-lab",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:model-lab"
          ]
        },
        {
          "from": "ai-team",
          "to": "prompt-vault",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:prompt-vault"
          ]
        },
        {
          "from": "ai-team",
          "to": "reasoning-shell",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:reasoning-shell"
          ]
        },
        {
          "from": "ai-team",
          "to": "shell-guardian",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:shell-guardian"
          ]
        },
        {
          "from": "ai-team",
          "to": "technical-glasses",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:technical-glasses"
          ]
        },
        {
          "from": "duo-test",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "model-lab",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "prompt-vault",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "reasoning-shell",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "shell-guardian",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        },
        {
          "from": "technical-glasses",
          "to": "ai-team",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "ai-team"
          ]
        }
      ]
    },
    {
      "members": [
        "asset-fabric",
        "body-pulse",
        "evolution-foundry",
        "governed-evolution-lab",
        "workshop-direction"
      ],
      "edges": [
        {
          "from": "asset-fabric",
          "to": "evolution-foundry",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "evolution-foundry"
          ]
        },
        {
          "from": "body-pulse",
          "to": "evolution-foundry",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "evolution-foundry"
          ]
        },
        {
          "from": "evolution-foundry",
          "to": "asset-fabric",
          "sources": [
            "contract.consumes",
            "manifest.uses"
          ],
          "tokens": [
            "asset-fabric",
            "service:asset-fabric"
          ]
        },
        {
          "from": "evolution-foundry",
          "to": "body-pulse",
          "sources": [
            "contract.consumes",
            "manifest.uses"
          ],
          "tokens": [
            "body-pulse",
            "service:body-pulse"
          ]
        },
        {
          "from": "evolution-foundry",
          "to": "governed-evolution-lab",
          "sources": [
            "contract.consumes",
            "manifest.uses"
          ],
          "tokens": [
            "governed-evolution-lab",
            "service:governed-evolution-lab"
          ]
        },
        {
          "from": "evolution-foundry",
          "to": "workshop-direction",
          "sources": [
            "contract.consumes",
            "manifest.uses"
          ],
          "tokens": [
            "service:workshop-direction",
            "workshop-direction"
          ]
        },
        {
          "from": "governed-evolution-lab",
          "to": "body-pulse",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:body-pulse"
          ]
        },
        {
          "from": "governed-evolution-lab",
          "to": "evolution-foundry",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "evolution-foundry"
          ]
        },
        {
          "from": "workshop-direction",
          "to": "body-pulse",
          "sources": [
            "manifest.readiness",
            "manifest.uses"
          ],
          "tokens": [
            "body-pulse"
          ]
        }
      ]
    },
    {
      "members": [
        "asset-pack-lab",
        "asset-vault",
        "launcher-card-installer",
        "marketplace-deployment",
        "publish-library",
        "workshop-packager"
      ],
      "edges": [
        {
          "from": "asset-pack-lab",
          "to": "publish-library",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "publish-library"
          ]
        },
        {
          "from": "asset-vault",
          "to": "publish-library",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "publish-library"
          ]
        },
        {
          "from": "launcher-card-installer",
          "to": "publish-library",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "publish-library"
          ]
        },
        {
          "from": "marketplace-deployment",
          "to": "asset-vault",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:asset-vault"
          ]
        },
        {
          "from": "marketplace-deployment",
          "to": "launcher-card-installer",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:launcher-card-installer"
          ]
        },
        {
          "from": "marketplace-deployment",
          "to": "publish-library",
          "sources": [
            "contract.consumes",
            "manifest.uses"
          ],
          "tokens": [
            "publish-library",
            "service:publish-library"
          ]
        },
        {
          "from": "marketplace-deployment",
          "to": "workshop-packager",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:workshop-packager"
          ]
        },
        {
          "from": "publish-library",
          "to": "asset-pack-lab",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:asset-pack-lab"
          ]
        },
        {
          "from": "publish-library",
          "to": "asset-vault",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:asset-vault"
          ]
        },
        {
          "from": "publish-library",
          "to": "launcher-card-installer",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:launcher-card-installer"
          ]
        },
        {
          "from": "publish-library",
          "to": "marketplace-deployment",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "marketplace-deployment"
          ]
        },
        {
          "from": "publish-library",
          "to": "workshop-packager",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:workshop-packager"
          ]
        },
        {
          "from": "workshop-packager",
          "to": "publish-library",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "publish-library"
          ]
        }
      ]
    },
    {
      "members": [
        "game-forge",
        "game-hub",
        "sandbox"
      ],
      "edges": [
        {
          "from": "game-forge",
          "to": "game-hub",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:game-hub"
          ]
        },
        {
          "from": "game-forge",
          "to": "sandbox",
          "sources": [
            "contract.consumes"
          ],
          "tokens": [
            "service:sandbox"
          ]
        },
        {
          "from": "game-hub",
          "to": "game-forge",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "game-forge"
          ]
        },
        {
          "from": "sandbox",
          "to": "game-forge",
          "sources": [
            "manifest.integratedInto"
          ],
          "tokens": [
            "game-forge"
          ]
        }
      ]
    }
  ],
  "explicitTargetsNotTopLevelModules": [
    {
      "moduleId": "ai-team",
      "source": "contract.consumes",
      "token": "service:discovery-role-packs",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "discovery-role-packs",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "ai-team",
      "source": "contract.consumes",
      "token": "service:mirror-native-learning-shell",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "mirror-native-learning-shell",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "audio-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/project-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/project-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "browser-lan-hardware-qa-lab",
      "source": "contract.consumes",
      "token": "service:runtime",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "runtime",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "cognitive-evidence-explorer",
      "source": "contract.consumes",
      "token": "service:cognitive-evidence-labs",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "cognitive-evidence-labs",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "device-handoff",
      "source": "contract.consumes",
      "token": "service:gate",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "gate",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "diagnostics-operations-center",
      "source": "contract.consumes",
      "token": "service:assets",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "assets",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "diagnostics-operations-center",
      "source": "contract.consumes",
      "token": "service:permissions",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "permissions",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "diagnostics-operations-center",
      "source": "contract.consumes",
      "token": "service:recovery",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "recovery",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "diagnostics-operations-center",
      "source": "contract.consumes",
      "token": "service:runtime",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "runtime",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "diagnostics-operations-center",
      "source": "contract.consumes",
      "token": "service:search",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "search",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "film-motion-studio",
      "source": "contract.consumes",
      "token": "service:asset-hands",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "asset-hands",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "film-motion-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/collaboration-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/collaboration-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "film-motion-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/project-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/project-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "film-motion-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/scene-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/scene-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "film-motion-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/timeline-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/timeline-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "game-forge",
      "source": "contract.consumes",
      "token": "service:axm-physics-2d",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "axm-physics-2d",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "governed-evolution-lab",
      "source": "contract.consumes",
      "token": "service:mirror-native-world-genome-organ",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "mirror-native-world-genome-organ",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "learning-lab",
      "source": "contract.consumes",
      "token": "service:mirror-learning-forge",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "mirror-learning-forge",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "learning-lab",
      "source": "contract.consumes",
      "token": "service:shared-engines/collaboration-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/collaboration-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "learning-lab",
      "source": "contract.consumes",
      "token": "service:shared-engines/evidence-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/evidence-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "learning-lab",
      "source": "contract.consumes",
      "token": "service:shared-engines/project-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/project-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "machine-host",
      "source": "contract.consumes",
      "token": "service:gate",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "gate",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "machine-host",
      "source": "contract.consumes",
      "token": "service:runtime",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "runtime",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "marketplace-deployment",
      "source": "contract.consumes",
      "token": "service:backup",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "backup",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "marketplace-deployment",
      "source": "contract.consumes",
      "token": "service:plugin-registry",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "plugin-registry",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "marketplace-deployment",
      "source": "contract.consumes",
      "token": "service:runtime",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "runtime",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "module-installer",
      "source": "contract.consumes",
      "token": "service:backup",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "backup",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "module-installer",
      "source": "contract.consumes",
      "token": "service:gate",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "gate",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "public-release-deployment-adapter",
      "source": "contract.consumes",
      "token": "service:encrypted-secret-vault",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "encrypted-secret-vault",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "publish-library",
      "source": "contract.consumes",
      "token": "service:shared-output-engine-v0.1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-output-engine-v0.1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "recovery-center",
      "source": "contract.consumes",
      "token": "service:gate",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "gate",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "recovery-center",
      "source": "contract.consumes",
      "token": "service:storage",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "storage",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "secrets-permissions-console",
      "source": "contract.consumes",
      "token": "service:gate",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "gate",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:asset-hands/axm.asset-hand-result/v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "asset-hands/axm.asset-hand-result/v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/physics-registry-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/physics-registry-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/project-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/project-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/renderer-registry-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/renderer-registry-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/scene-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/scene-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-engines/timeline-v1",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-engines/timeline-v1",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "spatial-studio",
      "source": "contract.consumes",
      "token": "service:shared-physics/axm-physics-2d",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "shared-physics/axm-physics-2d",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    },
    {
      "moduleId": "studio",
      "source": "contract.consumes",
      "token": "service:asset-hands",
      "state": "EXPLICIT_TARGET_NOT_TOP_LEVEL_MODULE",
      "targetKind": "service",
      "targetModuleId": "asset-hands",
      "truth": {
        "dependencyAvailable": false,
        "dependencyReady": false,
        "versionCompatible": false,
        "activationOrderSelected": false
      }
    }
  ],
  "genericTokens": [
    "CC0-1.0",
    "KTX.2.0",
    "MaterialX.1.38",
    "Timeline.1",
    "adapter.register",
    "ai",
    "artifact-sha256",
    "asset-hands",
    "asset-librarian",
    "asset-metadata",
    "attributed-review-votes",
    "axm.action/v1",
    "axm.animated-raster-recipe/v1",
    "axm.asset-brief/v1",
    "axm.asset-creation-recipe/v1",
    "axm.asset-fabric.machine-review-receipt/v1",
    "axm.asset-fabric.need/v2",
    "axm.asset-hand-gap-report/v1",
    "axm.asset-hand-result/v1",
    "axm.asset-hand/v2",
    "axm.asset-need/v1",
    "axm.asset-source-artifact/v1",
    "axm.asset-validation-receipt/v1",
    "axm.asset-verification-envelope/v1",
    "axm.body-pulse.goal/v1",
    "axm.body-pulse.lease/v1",
    "axm.body-pulse.status/v1",
    "axm.cognitive-resource-meter-status/v1",
    "axm.cognitive-resource.command-center-controls/v1",
    "axm.creation.archive/v1",
    "axm.drawpacket/v1",
    "axm.film-motion.project/v1",
    "axm.foundation-contract-catalog/v1",
    "axm.foundation-implementation-map/v1",
    "axm.game-asset/v1",
    "axm.knowledge-project-handoff/v1",
    "axm.knowledge.research/v1",
    "axm.ktx2-texture-recipe/v1",
    "axm.ktx2-validation-report/v1",
    "axm.living-world.create/v1",
    "axm.living-world.patch/v1",
    "axm.living-world.snapshot/v1",
    "axm.material-graph/v1",
    "axm.mirror-observation-consent/v1",
    "axm.module-bundle/v1",
    "axm.module-contract/v1",
    "axm.module-seam-gap-report/v1",
    "axm.novelty-candidate-set/v1",
    "axm.print-document/v1",
    "axm.review-item/v1",
    "axm.spatial.project/v1",
    "axm.target-canvas/v1",
    "axm.technical-glasses/v1",
    "axm.template-pack/v1",
    "axm.visual-kernel.tokens/v1",
    "axm.workshop-capability-index/v1",
    "axm.workshop-direction.plan/v1",
    "axm.workshop-direction.steward-assessment/v1",
    "backup",
    "basis-universal-wasm",
    "bridge",
    "browser-device-metadata",
    "browser-file-picker",
    "browser-gamepad-api",
    "camera",
    "capability-index",
    "catalog",
    "chatgpt:web-image-generation",
    "child:mirror-learning-shell",
    "cognitive-evidence-labs",
    "cognitive.calibration.write",
    "cognitive.evidence.write",
    "cognitive.measure.local",
    "contract:axm.mirror.cognitive-resource-economics-profile-draft/v1@fa66b93360b0a43da9ac35bd6b128d2c62e9e341d06a4f1fad9c15f31f073ef3",
    "contract:axm.mirror.cognitive-work-observation-draft/v1@74a135eca16239f502d73ecbee296ae49fa8a09316cae4437188b923c500286d",
    "creation-incubator",
    "device.listen",
    "discord:gateway-guild-events",
    "discord:guild-install",
    "discovery",
    "evidence",
    "export",
    "files",
    "filesystem-evidence",
    "filesystem:assets",
    "filesystem:exports",
    "film-motion-core",
    "future:axm.game-asset/v1",
    "future:workshop-capability-catalog",
    "future:world-observation-stream",
    "game-hub:asset-handoff",
    "game-runtime-optional",
    "game.manifest.json",
    "gate",
    "gate:axm",
    "glTF.2.0",
    "gltf-2.0",
    "governance",
    "growth",
    "host-telemetry",
    "human-passphrase",
    "human-review",
    "human-visual-approval",
    "human.attention.write",
    "human:explicit-consent",
    "identity",
    "identity-core",
    "identity:gemini-local",
    "identity:nova",
    "jspdf",
    "local-cc0-source-library",
    "local-network",
    "logs",
    "machine.execute",
    "media.render",
    "merge-gate",
    "mirror-kernel",
    "mirror-learning-forge",
    "mirror-native",
    "mirror.intake-receipt.import",
    "mirror.observe",
    "module-manifest",
    "module-manifests",
    "module-selftest-entrypoints",
    "module.install",
    "network",
    "network-optional",
    "network.fetch",
    "network.listen",
    "network:explicit-world-bank-v2",
    "official-https-origins",
    "optional-adapter:ffmpeg",
    "optional-ai",
    "plugins",
    "private-lan",
    "profile",
    "profile:hardware",
    "project-files",
    "provider-declarations",
    "provider-router:axm-ask",
    "provider:explicit-declaration",
    "provider:explicit-mirror-intake-receipt",
    "public-workshop-source",
    "qa.run",
    "reasoning",
    "recovery.apply",
    "registry",
    "release.deploy",
    "resource-governance",
    "review",
    "runtime",
    "selected-device-handoff-files",
    "server-export",
    "settings",
    "shared-engines",
    "shared-output-engine",
    "shared-physics",
    "source:explicit-power-or-carbon-evidence",
    "spatial-core",
    "specialists",
    "storage",
    "storage:axm",
    "subject:grafthold-globe-v0.9-pulse-copy",
    "sustainability.evidence.write",
    "template-source",
    "three-webgl",
    "training",
    "user-file:csv-json",
    "verification",
    "visual-kernel",
    "wisdom",
    "worker-threads",
    "workshop-relative-evidence-paths",
    "workshop:body-pulse-state",
    "workshop:capability-index",
    "workshop:chatgpt-connector-status",
    "workshop:connector-status",
    "workshop:live-readiness",
    "workshop:module-contracts",
    "workshop:presence-notices",
    "workshop:source-metadata",
    "workshop:test-declarations",
    "workshop:tool-manifests",
    "workspace:ai-team",
    "workspace:game-forge",
    "workspace:knowledge-canvas",
    "workspace:project-room",
    "world.mutate",
    "world.restore"
  ],
  "duplicateManifestIds": [],
  "readIssues": [],
  "scopeBoundary": "Only targets matching a current top-level module ID form edges. Explicit service:/module:/tool: names without that match are reported as not observed in this scope, never called missing; generic tokens remain uninterpreted.",
  "truth": {
    "dependencyAvailabilityProbed": false,
    "readinessProbed": false,
    "versionResolutionPerformed": false,
    "activationOrderSelected": false,
    "providerSubstitutionPerformed": false,
    "networkUsed": false,
    "dependencyInstalled": false,
    "declarationRepairPerformed": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "permissionChanged": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
