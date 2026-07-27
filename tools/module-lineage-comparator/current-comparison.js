'use strict';
window.AXM_MODULE_LINEAGE_COMPARISON = {
  "schema": "axm.module-lineage-comparison/v1",
  "version": "v0.1",
  "measuredAt": "2026-07-26T20:56:00.016Z",
  "freshnessTtlMs": 7200000,
  "fingerprint": "2b62b6763a11e98e043383cd8213ac589e05b35500327afbbe2ffc4b3bde7731",
  "direction": {
    "baseline": {
      "label": "demonstration-baseline",
      "canonicalDigest": "bf2895c74c771f743d07a0d086d8af2b95d1e0673cd61f4199d999917db1aad6",
      "fileCount": 5,
      "totalBytes": 944,
      "moduleId": "example-lineage",
      "manifestVersion": "v0.1",
      "manifestStatus": "EXPERIMENTAL",
      "structuralIssues": []
    },
    "candidate": {
      "label": "demonstration-candidate",
      "canonicalDigest": "ac532abde5205e62bab1eb408bee735ebd5a279f015b6effa235cddb27d6b9b5",
      "fileCount": 5,
      "totalBytes": 1108,
      "moduleId": "example-lineage",
      "manifestVersion": "v0.2",
      "manifestStatus": "EXPERIMENTAL",
      "structuralIssues": []
    },
    "meaning": "Directional labels only. No age, precedence, acceptance, safety, or authority is inferred."
  },
  "relation": "CHANGED",
  "summary": {
    "addedFiles": 1,
    "removedFiles": 1,
    "changedFiles": 3,
    "unchangedFiles": 1,
    "manifestFieldChanges": 4,
    "contractFieldChanges": 5,
    "structuralIssues": 0
  },
  "fileDelta": {
    "schema": "axm.module-file-delta/v1",
    "added": [
      {
        "path": "receipt.js",
        "sha256": "6415dfb93b3122a72364fe89649d2043ae5dddfc5460c49547337ae4f45fe1c2",
        "bytes": 51
      }
    ],
    "removed": [
      {
        "path": "retired.txt",
        "sha256": "f6106aeaf60f17c5e13b5179d9badca85e54b8a9fe09f86eddbb8b7e7f3060b5",
        "bytes": 44
      }
    ],
    "changed": [
      {
        "path": "app.js",
        "baselineSha256": "b437249d4168c4fe40a03160e8b0d550e59e8d3d88965176f8d8d20f2adfaab0",
        "candidateSha256": "39f6e0209c14395d9482cfc9b3ba0a84730fd1acd24392543cd614e3a3ecbe88",
        "baselineBytes": 39,
        "candidateBytes": 40
      },
      {
        "path": "manifest.json",
        "baselineSha256": "1132cdbf13abd93195687f34a0216e062ee226def362507e0ea37f8302f7a908",
        "candidateSha256": "62c96dc3486681035f98019359ebba7eea40f99e3a364c06533291b660c08a60",
        "baselineBytes": 349,
        "candidateBytes": 412
      },
      {
        "path": "module.contract.json",
        "baselineSha256": "e0095961b1ae420b250aa0550bd53ca59681207a39fe6232891d74a9217e13d5",
        "candidateSha256": "efaea908813d1bc2ff074ae4e54812e642a7e5cae780e3b03941fe1f0664911d",
        "baselineBytes": 461,
        "candidateBytes": 554
      }
    ],
    "unchanged": [
      {
        "path": "index.html",
        "sha256": "3e9c81cdd5c1382eec57ac580edd6f4ea2e5591fb0603a33f62251db0afe07d1",
        "bytes": 51
      }
    ]
  },
  "declaredDelta": {
    "schema": "axm.module-contract-delta/v1",
    "manifestFields": [
      {
        "field": "version",
        "state": "CHANGED",
        "baseline": "v0.1",
        "candidate": "v0.2"
      },
      {
        "field": "status",
        "state": "SAME"
      },
      {
        "field": "entry",
        "state": "SAME"
      },
      {
        "field": "uses",
        "state": "CHANGED",
        "baseline": [
          "storage"
        ],
        "candidate": [
          "storage",
          "export"
        ],
        "arrayDelta": {
          "added": [
            "export"
          ],
          "removed": [],
          "orderChanged": false
        }
      },
      {
        "field": "permissions",
        "state": "SAME"
      },
      {
        "field": "actions",
        "state": "CHANGED",
        "baseline": [
          "inspect"
        ],
        "candidate": [
          "inspect",
          "export explicit receipt"
        ],
        "arrayDelta": {
          "added": [
            "export explicit receipt"
          ],
          "removed": [],
          "orderChanged": false
        }
      },
      {
        "field": "accepts",
        "state": "SAME"
      },
      {
        "field": "produces",
        "state": "CHANGED",
        "baseline": [
          "axm.example.output/v1"
        ],
        "candidate": [
          "axm.example.output/v1",
          "axm.example.receipt/v1"
        ],
        "arrayDelta": {
          "added": [
            "axm.example.receipt/v1"
          ],
          "removed": [],
          "orderChanged": false
        }
      },
      {
        "field": "readiness",
        "state": "SAME"
      }
    ],
    "contractFields": [
      {
        "field": "version",
        "state": "CHANGED",
        "baseline": "v0.1",
        "candidate": "v0.2"
      },
      {
        "field": "provides",
        "state": "CHANGED",
        "baseline": [
          "example-inspection"
        ],
        "candidate": [
          "example-inspection",
          "explicit-example-receipt"
        ],
        "arrayDelta": {
          "added": [
            "explicit-example-receipt"
          ],
          "removed": [],
          "orderChanged": false
        }
      },
      {
        "field": "consumes",
        "state": "SAME"
      },
      {
        "field": "permissions",
        "state": "SAME"
      },
      {
        "field": "handoffs",
        "state": "CHANGED",
        "baseline": {
          "accepts": [
            "axm.example.input/v1"
          ],
          "emits": [
            "axm.example.output/v1"
          ]
        },
        "candidate": {
          "accepts": [
            "axm.example.input/v1"
          ],
          "emits": [
            "axm.example.output/v1",
            "axm.example.receipt/v1"
          ]
        }
      },
      {
        "field": "boundaries",
        "state": "CHANGED",
        "baseline": {
          "refuses": [
            "automatic-apply"
          ],
          "writes": []
        },
        "candidate": {
          "refuses": [
            "automatic-apply",
            "automatic-promotion"
          ],
          "writes": [
            "user-selected-output"
          ]
        }
      },
      {
        "field": "lifecycle",
        "state": "CHANGED",
        "baseline": {
          "cleanup": "not-applicable",
          "disconnect": "not-applicable",
          "reload": "reset",
          "state_owner": "none"
        },
        "candidate": {
          "cleanup": "explicit",
          "disconnect": "not-applicable",
          "reload": "reset",
          "state_owner": "none"
        }
      }
    ]
  },
  "truth": {
    "bundleFilesExecuted": false,
    "archiveExtractionPerformed": false,
    "semanticEquivalenceInferred": false,
    "baselineAgeInferred": false,
    "candidateAgeInferred": false,
    "winnerSelected": false,
    "automaticMergePerformed": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "installationPerformed": false,
    "permissionChanged": false,
    "rollbackChanged": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
