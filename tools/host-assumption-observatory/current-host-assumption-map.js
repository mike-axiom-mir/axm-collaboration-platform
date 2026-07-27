'use strict';
window.AXM_HOST_ASSUMPTION_MAP = {
  "schema": "axm.host-assumption-map\u002fv1",
  "version": "v0.2",
  "measuredAt": "2026-07-27T03:07:50.766Z",
  "freshnessTtlMs": 7200000,
  "source": {
    "label": "axm-workshop-v4",
    "fingerprint": "60020b002fcef917bec1bc854d5c0178b2d1071beb04f0bde7cec003b8a9b1f5",
    "filesRead": 134,
    "symlinksFollowed": false,
    "skippedSymlinks": []
  },
  "summary": {
    "modules": 81,
    "contractsPresent": 53,
    "contractUnknown": 28,
    "declarationOccurrencesScanned": 952,
    "assumptionOccurrences": 203,
    "uniqueAssumptions": 63,
    "modulesWithAssumptions": 68,
    "unclassifiedDeclarationOccurrences": 749,
    "kindOccurrences": {
      "ABSOLUTE_PATH_SYNTAX": 0,
      "BACKSLASH_PATH_SYNTAX": 0,
      "BROWSER_ENVIRONMENT_DECLARATION": 45,
      "ENVIRONMENT_VARIABLE_SYNTAX": 0,
      "FILESYSTEM_DECLARATION": 113,
      "HOST_RESOURCE_DECLARATION": 1,
      "NETWORK_ENVIRONMENT_DECLARATION": 14,
      "OPERATING_SYSTEM_LITERAL": 0,
      "RUNTIME_OR_TOOL_DECLARATION": 30
    },
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
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "agent-tool-forge",
      "folder": "agent-tool-forge",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "200cf78db759e8c83f29bbd576ebc1db27ce35370c4672274e74365d331fe74e",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "ai-task-talk",
      "folder": "ai-task-talk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f48a2f106a3c30144a984d0512594db06314679e26655fc8272c3f4fbff21a7c",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "ai-team",
      "folder": "ai-team",
      "version": "v1.6",
      "status": "TEST",
      "manifestSha256": "ec9967ed3fc242da4999ab2c9fefb6f1e88de1b0d4232f12c4d6e05a57c31343",
      "contractState": "PRESENT",
      "contractSha256": "e468d6025035607217edcac9ca71c8d7d17da60965b451cc879a645349b2939f",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "asset-fabric",
      "folder": "asset-fabric",
      "version": "v0.9",
      "status": "EXPERIMENTAL",
      "manifestSha256": "39820dc432c5557767641b2faa93035cbc6f6da749a2d61e69cc97c2930f1dd0",
      "contractState": "PRESENT",
      "contractSha256": "67306f073af105b2009478daaecb8952bd057092bcb0ff57b919bd464f530ec3",
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "asset-filesystem-service",
      "folder": "asset-filesystem-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "fe8d5c9a7c817134d1f7a3633a6085ef683fd9d5c9d6db5c80fa2ea497b88f57",
      "contractState": "PRESENT",
      "contractSha256": "5f113ad934ea765bbe55607b60d5e3d98d7c216714e71baa45d5267604a5cfb2",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "asset-pack-lab",
      "folder": "asset-pack-lab",
      "version": "v0_1",
      "status": "TEST",
      "manifestSha256": "0e6d937903d85af1c353caaa579cb1a166b8883415a92d078552e1768fa7d6e0",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "asset-vault",
      "folder": "asset-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "0093d3c66fb9b32235d5ce0912357216c7c19e149c6e1816a97a302a090354c7",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "audio-studio",
      "folder": "audio-studio",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "dcb77280455c850add26e05b203fe27b7e229d78c7bc73ff7a7dd0f745aba6b8",
      "contractState": "PRESENT",
      "contractSha256": "110e66bacdcd6ec1129386d622955ae59baae7206d3a11c6d7fa44403d8dfca3",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "body-pulse",
      "folder": "body-pulse",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "db55e7ebe04861ea16c590169e74346eb10ddeb8167a9700efa470483fe85c70",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "HOST_RESOURCE_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "browser-lan-hardware-qa-lab",
      "folder": "browser-lan-hardware-qa-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b0863665551424f6c0bfb4750efeaff3c1a84774076ab7bb36126b709a964ae9",
      "contractState": "PRESENT",
      "contractSha256": "55c930b7317816e7388cac10c9b0e91a5e2a48b4c8bf46d271eb6d8ccaab9783",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "chatgpt-connector",
      "folder": "chatgpt-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f7332d743398d4bdf9a645c655b7981b43c4c10538d590e67f88c1163a8a377a",
      "contractState": "PRESENT",
      "contractSha256": "68f2a0195b1ba580438c92fff2341bdd6a43d65b6532c8d51eb79c79371a186c",
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ]
    },
    {
      "id": "claude-connector",
      "folder": "claude-connector",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a425c016edf3d7eff94328fbfc8ceab16d13f63541c7ee97cc0d27c8066790b2",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "cognitive-calibration-lab",
      "folder": "cognitive-calibration-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2aabc53b7712e49a7343f8fb29351553f030e0093a852c4d2d6134ec63dd7db5",
      "contractState": "PRESENT",
      "contractSha256": "c6921ef254fbb33711843799140dfebb1c467652bdfcbefbe908e0bbf5e72a7a",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "cognitive-evidence-explorer",
      "folder": "cognitive-evidence-explorer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "ceb9e0ae81a31e168ed3dd5007e305a743b5f49589a9e591b1fd6becb44c8355",
      "contractState": "PRESENT",
      "contractSha256": "7441cbeb0ff3250342955183b2277c2c7f1839d68dd5cdf09c13a30a4272dd0f",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "cognitive-resource-meter",
      "folder": "cognitive-resource-meter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ba30cc5ef82fb6c75357d435d33106d4687c7d5a66e35480741638743c289a1",
      "contractState": "PRESENT",
      "contractSha256": "6e503acd149d8592ce244032015e2d0e0d8ab07dbfcdd994ac081890328a3b8a",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "device-handoff",
      "folder": "device-handoff",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "121fc27bc7b8b055a70b70ca86c178d1616a313d34a3bf1bdc64636fb5dbf27a",
      "contractState": "PRESENT",
      "contractSha256": "99179177c998708610d8b63c6af7d83a6e10741aaabb383ca014a3922da34455",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION",
        "NETWORK_ENVIRONMENT_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "diagnostics-operations-center",
      "folder": "diagnostics-operations-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b8e73dfaf90bb079fd8c1b0dbbcfb1f24c2bc1dac692c81b2e79ef6bd297958f",
      "contractState": "PRESENT",
      "contractSha256": "a36c359a04bc91388344834076aea413023413c12beca806710667aed1ec8ea0",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 4,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "discord-bridge",
      "folder": "discord-bridge",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "b7c89071e4b2e1f0308014e8d2233518896e3be0e72dc92689b0d48c9c9104f6",
      "contractState": "PRESENT",
      "contractSha256": "9952a1705e2cd70f1f0b602d6b15e56891bc8418b9f367a82fd175fe3b763ebb",
      "assumptionOccurrences": 3,
      "uniqueAssumptions": 3,
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ]
    },
    {
      "id": "discovery-engine",
      "folder": "discovery-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "52410d815be87e3c28519b7e31c0f843d0190e75dad6dcf86e29466458e046f8",
      "contractState": "PRESENT",
      "contractSha256": "6f72b569141b16d5692a3160170de6ed82a6d10d4de4a30b35b8b29bb23cc901",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "duo-test",
      "folder": "duo-test",
      "version": "v3",
      "status": "TEST",
      "manifestSha256": "897f42ecbe7381c932209e1dbb6602b7b0d74343f7535d2c879e2e94933acfb8",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "evidence-desk",
      "folder": "evidence-desk",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "010e29cd34b47ede7679f7b5c72ab74ee71b43d987d18d4ed57e68df7ac87e92",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "evolution-foundry",
      "folder": "evolution-foundry",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "f903daddad720a6a9a592324098a0f80053ed41fbef898d2a66fcc4853911f0f",
      "contractState": "PRESENT",
      "contractSha256": "2e1952c2a7d65b445813996ad16ac80fdedbfecd563ab9ce2ba47bd12f9c1370",
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "film-motion-studio",
      "folder": "film-motion-studio",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "1f21c86ff30928ae2b0a44e5656ee23c579bb4be691ea3c11dfa50d8bbe7c14c",
      "contractState": "PRESENT",
      "contractSha256": "d738c75f735d1330200b6a167f3d0d82b7490965cb31d81b79094154dd5f9a4e",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "finance-world-room",
      "folder": "finance-world-room",
      "version": "v0.1-experimental",
      "status": "EXPERIMENTAL",
      "manifestSha256": "6149787ea95bb84b3e1daee9208895519e12057a66717a33b7118664e0bacdfb",
      "contractState": "PRESENT",
      "contractSha256": "bb3e064878281da31e7fe3c947c1f3d7cbc63a85f04a6d431e31590feee952a7",
      "assumptionOccurrences": 7,
      "uniqueAssumptions": 6,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION",
        "NETWORK_ENVIRONMENT_DECLARATION"
      ]
    },
    {
      "id": "forge",
      "folder": "forge",
      "version": "v1",
      "status": "TEST",
      "manifestSha256": "2091a1a62f14fcf07bfa8bad509f7e8fe742b8a82c1ce4d52bacf91dd829a591",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "forge-line",
      "folder": "forge-line",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3c938ff93a2f00b5b7bf33c6b31ed1d04eec02d36f4cd14b73bb2007e9529d29",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "foundation-intake-steward",
      "folder": "foundation-intake-steward",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3311a72239053bfecd476ae0bf3f3eeba93fa422d41f68ba0e13097d8ac3d8a4",
      "contractState": "PRESENT",
      "contractSha256": "a342467e45eca2e73f10c9a7e6674b9f05c1ec4e670ee15e2d0a7f0b6d73ec00",
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "game-forge",
      "folder": "game-forge",
      "version": "v1.2",
      "status": "TEST",
      "manifestSha256": "a67e304216a7b62ee78fd7efd4eb25ac9460f56f1457a600ff728f74a54af0fe",
      "contractState": "PRESENT",
      "contractSha256": "556c76e85f39545cc7ebc431c5433d9d6a54fa4dbcd6b2b9c5c406060db96638",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "game-hub",
      "folder": "game-hub",
      "version": "v0.4",
      "status": "TEST",
      "manifestSha256": "58bb348ce231e097cfa2e89e77e48a490988f2b81bf77ca297d031139264e797",
      "contractState": "PRESENT",
      "contractSha256": "683285382423fc736a735d9161681231236d5295eb4fa824e40c40e9f141054e",
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "geographic-market-map",
      "folder": "geographic-market-map",
      "version": "v0.1-polished-review",
      "status": "EXPERIMENTAL",
      "manifestSha256": "ecaa4efa23fe43841d74e708fe85b0325cae480c312970b35e81917c68d40521",
      "contractState": "PRESENT",
      "contractSha256": "9858b1e2f8650aad4db497559af0832c8076707863a04dd75e282d289f1beb42",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "governed-evolution-lab",
      "folder": "governed-evolution-lab",
      "version": "v0.1.1-epoch",
      "status": "EXPERIMENTAL",
      "manifestSha256": "20035ea582af41af85a82db8641ce4bd12aa1075fbf072fb122a084c5ff539cf",
      "contractState": "PRESENT",
      "contractSha256": "24f8acce91fb11dded1e818e08eb72a88d9af98f2e35c72101b95d8d39c90745",
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "graft",
      "folder": "graft",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "31c10f7032c1cf4b88e15d111cffe414410bec661afc87a35394dfafc6c9808e",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "hermes-local",
      "folder": "hermes",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3553916184c1f5d08e0757024e79e4dfc99ec8a9af4dd1a5949943461a2d1d21",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "hub-test-room",
      "folder": "hub-test-room",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "b04a50f1a79b91a3b1ffcbcee3eccf17e3a2cfe314637ee7d7ebf8fd75e2efe1",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "human-attention-ledger",
      "folder": "human-attention-ledger",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "1178063e1b19785606f974a387900ce9700c2c475bb929feb8d47795a6496d28",
      "contractState": "PRESENT",
      "contractSha256": "c16981d71e28216c789c4aeaa897bcf0297605ea1c01b36f8cbeb4dc84b006fe",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "judgement-chamber",
      "folder": "judgement-chamber",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "9f84c4e43c61e330e68131739898316c992da2f50fbf6077c9fc90867aeb0f12",
      "contractState": "PRESENT",
      "contractSha256": "1a37a8297e11101cd02fa7aae7ed1eac3e7e4407386c0fd8781e00c4ca57fdce",
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "knowledge-canvas",
      "folder": "knowledge-canvas",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "a17fdba57fc8f99d565d0d8ca4e95c21da00348fb5214eda988c73a8ebdd510f",
      "contractState": "PRESENT",
      "contractSha256": "2001402ba9cda6e4896afc0d24f70470203c1117fbf244044dadd0fb2c1fead4",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "launcher-card-installer",
      "folder": "launcher-card-installer",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "312b3f8f5817eeee290ff9ede16842b0dc494c31c9908ecb61c0f19c2cdfbda4",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "learning-lab",
      "folder": "learning-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "f2f189c429c283b66000ac31591bc31f06431a087104e7ea761a366a3095f8d8",
      "contractState": "PRESENT",
      "contractSha256": "6b3337b43e9e041f215f87cfd026a445d6a8b7090b7ca58e83d4bfba21be68ab",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "living-world-ruleset-physics-adapter-kit",
      "folder": "living-world-ruleset-physics-adapter-kit",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "e769d0297e27974466e26d113e04dee3a830257059ba8cb0e98315efcd3d74e4",
      "contractState": "PRESENT",
      "contractSha256": "a65a6329269ed8370835b839761d1b2bee47da56b4d6b13e13b0851af58cb938",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "living-world-state-server",
      "folder": "living-world-state-server",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "c5a5fc7a9d4795603413d45a6233ce47f37461af04eb279b3b13ae086b8135f0",
      "contractState": "PRESENT",
      "contractSha256": "86d90d3191462b30308ac6927c1f999b45a59343eec7badde8836a2e6fe2a778",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "machine-host",
      "folder": "machine-host",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "3a2f14eeb215ba5ccd460dc4735d8927bd33ff37787921bb6b016b1f4d3d4138",
      "contractState": "PRESENT",
      "contractSha256": "ee1a6c6093096a001c39436597f921635bcd6b802e6d1f83a7da6a7008b98aaa",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 3,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "main-hub",
      "folder": "main-hub",
      "version": "v0.1",
      "status": "SHELL",
      "manifestSha256": "568965995d855a9a5d9e6f75e6df4bf237afb18fb95f19e17e2b6eb7d82b77b3",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "marketplace-deployment",
      "folder": "marketplace-deployment",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "28787e3e870446ae08fd977c241a817b473dabf7cf02f093fa9f94960ffd960f",
      "contractState": "PRESENT",
      "contractSha256": "3376966b11173b0e952e798839ebb25e030c9973eb8ba43792191dbfb7c07f91",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "media-render-transcode-service",
      "folder": "media-render-transcode-service",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "753ff72e597a6e4e40b153d85d12a5d2b28c15c3ca5fdd8491456f4d484feafc",
      "contractState": "PRESENT",
      "contractSha256": "640c10658848bc662c93432a37962cf1ee1e62470da22defb32ed7b4cf4b5160",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 5,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "mirror-intake-monitor",
      "folder": "mirror-intake-monitor",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "491446d13cd39708714a2c365c17bd64353d7d98230822a3809f50a3ef02d198",
      "contractState": "PRESENT",
      "contractSha256": "9da2265518274632ff0f922f26cfec6c4643fadcfe6923b43e3216c731b60964",
      "assumptionOccurrences": 3,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "mirror-learning-shell",
      "folder": "mirror-learning-shell",
      "version": "v0.2-shared-door",
      "status": "TEST",
      "manifestSha256": "007e91010eaaf7ee72030fb644a3229d5902b8857f1069f432646ebbb3982dfb",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "model-lab",
      "folder": "model-lab",
      "version": "v0.2",
      "status": "TEST",
      "manifestSha256": "3d8c88c29e6fb6846149968af60c265622f469c6053167961131bf069a977941",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "module-contract-workbench",
      "folder": "module-contract-workbench",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "2cb41adf26848d530bd6d6b77da1f39e6ff8fe79f6e5a385d85008688365092a",
      "contractState": "PRESENT",
      "contractSha256": "a955c82f5e563efeed6133b1f755d1a854c203a47f78343a7cf6985e1b1f6380",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "module-installer",
      "folder": "module-installer",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "39c0969090ff3c4655dcf712c521d06e477d1fd1c738cc1f34fa5ec7b100b3eb",
      "contractState": "PRESENT",
      "contractSha256": "e41338e7906578990073a9343d617c19bf80c865b450b7f11c2d9625ff268ac0",
      "assumptionOccurrences": 3,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "multiplayer-controller-transport",
      "folder": "multiplayer-controller-transport",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9525ff047b7f8454dc85c0335230e6a09cef33363e85c302e1b4b072fc006ca9",
      "contractState": "PRESENT",
      "contractSha256": "5b166cf5fbe77e9f039e7970dc4e8228c9c563aaa31959f3918a69b060c81314",
      "assumptionOccurrences": 7,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "NETWORK_ENVIRONMENT_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "novelty-diversity-engine",
      "folder": "novelty-diversity-engine",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "7fbc62a2ff53d950e2f2488ddeec22952e1da99b2d10097ae9b94aa5c7cd25af",
      "contractState": "PRESENT",
      "contractSha256": "76c7e71849ac5ddbff9d7f0b22607c01e6647a4fe0d7b38c21c83d1e3530e748",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "prehub",
      "folder": "prehub",
      "version": "v1",
      "status": "WORKING",
      "manifestSha256": "2be9d79a9107d71a3dbe5d47d7a447bdc9354ed36acc887fc6913dc904342d8f",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "project-room",
      "folder": "project-room",
      "version": "v0.3",
      "status": "TEST",
      "manifestSha256": "585e18a82d88561227b2348a58af6419febb7590230d09d177fa16af80e16bc9",
      "contractState": "PRESENT",
      "contractSha256": "195ff276717664b56540265b0f0bd8d84d5485e67cc2de489117937c30a4daea",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "prompt-vault",
      "folder": "prompt-vault",
      "version": "v0_2",
      "status": "TEST",
      "manifestSha256": "43595589df949012ab9a4c76d91cf32673223fb796d66ae4c95e70dec491cbac",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "ps2-asset-forge",
      "folder": "ps2-asset-forge",
      "version": "v0.2",
      "status": "EXPERIMENTAL",
      "manifestSha256": "dc9e11e38f0fd53717d384fdf713cace6b5ed52ce8e0f86189058b1aed9803bf",
      "contractState": "PRESENT",
      "contractSha256": "beb1d51adf62fd1656d1b9f6b50343e1b661b2808757d051385130dedcd11340",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "public-release-deployment-adapter",
      "folder": "public-release-deployment-adapter",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "30223dfa7d71b124d00ec9d9eb252d621704cd9e8be531710943ab0749c02009",
      "contractState": "PRESENT",
      "contractSha256": "c275a331e7c70b8460f2b7a1c4e9c8c80e2a80fe359c6fea7abb7511b158d211",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "publish-library",
      "folder": "publish-library",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "09e2a23c12442583df76e4dbb6f3b9006a29437853ef62ca4f13a27153e2fe34",
      "contractState": "PRESENT",
      "contractSha256": "dbc050c9e5fe69b38d2d93bb708a8ee33c41c7eb27b9ebf96404d15c9c31a1fb",
      "assumptionOccurrences": 5,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "read-only-mirror-world-adapter",
      "folder": "read-only-mirror-world-adapter",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "5f9d51195a1d4e27f6cc6847a659aa080fd64de20f13008db10560fe5dbce17e",
      "contractState": "PRESENT",
      "contractSha256": "28db9400a476e79117403c9e3571f30ac0fd8364ab697cb2f147cc1237c8800d",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "reasoning-shell",
      "folder": "reasoning-shell",
      "version": "v0.1-branch",
      "status": "TEST",
      "manifestSha256": "edbb3418123c90d7be4dd9693e328a60efeb0fc6e6781f010b05cf1acdea9528",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "recovery-center",
      "folder": "recovery-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5561fe713f07b5dcaa8b452970ca0b71bc1ef6e2099212b85ca65892a2145b44",
      "contractState": "PRESENT",
      "contractSha256": "4ca51cbb9e00175fd035c5c534be0986c98b908d66326843db2e0ef75b4e3fe9",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "review-inbox",
      "folder": "review-inbox",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "6dafb4a9d20580a353cac6559c6f08f147508f4397a05f5f9d53776a7d3c3306",
      "contractState": "PRESENT",
      "contractSha256": "b6faf1d0ce5035359d1399312ff1b8dedfa6998e81beaf119da24076ed04cdcb",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "route",
      "folder": "route",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "a27d7be754746910d4af1e46f21a51f1d8b3004926ca8a5b0d356cf9feee67cb",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "runner",
      "folder": "runner",
      "version": "v1.1",
      "status": "TEST",
      "manifestSha256": "9f3c3402cec092448476066027a7eda85ec15335c5816966bdefc0632b3b4285",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "sandbox",
      "folder": "sandbox",
      "version": "v0.1-session1",
      "status": "TEST",
      "manifestSha256": "d8834cad606c008760945a24eed2e5899b01c115c865eb8a1f0008790707fb57",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "secrets-permissions-console",
      "folder": "secrets-permissions-console",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "edb768d452c8c5d45b7c4f1db7269861c998d7b546554a2b579f794e9b2c9bdd",
      "contractState": "PRESENT",
      "contractSha256": "342f4455903e2ab9b324804c0e7c709dfc433d3d212eba89ee12b4e63585a989",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "shell-guardian",
      "folder": "shell-guardian",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5546920048530ec78a372b78b9457d8e1d4db67abaac37c7693c9f1f920e8511",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 1,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "skinner",
      "folder": "skinner",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "e279534e785c4fc6ddd54da6b59953c3113f727a2b9797b0e1f800fd81bd435f",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "source-connector-hub",
      "folder": "source-connector-hub",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "db7e6c865e7af9b637893aa07626cb2dc24eec4e6037b57ee79e4f526d096387",
      "contractState": "PRESENT",
      "contractSha256": "f3fd3db09661d6bfafcdf07f8bd93313937141b9bbac117db8c24699e830bf6c",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 2,
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ]
    },
    {
      "id": "spatial-studio",
      "folder": "spatial-studio",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "bf4b87c868e91acfa4f3e2cb4509bdb453cb7112d88a969e5f5cce411d0930ad",
      "contractState": "PRESENT",
      "contractSha256": "e8bf0d69a771bfbfd453bcba8c44a7f6e0ee10667eec341be5ca6eb07bcfe0af",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 5,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "studio",
      "folder": "studio",
      "version": "v2.5",
      "status": "TEST",
      "manifestSha256": "b61af3f4615f16750878725c984eb206620d59c02f65b83257ba351bbd4e5ec4",
      "contractState": "PRESENT",
      "contractSha256": "0034ba4ac17568a19f6e03f16ef2ce51d912aec279f53cca0269607dc89bd9b9",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 4,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "sustainability-metrology-lab",
      "folder": "sustainability-metrology-lab",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "77d7b2d3a7fb67892a31f7b2cc5d21c03329451321b83a845f1347a0aa5636b6",
      "contractState": "PRESENT",
      "contractSha256": "b4a05f0001bf75ddb1a04e29ef8a13a9cfacb18174380ab40bd64148ac3d91ab",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "technical-glasses",
      "folder": "technical-glasses",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "5a2930adf2f06184a1d0e1d496222802d8124203ee52403cf6e628c8172c463c",
      "contractState": "PRESENT",
      "contractSha256": "de740ba5ef172efbb0bb4d298cec7b09dd351d3d67f86a59b40762b5c9e8ff90",
      "assumptionOccurrences": 6,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION",
        "RUNTIME_OR_TOOL_DECLARATION"
      ]
    },
    {
      "id": "template-runtime-pack-engine",
      "folder": "template-runtime-pack-engine",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "9f5f2f18a3a65a4fb6dbb7dfb1bf545682b37bf739e9fde5d1f5437996f0c96d",
      "contractState": "PRESENT",
      "contractSha256": "b6f6edc3b71986c51a9db07e2a6d7245bc2bdf1fd1877396cb69e4d8b45e35b1",
      "assumptionOccurrences": 3,
      "uniqueAssumptions": 2,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "ui-ux-builder",
      "folder": "ui-ux-builder",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "c5a1e1484e2b10a69ffcd6ef61d52d79e61ac15d2da35d75783a346860e63df7",
      "contractState": "PRESENT",
      "contractSha256": "a7fee666276df11a982482d545940bc75df33fed1bb3efbe30ece7333fb32887",
      "assumptionOccurrences": 4,
      "uniqueAssumptions": 3,
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION",
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "verifier",
      "folder": "verifier",
      "version": "v1.0",
      "status": "TEST",
      "manifestSha256": "ee20bd953bec0a195f23278be712fd1ec4a921e936544c74768b078fe240c826",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "workshop-command-center",
      "folder": "workshop-command-center",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "7ffa0ab48d7b25218328d710558cd5527650a1f313ccdb7ec2c99a55945084e9",
      "contractState": "PRESENT",
      "contractSha256": "940eb34276050eed62cd398fd0c98ca3ef2b5ed4b1b1649a425aed145c59828f",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "workshop-direction",
      "folder": "workshop-direction",
      "version": "v0.1",
      "status": "EXPERIMENTAL",
      "manifestSha256": "8ca0ec56981b2c3571c7609fc1d1fc670b606c58db2f5d8f938d6b9a5a722d61",
      "contractState": "PRESENT",
      "contractSha256": "43d39c69a7cd9cc414a87b7f3773fd51411651d84acaf11d8be0d471c107e466",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    },
    {
      "id": "workshop-packager",
      "folder": "workshop-packager",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "40d335d09d59946e418c19a777b157c003e71873dfe200877a832ce3a165bdd0",
      "contractState": "NOT_DECLARED",
      "contractSha256": null,
      "assumptionOccurrences": 0,
      "uniqueAssumptions": 0,
      "kinds": []
    },
    {
      "id": "workshop-search-provenance",
      "folder": "workshop-search-provenance",
      "version": "v0.1",
      "status": "TEST",
      "manifestSha256": "369328f81cf29263512294aeb8ac00c7ce171e1753e16e7f50a36414bfcfa9cd",
      "contractState": "PRESENT",
      "contractSha256": "47f0e7d3f8ad4fe99f6f124aba20f4ad706626098de657914c5c3bd825703e31",
      "assumptionOccurrences": 2,
      "uniqueAssumptions": 1,
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ]
    }
  ],
  "assumptions": [
    {
      "token": "assets\u002finbox\u002fdevice-handoff",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "device-handoff"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "device-handoff",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "backups\u002fmodule-installer",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "module-installer"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "module-installer",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "backups\u002frecovery-center",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "recovery-center"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "recovery-center",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-device-metadata",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "browser-lan-hardware-qa-lab"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "browser-lan-hardware-qa-lab",
          "role": "contract.consumes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-file-picker",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "device-handoff"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "device-handoff",
          "role": "contract.consumes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-gamepad-api",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "multiplayer-controller-transport"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "contract.consumes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:ai-team-workspace",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "ai-team"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "ai-team",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:artifact-inbox",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "publish-library"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "publish-library",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.audio-studio.project.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "audio-studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "audio-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.film-motion.project.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "film-motion-studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "film-motion-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.knowledge-canvas.inbox.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "knowledge-canvas"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "knowledge-canvas",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.knowledge-canvas.project.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "knowledge-canvas"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "knowledge-canvas",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.learning-lab.project.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "learning-lab"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "learning-lab",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.project-room.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "project-room"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "project-room",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.project-room.v1:explicit-task-or-decision",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "knowledge-canvas"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "knowledge-canvas",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.publish-library.ledger.v1:unreviewed-artifact",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "audio-studio",
        "film-motion-studio",
        "spatial-studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "audio-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "film-motion-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "spatial-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.spatial.project.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "spatial-studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "spatial-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.spatial.shared.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "spatial-studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "spatial-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:axm.uiux-builder.v1",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "ui-ux-builder"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "ui-ux-builder",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:dataset-and-training-ledger",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "ai-team"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "ai-team",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:discovery-engine",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "discovery-engine"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "discovery-engine",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:finance-world-room",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "finance-world-room"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "finance-world-room",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:game-forge-projects",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "game-forge"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "game-forge",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:geographic-market-map",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "geographic-market-map"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "geographic-market-map",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:marketplace-deployment-project",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "marketplace-deployment"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "marketplace-deployment",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:release-ledger",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "publish-library"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "publish-library",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "browser-local:studio-workspaces",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "chatgpt:web-image-generation",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "chatgpt-connector"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "chatgpt-connector",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "discord:configured-channel:sanitized-receipts-only",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "discord-bridge"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "discord-bridge",
          "role": "contract.boundaries.writes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "discord:gateway-guild-events",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "discord-bridge"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "discord-bridge",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "discord:guild-install",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "discord-bridge"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "discord-bridge",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports:game-forge-candidates",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "game-forge"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "game-forge",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fasset-packs",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "asset-filesystem-service"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "asset-filesystem-service",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fcognitive-resource-meter:explicit-exact-draft-or-evidence-bundle",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "cognitive-resource-meter"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "cognitive-resource-meter",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fdiagnostics\u002fexplicit-report",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "diagnostics-operations-center"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "diagnostics-operations-center",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fmedia-renders",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "media-render-transcode-service"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "media-render-transcode-service",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fpublic-deployments",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "public-release-deployment-adapter"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "public-release-deployment-adapter",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002ftemplate-packs",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "template-runtime-pack-engine"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "template-runtime-pack-engine",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "exports\u002fworkshop-packages",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "recovery-center"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "recovery-center",
          "role": "contract.boundaries.writes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "filesystem:assets",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "asset-filesystem-service",
        "media-render-transcode-service"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "asset-filesystem-service",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "media-render-transcode-service",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "filesystem:exports",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "media-render-transcode-service",
        "public-release-deployment-adapter"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "media-render-transcode-service",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "public-release-deployment-adapter",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "host-telemetry",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "HOST_RESOURCE_DECLARATION"
      ],
      "modules": [
        "body-pulse"
      ],
      "roles": [
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "body-pulse",
          "role": "manifest.uses",
          "kinds": [
            "HOST_RESOURCE_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "hub-store:studio",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "studio"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "learner-private:only-through-child-school-contract",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "learning-lab"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "learning-lab",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "network:explicit-world-bank-v2",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "finance-world-room"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "finance-world-room",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "network.fetch",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "source-connector-hub"
      ],
      "roles": [
        "contract.permissions",
        "manifest.permissions",
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "source-connector-hub",
          "role": "contract.permissions",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "source-connector-hub",
          "role": "manifest.permissions",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "source-connector-hub",
          "role": "manifest.uses",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "network.listen",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "multiplayer-controller-transport"
      ],
      "roles": [
        "contract.permissions",
        "manifest.permissions",
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "contract.permissions",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "manifest.permissions",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "manifest.uses",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "official-https-origins",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "source-connector-hub"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "source-connector-hub",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "optional-adapter:ffmpeg",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "media-render-transcode-service"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "media-render-transcode-service",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "private-lan",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "NETWORK_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "device-handoff",
        "multiplayer-controller-transport"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "device-handoff",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "contract.consumes",
          "kinds": [
            "NETWORK_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "provider:explicit-declaration",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "cognitive-resource-meter"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "cognitive-resource-meter",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "provider:explicit-mirror-intake-receipt",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "mirror-intake-monitor"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "mirror-intake-monitor",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "runtime",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "ai-team",
        "body-pulse",
        "browser-lan-hardware-qa-lab",
        "cognitive-evidence-explorer",
        "device-handoff",
        "diagnostics-operations-center",
        "machine-host",
        "marketplace-deployment",
        "media-render-transcode-service",
        "multiplayer-controller-transport",
        "novelty-diversity-engine",
        "technical-glasses"
      ],
      "roles": [
        "contract.permissions",
        "manifest.readiness",
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "ai-team",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "body-pulse",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "browser-lan-hardware-qa-lab",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "browser-lan-hardware-qa-lab",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-evidence-explorer",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-evidence-explorer",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "device-handoff",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "diagnostics-operations-center",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "diagnostics-operations-center",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "machine-host",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "machine-host",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "marketplace-deployment",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "media-render-transcode-service",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "media-render-transcode-service",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "multiplayer-controller-transport",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "novelty-diversity-engine",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "novelty-diversity-engine",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "contract.permissions",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "service:runtime",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "browser-lan-hardware-qa-lab",
        "diagnostics-operations-center",
        "machine-host",
        "marketplace-deployment"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "browser-lan-hardware-qa-lab",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "diagnostics-operations-center",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "machine-host",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "marketplace-deployment",
          "role": "contract.consumes",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "storage",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "agent-command-center",
        "agent-tool-forge",
        "ai-task-talk",
        "ai-team",
        "asset-fabric",
        "asset-filesystem-service",
        "asset-pack-lab",
        "asset-vault",
        "audio-studio",
        "body-pulse",
        "claude-connector",
        "cognitive-calibration-lab",
        "cognitive-resource-meter",
        "device-handoff",
        "diagnostics-operations-center",
        "discovery-engine",
        "duo-test",
        "evidence-desk",
        "evolution-foundry",
        "film-motion-studio",
        "finance-world-room",
        "forge",
        "forge-line",
        "game-forge",
        "geographic-market-map",
        "governed-evolution-lab",
        "human-attention-ledger",
        "judgement-chamber",
        "knowledge-canvas",
        "learning-lab",
        "living-world-ruleset-physics-adapter-kit",
        "living-world-state-server",
        "machine-host",
        "marketplace-deployment",
        "mirror-intake-monitor",
        "model-lab",
        "module-contract-workbench",
        "module-installer",
        "novelty-diversity-engine",
        "prehub",
        "project-room",
        "prompt-vault",
        "publish-library",
        "read-only-mirror-world-adapter",
        "reasoning-shell",
        "recovery-center",
        "review-inbox",
        "sandbox",
        "secrets-permissions-console",
        "shell-guardian",
        "spatial-studio",
        "studio",
        "sustainability-metrology-lab",
        "technical-glasses",
        "template-runtime-pack-engine",
        "ui-ux-builder",
        "workshop-command-center",
        "workshop-direction",
        "workshop-search-provenance"
      ],
      "roles": [
        "contract.permissions",
        "manifest.permissions",
        "manifest.readiness",
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "agent-command-center",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "agent-tool-forge",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "ai-task-talk",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "ai-team",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "asset-fabric",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "asset-filesystem-service",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "asset-filesystem-service",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "asset-pack-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "asset-vault",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "audio-studio",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "audio-studio",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "body-pulse",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "body-pulse",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "claude-connector",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-calibration-lab",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-calibration-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-resource-meter",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "cognitive-resource-meter",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "device-handoff",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "diagnostics-operations-center",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "diagnostics-operations-center",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "discovery-engine",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "discovery-engine",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "duo-test",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "evidence-desk",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "evolution-foundry",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "film-motion-studio",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "film-motion-studio",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "finance-world-room",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "finance-world-room",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "forge",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "forge-line",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "game-forge",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "geographic-market-map",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "geographic-market-map",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "governed-evolution-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "human-attention-ledger",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "human-attention-ledger",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "judgement-chamber",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "knowledge-canvas",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "knowledge-canvas",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "learning-lab",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "learning-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "living-world-ruleset-physics-adapter-kit",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "living-world-ruleset-physics-adapter-kit",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "living-world-state-server",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "living-world-state-server",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "machine-host",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "machine-host",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "marketplace-deployment",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "mirror-intake-monitor",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "mirror-intake-monitor",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "model-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "module-contract-workbench",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "module-contract-workbench",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "module-installer",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "module-installer",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "novelty-diversity-engine",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "novelty-diversity-engine",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "prehub",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "project-room",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "project-room",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "prompt-vault",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "publish-library",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "read-only-mirror-world-adapter",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "read-only-mirror-world-adapter",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "reasoning-shell",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "recovery-center",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "recovery-center",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "review-inbox",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "review-inbox",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "sandbox",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "secrets-permissions-console",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "secrets-permissions-console",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "shell-guardian",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "spatial-studio",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "spatial-studio",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "studio",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "studio",
          "role": "manifest.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "studio",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "sustainability-metrology-lab",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "sustainability-metrology-lab",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "technical-glasses",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "template-runtime-pack-engine",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "template-runtime-pack-engine",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "ui-ux-builder",
          "role": "contract.permissions",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "ui-ux-builder",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-command-center",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-command-center",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-direction",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-direction",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-search-provenance",
          "role": "manifest.readiness",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "workshop-search-provenance",
          "role": "manifest.uses",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "storage:axm",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "FILESYSTEM_DECLARATION"
      ],
      "modules": [
        "discovery-engine",
        "finance-world-room",
        "geographic-market-map"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "discovery-engine",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "finance-world-room",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        },
        {
          "moduleId": "geographic-market-map",
          "role": "contract.consumes",
          "kinds": [
            "FILESYSTEM_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "three-webgl",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "RUNTIME_OR_TOOL_DECLARATION"
      ],
      "modules": [
        "ps2-asset-forge"
      ],
      "roles": [
        "manifest.readiness",
        "manifest.uses"
      ],
      "occurrences": [
        {
          "moduleId": "ps2-asset-forge",
          "role": "manifest.readiness",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        },
        {
          "moduleId": "ps2-asset-forge",
          "role": "manifest.uses",
          "kinds": [
            "RUNTIME_OR_TOOL_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-download:explicit",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "audio-studio",
        "discovery-engine",
        "film-motion-studio",
        "finance-world-room",
        "geographic-market-map",
        "knowledge-canvas",
        "learning-lab",
        "project-room",
        "spatial-studio",
        "studio",
        "ui-ux-builder"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "audio-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "discovery-engine",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "film-motion-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "finance-world-room",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "geographic-market-map",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "knowledge-canvas",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "learning-lab",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "project-room",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "spatial-studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "studio",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "ui-ux-builder",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-download:explicit-plan-or-project-export",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "marketplace-deployment"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "marketplace-deployment",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-download:explicit-project-or-mod-json",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "game-forge"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "game-forge",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-download:explicit-release-manifest",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "publish-library"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "publish-library",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-download:verified-output-artifact",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "publish-library"
      ],
      "roles": [
        "contract.boundaries.writes"
      ],
      "occurrences": [
        {
          "moduleId": "publish-library",
          "role": "contract.boundaries.writes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    },
    {
      "token": "user-file:csv-json",
      "state": "DECLARED_NOT_PROBED",
      "kinds": [
        "BROWSER_ENVIRONMENT_DECLARATION"
      ],
      "modules": [
        "finance-world-room",
        "geographic-market-map"
      ],
      "roles": [
        "contract.consumes"
      ],
      "occurrences": [
        {
          "moduleId": "finance-world-room",
          "role": "contract.consumes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        },
        {
          "moduleId": "geographic-market-map",
          "role": "contract.consumes",
          "kinds": [
            "BROWSER_ENVIRONMENT_DECLARATION"
          ]
        }
      ],
      "truth": {
        "presentOnCurrentHost": false,
        "compatibleWithCurrentHost": false,
        "readyOnCurrentHost": false,
        "permissionGranted": false
      }
    }
  ],
  "scopeBoundary": "Only exact strings in manifest uses\u002freadiness\u002fpermissions\u002faccepts\u002fproduces and contract consumes\u002fpermissions\u002fboundaries.writes are classified by explicit syntax. Prose, source code, runtime state, and undeclared assumptions are outside scope.",
  "probeHandoff": {
    "state": "RUNTIME_PROBE_REQUIRED_FOR_COMPATIBILITY",
    "compatibleInputForTouchEnvironmentProbe": true,
    "actualProbePerformed": false
  },
  "truth": {
    "proseInferred": false,
    "undeclaredAssumptionsInferred": false,
    "actualHostProbed": false,
    "compatibilityProven": false,
    "readinessProven": false,
    "toolAvailabilityProven": false,
    "pathExistenceProven": false,
    "networkReachabilityProven": false,
    "permissionChanged": false,
    "dependencyInstalled": false,
    "pathRewritten": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "installationPerformed": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
