'use strict';
window.AXM_STORAGE_PRESSURE_MAP = {
  "schema": "axm.storage-pressure-map\u002fv1",
  "version": "v0.1",
  "snapshotId": "storage-pressure-20260731231648788",
  "measuredAt": "2026-07-31T23:16:48.788Z",
  "source": {
    "fingerprint": "6ea52d975600bd2b54dedb4060ac4092ec989eb2342e35e4c91e7975b9d65cc6",
    "rootPathsIncluded": false,
    "symlinksFollowed": false,
    "fileBodiesRead": "same-size SHA-256 duplicate candidates only",
    "allocationUnitBytes": 4096,
    "allocatedBytesState": "CLUSTER_ROUNDED_ESTIMATE_NOT_SPARSE_OR_COMPRESSION_AWARE"
  },
  "summary": {
    "roots": 2,
    "files": 138499,
    "directories": 13999,
    "logicalBytes": 13750743404,
    "allocatedBytesEstimate": 14109597696,
    "allocationOverheadEstimate": 358854292,
    "exactDuplicateGroups": 266,
    "exactDuplicateLogicalPaths": 502,
    "exactDuplicatePhysicalBytes": 10281414,
    "lowerRiskReviewGroups": 114,
    "protectedOrMixedHoldGroups": 152,
    "skippedSymlinks": 0,
    "readIssues": 0
  },
  "roots": [
    {
      "id": "workshop",
      "label": "workshop",
      "files": 105971,
      "directories": 10075,
      "logicalBytes": 7883981096,
      "allocatedBytesEstimate": 8159576064,
      "skippedSymlinks": 0,
      "readIssues": 0
    },
    {
      "id": "mirror",
      "label": "mirror",
      "files": 32528,
      "directories": 3924,
      "logicalBytes": 5866762308,
      "allocatedBytesEstimate": 5950021632,
      "skippedSymlinks": 0,
      "readIssues": 0
    }
  ],
  "retentionClasses": [
    {
      "id": "CANONICAL_STATE",
      "files": 33802,
      "logicalBytes": 5912241640,
      "allocatedBytesEstimate": 5999263744,
      "exactDuplicateGroupMemberships": 0
    },
    {
      "id": "DURABLE_EVENT",
      "files": 44820,
      "logicalBytes": 1509323374,
      "allocatedBytesEstimate": 1620443136,
      "exactDuplicateGroupMemberships": 0
    },
    {
      "id": "SESSION_SEGMENT",
      "files": 4060,
      "logicalBytes": 113132202,
      "allocatedBytesEstimate": 121626624,
      "exactDuplicateGroupMemberships": 152
    },
    {
      "id": "DERIVED_VIEW",
      "files": 5259,
      "logicalBytes": 206695108,
      "allocatedBytesEstimate": 225222656,
      "exactDuplicateGroupMemberships": 0
    },
    {
      "id": "REPETITIVE_TELEMETRY",
      "files": 408,
      "logicalBytes": 5807094,
      "allocatedBytesEstimate": 6688768,
      "exactDuplicateGroupMemberships": 49
    },
    {
      "id": "TEMPORARY_CAPTURE",
      "files": 766,
      "logicalBytes": 21539126,
      "allocatedBytesEstimate": 23523328,
      "exactDuplicateGroupMemberships": 66
    },
    {
      "id": "PRIVATE_OR_USER_SOURCE",
      "files": 28153,
      "logicalBytes": 2300721735,
      "allocatedBytesEstimate": 2379067392,
      "exactDuplicateGroupMemberships": 0
    },
    {
      "id": "UNCLASSIFIED",
      "files": 21231,
      "logicalBytes": 3681283125,
      "allocatedBytesEstimate": 3733762048,
      "exactDuplicateGroupMemberships": 0
    }
  ],
  "duplicateCoverage": {
    "mode": "duplicates",
    "scope": [
      "REPETITIVE_TELEMETRY",
      "SESSION_SEGMENT",
      "TEMPORARY_CAPTURE"
    ],
    "eligibleFiles": 5234,
    "candidateSizeGroups": 829,
    "candidateFiles": 4140,
    "filesHashed": 4140,
    "bytesHashed": 100205810,
    "filesSkippedByLimit": 0,
    "coverageComplete": true,
    "wholeRootCoverageComplete": false,
    "hashIssues": []
  },
  "exactDuplicateGroups": [
    {
      "id": "d949f08604d398d6d079-31360",
      "sha256": "d949f08604d398d6d079132a5f3ab93f30518c01c803eb163dcd8c76a21838b8",
      "bytesPerFile": 31360,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 125440,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-674aadd7e0b7d7812c1b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-674aadd7e0b7d7812c1b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-674aadd7e0b7d7812c1b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-674aadd7e0b7d7812c1b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-674aadd7e0b7d7812c1b.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "8f8dbf4e14dad5a79608-31278",
      "sha256": "8f8dbf4e14dad5a79608fc723e312ea4b75ec9a8f0c3aa35a2a2547eb6684db6",
      "bytesPerFile": 31278,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 125112,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-f1f1d20b7d64d28cc948.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-f1f1d20b7d64d28cc948.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-f1f1d20b7d64d28cc948.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-f1f1d20b7d64d28cc948.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-f1f1d20b7d64d28cc948.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "06e6e02bad880cdb722c-31256",
      "sha256": "06e6e02bad880cdb722c5c650bdd6d8613758338e53751104fc3b45c3195735c",
      "bytesPerFile": 31256,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 125024,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-8b7edee86c57facf5825.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-8b7edee86c57facf5825.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-8b7edee86c57facf5825.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-8b7edee86c57facf5825.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-8b7edee86c57facf5825.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "bb976084b6bf02811d5c-31175",
      "sha256": "bb976084b6bf02811d5c6d418012bf49b0fbe78bef0ead9d555c2dd43133507b",
      "bytesPerFile": 31175,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124700,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-5cd951176f8f8a8f3bb9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-5cd951176f8f8a8f3bb9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-5cd951176f8f8a8f3bb9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-5cd951176f8f8a8f3bb9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-5cd951176f8f8a8f3bb9.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "d9162e8981ad25d6f711-31160",
      "sha256": "d9162e8981ad25d6f711224a4292d058a9c8cfd2a942fc0a38e1f8ea217476c2",
      "bytesPerFile": 31160,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124640,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-617f4441eb37abccd312.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-617f4441eb37abccd312.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-617f4441eb37abccd312.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-617f4441eb37abccd312.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-617f4441eb37abccd312.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "31a5273d5e93d1e525e5-31154",
      "sha256": "31a5273d5e93d1e525e5c5061825ab0098443e2001480a1d837ac8c5c20e4d9f",
      "bytesPerFile": 31154,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124616,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-042630c9a152d18f86db.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-042630c9a152d18f86db.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-042630c9a152d18f86db.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-042630c9a152d18f86db.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-042630c9a152d18f86db.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "5a151aced0712d960482-31147",
      "sha256": "5a151aced0712d9604824236e8f8cf4c7129f14a3792baf43541abbdd65da40d",
      "bytesPerFile": 31147,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124588,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-3789c730529be8fd8c2c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-3789c730529be8fd8c2c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-3789c730529be8fd8c2c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-3789c730529be8fd8c2c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-3789c730529be8fd8c2c.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "bc5be863909a4d9dba77-31130",
      "sha256": "bc5be863909a4d9dba77d0309f40cc73a4489282bdff7fc1ce0d12767320dc20",
      "bytesPerFile": 31130,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124520,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-84188ceb11e94f6ee480.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-84188ceb11e94f6ee480.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-84188ceb11e94f6ee480.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-84188ceb11e94f6ee480.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-84188ceb11e94f6ee480.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "5c162c127cc9baafd3eb-31123",
      "sha256": "5c162c127cc9baafd3eb606c463fb6d3f296e323b2f51cb255c5c27b5a5043de",
      "bytesPerFile": 31123,
      "filePaths": 5,
      "physicalCopies": 5,
      "redundantLogicalPaths": 4,
      "redundantPhysicalBytes": 124492,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-e64047c0a03e02269754.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-e64047c0a03e02269754.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-e64047c0a03e02269754.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-e64047c0a03e02269754.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-e64047c0a03e02269754.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "f70ed9c76556c908f082-34762",
      "sha256": "f70ed9c76556c908f08264824609c4b8d39cb5c744be13fc3453d0ef3b7a13c0",
      "bytesPerFile": 34762,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104286,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-12e314fe6280433a3dbe.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-12e314fe6280433a3dbe.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-12e314fe6280433a3dbe.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-12e314fe6280433a3dbe.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9a8fcb2f8fc4e6aead23-34760",
      "sha256": "9a8fcb2f8fc4e6aead23b59c1082f6bcf8abd69a06673183a4dbc8f91b6fb741",
      "bytesPerFile": 34760,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104280,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-fff81d3cef2f2a8a7d4f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-fff81d3cef2f2a8a7d4f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-fff81d3cef2f2a8a7d4f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-fff81d3cef2f2a8a7d4f.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "148a2a772b6573bb8a6c-34738",
      "sha256": "148a2a772b6573bb8a6cb97477ad843210cf90df5fdc10ff050ddf9435498463",
      "bytesPerFile": 34738,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104214,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-09b89ca9a551bb59902e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-09b89ca9a551bb59902e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-09b89ca9a551bb59902e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-09b89ca9a551bb59902e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "f6760952deedb3826deb-34721",
      "sha256": "f6760952deedb3826deb60424c1703d3a8121fad27a6f9c8d62a1bc56941fe35",
      "bytesPerFile": 34721,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104163,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-5a41aca231972700e578.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-5a41aca231972700e578.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-5a41aca231972700e578.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-5a41aca231972700e578.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "b5e00ba50c5042433685-34716",
      "sha256": "b5e00ba50c5042433685ad32938a870fdfee7c18a5ea8d35d6c39c98542d7a9f",
      "bytesPerFile": 34716,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104148,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-b266b0fdf3784498676e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-b266b0fdf3784498676e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-b266b0fdf3784498676e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-b266b0fdf3784498676e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "e945aa5c785e7f4635ec-34713",
      "sha256": "e945aa5c785e7f4635eca4eab1e29ecf66ba912a5599006a1010aae6e9e71e52",
      "bytesPerFile": 34713,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104139,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-c07cf6831159adc86397.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-c07cf6831159adc86397.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-c07cf6831159adc86397.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-c07cf6831159adc86397.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "1572a3267e93f7ffa2b3-34703",
      "sha256": "1572a3267e93f7ffa2b32ac57d63210ca87f56f57c4e6395c0cfb8caa4dbc1c8",
      "bytesPerFile": 34703,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104109,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-09302f3eeddabde0a41a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-09302f3eeddabde0a41a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-09302f3eeddabde0a41a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-09302f3eeddabde0a41a.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "cbad19be80409fc60393-34701",
      "sha256": "cbad19be80409fc60393eca48b914f3fa312ac30b2e16d245dd835815e6bb85a",
      "bytesPerFile": 34701,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104103,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-7c7ae10706eb55eb24e9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-7c7ae10706eb55eb24e9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-7c7ae10706eb55eb24e9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-7c7ae10706eb55eb24e9.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "60e70dd0d17e55eadcc3-34693",
      "sha256": "60e70dd0d17e55eadcc30aeba9bae4dfecd92a165ab267f63244b11a1e7caeed",
      "bytesPerFile": 34693,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104079,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-94f866fa3b53e356fe39.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-94f866fa3b53e356fe39.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-94f866fa3b53e356fe39.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-94f866fa3b53e356fe39.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "3d5f40a26e4cd8ef9a9a-34690",
      "sha256": "3d5f40a26e4cd8ef9a9ab4881cf6bb184c123a1dbd7c0cf034fb662d8a963219",
      "bytesPerFile": 34690,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104070,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-20113507c324139541d6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-20113507c324139541d6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-20113507c324139541d6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-20113507c324139541d6.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "8e0779997d7da9f26043-34687",
      "sha256": "8e0779997d7da9f26043a4a9129d56ccdb671d940d14cdc888914f70dec79134",
      "bytesPerFile": 34687,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104061,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-2e38f7ae6bd6939409cc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-2e38f7ae6bd6939409cc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-2e38f7ae6bd6939409cc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-2e38f7ae6bd6939409cc.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "f789d9fb1d8008ff4960-34685",
      "sha256": "f789d9fb1d8008ff496077a82a9b4023c7d57de409ad3b6887dd69fb97866131",
      "bytesPerFile": 34685,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104055,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-f48d685cfa9d82b66baa.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-f48d685cfa9d82b66baa.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-f48d685cfa9d82b66baa.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-f48d685cfa9d82b66baa.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "e1c1e91482121dd8a336-34681",
      "sha256": "e1c1e91482121dd8a33657bf35b2bf978b110aa3581f0d27a2115469dc25ae1d",
      "bytesPerFile": 34681,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104043,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-ee0114823d21043a420e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-ee0114823d21043a420e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-ee0114823d21043a420e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-ee0114823d21043a420e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "28fcdb675f0eea9c0125-34679",
      "sha256": "28fcdb675f0eea9c01257df121d89db821abd761fdda9646477d322182c864f7",
      "bytesPerFile": 34679,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104037,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-730a2fb4e0809d3de9be.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-730a2fb4e0809d3de9be.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-730a2fb4e0809d3de9be.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-730a2fb4e0809d3de9be.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "4dd2dddc297900061de3-34673",
      "sha256": "4dd2dddc297900061de33804887f3f62516b1b3ab33e1237735ab4384b09bd21",
      "bytesPerFile": 34673,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104019,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-0f8bdebcd9ba0271587b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-0f8bdebcd9ba0271587b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-0f8bdebcd9ba0271587b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-0f8bdebcd9ba0271587b.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "ba8a8852eead369bf466-34671",
      "sha256": "ba8a8852eead369bf466e1bf2deb6ad7cf9c4c61fefd4a3b9b3ec966ae5297f3",
      "bytesPerFile": 34671,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 104013,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-38e6246c49da0f2dabd2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-38e6246c49da0f2dabd2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-38e6246c49da0f2dabd2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-38e6246c49da0f2dabd2.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "81f74c58d19dfd770574-34661",
      "sha256": "81f74c58d19dfd77057477c99a734c11fc0933891b3963a30c9479442e83482a",
      "bytesPerFile": 34661,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103983,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-f7f023c2ecae5144be60.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-f7f023c2ecae5144be60.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-f7f023c2ecae5144be60.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-f7f023c2ecae5144be60.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9afb6d3a48ec8572fde8-34659",
      "sha256": "9afb6d3a48ec8572fde8dd8dbe73997ca488b0df4ad61e34d9b574fc319cb13d",
      "bytesPerFile": 34659,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103977,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-9cd682c0335e5e4faee7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9cd682c0335e5e4faee7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-9cd682c0335e5e4faee7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9cd682c0335e5e4faee7.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9fde2e3e9f223aa60826-34657",
      "sha256": "9fde2e3e9f223aa608262c5e678caf09d8ab9755d329920a52f24e3a4abf1acd",
      "bytesPerFile": 34657,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103971,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-a559ddd9ad21aca46eb6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-a559ddd9ad21aca46eb6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-a559ddd9ad21aca46eb6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-a559ddd9ad21aca46eb6.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "49cbd51ec708bf104467-34655",
      "sha256": "49cbd51ec708bf1044671d6810a5505583d48cb234f8c037ac3cd51a0dfb15f0",
      "bytesPerFile": 34655,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103965,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-12b9d7ae5b1af0453d9e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-12b9d7ae5b1af0453d9e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-12b9d7ae5b1af0453d9e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-12b9d7ae5b1af0453d9e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "2a5af9055f550473a66e-34653",
      "sha256": "2a5af9055f550473a66ef652615235490d4111c99b73c3fce9716a8c0718aa9f",
      "bytesPerFile": 34653,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103959,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-a2ac4d89d9ec86b0585e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-a2ac4d89d9ec86b0585e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-a2ac4d89d9ec86b0585e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-a2ac4d89d9ec86b0585e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "af7517a60734531a7a0b-34648",
      "sha256": "af7517a60734531a7a0be5043340923cf659a42e91db64506a0f6572d9e37967",
      "bytesPerFile": 34648,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103944,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-ad390d623c437c371ccc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-ad390d623c437c371ccc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-ad390d623c437c371ccc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-ad390d623c437c371ccc.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "b082a9567a97d2ed4e95-34629",
      "sha256": "b082a9567a97d2ed4e9562c1a2924a087b307a790084f10c2e6f2ae7947a5df8",
      "bytesPerFile": 34629,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103887,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-30897c321c5d3dea6e70.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-30897c321c5d3dea6e70.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-30897c321c5d3dea6e70.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-30897c321c5d3dea6e70.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "5090cc507c7c8c843501-34615",
      "sha256": "5090cc507c7c8c8435012edd002feba6c386c767f062820bdd672d1bd6654a70",
      "bytesPerFile": 34615,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103845,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-635cbc8a08348b4e69fb.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-635cbc8a08348b4e69fb.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-635cbc8a08348b4e69fb.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-635cbc8a08348b4e69fb.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "33e959474bc7de237ca9-34613",
      "sha256": "33e959474bc7de237ca95b9482cca47c90d34dd945e87a0e405de5438a9015b6",
      "bytesPerFile": 34613,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103839,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-3d58f432744a90ebe148.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-3d58f432744a90ebe148.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-3d58f432744a90ebe148.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-3d58f432744a90ebe148.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "b4515685b47b27164aee-34613",
      "sha256": "b4515685b47b27164aee482d9640bb609a177e72d0642c6e64510fb43d4f4ead",
      "bytesPerFile": 34613,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103839,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-9c5a163b96c1bf9cf0c5.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9c5a163b96c1bf9cf0c5.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-9c5a163b96c1bf9cf0c5.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9c5a163b96c1bf9cf0c5.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "4b19ff6021be77d14e20-34612",
      "sha256": "4b19ff6021be77d14e209925606967a858ace38a510fae3b63e20f8c3956a4c7",
      "bytesPerFile": 34612,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103836,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-75aa8ba2082d95c3b27f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-75aa8ba2082d95c3b27f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-75aa8ba2082d95c3b27f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-75aa8ba2082d95c3b27f.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "edc6503a938d3ab3e4d5-34605",
      "sha256": "edc6503a938d3ab3e4d5044d659d70e2ff4a36015c63d83524e2e0f54f371461",
      "bytesPerFile": 34605,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103815,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-e5a86d9aa3b6420f6f53.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-e5a86d9aa3b6420f6f53.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-e5a86d9aa3b6420f6f53.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-e5a86d9aa3b6420f6f53.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "7024faa0f888802413aa-34567",
      "sha256": "7024faa0f888802413aa613133bc69414836d826f909afdcf5eec15ecc7f3e42",
      "bytesPerFile": 34567,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103701,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-cf31bb154ba82b6a3fc0.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-cf31bb154ba82b6a3fc0.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-cf31bb154ba82b6a3fc0.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-cf31bb154ba82b6a3fc0.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "adf9b5c5da41292fed12-34553",
      "sha256": "adf9b5c5da41292fed12329a7288519a94c658c887eea65dde4e22ee7e6578eb",
      "bytesPerFile": 34553,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103659,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-314c716da94dabbb4a40.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-314c716da94dabbb4a40.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-314c716da94dabbb4a40.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-314c716da94dabbb4a40.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "98962718dc709a600caa-34485",
      "sha256": "98962718dc709a600caa780f816e56141faa9a282bc1ebeeca7ed5d87f467a80",
      "bytesPerFile": 34485,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103455,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-751794441f633f0cc743.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-751794441f633f0cc743.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-751794441f633f0cc743.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-751794441f633f0cc743.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "f486f950c93a6ac9145d-34471",
      "sha256": "f486f950c93a6ac9145d5959e65f63a469d1cbb1cf0bf773a195fce99e4af567",
      "bytesPerFile": 34471,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 103413,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-8b119cc07e608a1d2a49.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-8b119cc07e608a1d2a49.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-8b119cc07e608a1d2a49.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-8b119cc07e608a1d2a49.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "62901f188bc5985e8428-31202",
      "sha256": "62901f188bc5985e8428c08b00b91d1ad985d979dec533ad01db92a25ddcf7d2",
      "bytesPerFile": 31202,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93606,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-c9342ad22d333090169c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-c9342ad22d333090169c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-c9342ad22d333090169c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-c9342ad22d333090169c.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "f083b2f19f2bb74aa3bf-31177",
      "sha256": "f083b2f19f2bb74aa3bf30ae94023dc8c527fea6c2aebd17946cef9ef44d0dae",
      "bytesPerFile": 31177,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93531,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-679274228345508caa02.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-679274228345508caa02.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-679274228345508caa02.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-679274228345508caa02.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "2d5fd02ef41dd62ecc6c-31160",
      "sha256": "2d5fd02ef41dd62ecc6c543ee17b708b250319b40e410d37586a969615cd766b",
      "bytesPerFile": 31160,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93480,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-18c0aab5106f1c3d2d89.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-18c0aab5106f1c3d2d89.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-18c0aab5106f1c3d2d89.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-18c0aab5106f1c3d2d89.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "23348f85b74d1ea03b0e-31158",
      "sha256": "23348f85b74d1ea03b0ee589d2fe6bf4d38d6e311c4a976e8d10df442c5d2d72",
      "bytesPerFile": 31158,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93474,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-f4ddac95d69a368e570a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-f4ddac95d69a368e570a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-f4ddac95d69a368e570a.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-f4ddac95d69a368e570a.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "76f5cd5f28fc810edcd1-31154",
      "sha256": "76f5cd5f28fc810edcd1e0ec793139afda37621fe36ec55545bc76dd15250608",
      "bytesPerFile": 31154,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93462,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-9963bcb6f32063337ac6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9963bcb6f32063337ac6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-9963bcb6f32063337ac6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9963bcb6f32063337ac6.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "a5197972ec39c17a2566-31152",
      "sha256": "a5197972ec39c17a2566bf1e2e6ca05ad62f7e378d5025a0db117fd9de17317f",
      "bytesPerFile": 31152,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93456,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-0612ec1d043776794de7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-0612ec1d043776794de7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-0612ec1d043776794de7.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-0612ec1d043776794de7.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9ab14b762543df7d1ae3-31133",
      "sha256": "9ab14b762543df7d1ae3ce173dcfb55cbc1083f4558d334a37e18080da89aff6",
      "bytesPerFile": 31133,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93399,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-466d378359cfe2b2ca65.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-466d378359cfe2b2ca65.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-466d378359cfe2b2ca65.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-466d378359cfe2b2ca65.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "eba330fb7606f374071b-31126",
      "sha256": "eba330fb7606f374071bf47b3b342eb2f35d347fc6855bb20dfadad17c2cb29a",
      "bytesPerFile": 31126,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93378,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-89319b135c33ae55a248.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-89319b135c33ae55a248.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-89319b135c33ae55a248.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-89319b135c33ae55a248.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "1c6e354f00e2bccc201e-31116",
      "sha256": "1c6e354f00e2bccc201e280a5da8b7f3ef9c0f464003e62c7a9e2c30900ed7a1",
      "bytesPerFile": 31116,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93348,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-c9007e385f6f26ebfe99.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-c9007e385f6f26ebfe99.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-c9007e385f6f26ebfe99.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-c9007e385f6f26ebfe99.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "6c0f2f6307f1e0c6290e-31116",
      "sha256": "6c0f2f6307f1e0c6290e293bf840108ec21f379aca2756727120d9251f545539",
      "bytesPerFile": 31116,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93348,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-3e4545d76c595a7afd29.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-3e4545d76c595a7afd29.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-3e4545d76c595a7afd29.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-3e4545d76c595a7afd29.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "35c32bc467a1c709351e-31109",
      "sha256": "35c32bc467a1c709351e2abe3895dee17f22742c0c96665ea4633e5d7e727383",
      "bytesPerFile": 31109,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93327,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-f786f75ada5dcd7b8a97.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-f786f75ada5dcd7b8a97.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-f786f75ada5dcd7b8a97.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-f786f75ada5dcd7b8a97.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "69cbd3e670e85d331a11-31098",
      "sha256": "69cbd3e670e85d331a1132b3a4e6e2daadee308f45c4cb0f6fb60f8596a04eb0",
      "bytesPerFile": 31098,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93294,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-9df183b116ceecfa614f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9df183b116ceecfa614f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-9df183b116ceecfa614f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9df183b116ceecfa614f.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "ab4c12d704a43259ba99-31095",
      "sha256": "ab4c12d704a43259ba99af006af55d78ca29eb4dc4a42c24c8a38931b25bd88f",
      "bytesPerFile": 31095,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93285,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-6e0215635af5d481a629.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-6e0215635af5d481a629.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-6e0215635af5d481a629.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-6e0215635af5d481a629.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "65f34f876b8961fec622-31088",
      "sha256": "65f34f876b8961fec62234472c8b94eb7716dc012c2be898cb4e5abdda39c584",
      "bytesPerFile": 31088,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93264,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-588801b70c87b2a1fe5e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-588801b70c87b2a1fe5e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-588801b70c87b2a1fe5e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-588801b70c87b2a1fe5e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "984768b11b8b287dc83a-31084",
      "sha256": "984768b11b8b287dc83a1822c441ff6661cfd0f7722192d299d9f686b8320a94",
      "bytesPerFile": 31084,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93252,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-698874b557e144cecded.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-698874b557e144cecded.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-698874b557e144cecded.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-698874b557e144cecded.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9bf1c560827dd6f928a6-31084",
      "sha256": "9bf1c560827dd6f928a69b87568893b7f8fa886a7e4eb4bbc5f6f2f480f5ee9a",
      "bytesPerFile": 31084,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93252,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-248c77cca0a2b7ec473f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-248c77cca0a2b7ec473f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-248c77cca0a2b7ec473f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-248c77cca0a2b7ec473f.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "3d30cb801b8a28175c19-31081",
      "sha256": "3d30cb801b8a28175c192285c04029220fc577e4bd8e13308643dddeb8301656",
      "bytesPerFile": 31081,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93243,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-e6e6d7fee866dd602700.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-e6e6d7fee866dd602700.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-e6e6d7fee866dd602700.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-e6e6d7fee866dd602700.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "bd102660bfccbe66a123-31081",
      "sha256": "bd102660bfccbe66a123ba905a68e65becd511c3ff54bc9791dd62173c35afe4",
      "bytesPerFile": 31081,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93243,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-e2b0ff50aa7d800d1014.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-e2b0ff50aa7d800d1014.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-e2b0ff50aa7d800d1014.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-e2b0ff50aa7d800d1014.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "ba4ff9926403caab7258-31072",
      "sha256": "ba4ff9926403caab72580c71afc9936d85d2fd4d6c78e350157759a748010cd4",
      "bytesPerFile": 31072,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93216,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-633f42175cf44ab4a805.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-633f42175cf44ab4a805.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-633f42175cf44ab4a805.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-633f42175cf44ab4a805.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "7e3b78510687865312a3-31058",
      "sha256": "7e3b78510687865312a34e504897afe96399aa79e0357f1c749a7dfee74f76d2",
      "bytesPerFile": 31058,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93174,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-ccce3a2b1f5932dbc1f8.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-ccce3a2b1f5932dbc1f8.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-ccce3a2b1f5932dbc1f8.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-ccce3a2b1f5932dbc1f8.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "ef69453f8061d036507a-31024",
      "sha256": "ef69453f8061d036507ad58e9ad9bc941d20211026d92e24fefdb16ff11f8491",
      "bytesPerFile": 31024,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 93072,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-06e00476cb0e0a9a8eba.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-06e00476cb0e0a9a8eba.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-06e00476cb0e0a9a8eba.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-06e00476cb0e0a9a8eba.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "7d2ccb863b55748d0bb1-30995",
      "sha256": "7d2ccb863b55748d0bb1dab51d6f086dcca237b1269bb1612ab0510ed81a5494",
      "bytesPerFile": 30995,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 92985,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-9cf87b0969abc027f964.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-9cf87b0969abc027f964.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9cf87b0969abc027f964.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9cf87b0969abc027f964.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "89d939002deea66be73e-30981",
      "sha256": "89d939002deea66be73ec876ac8fc3404ecb958d724a7c48f96ff7d7cfbdcfa0",
      "bytesPerFile": 30981,
      "filePaths": 4,
      "physicalCopies": 4,
      "redundantLogicalPaths": 3,
      "redundantPhysicalBytes": 92943,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-a2f6c715c2a642ba87d9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-a2f6c715c2a642ba87d9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-a2f6c715c2a642ba87d9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-a2f6c715c2a642ba87d9.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "c60ac6e798e78be87db5-34710",
      "sha256": "c60ac6e798e78be87db56054a2f135fc3c5829f5198edea2343eaf6944ad0fd3",
      "bytesPerFile": 34710,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69420,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-702c0a1a36aed71a08c6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-702c0a1a36aed71a08c6.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-702c0a1a36aed71a08c6.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "de97eef6d61fb9c756b6-34702",
      "sha256": "de97eef6d61fb9c756b6cc1dd2e24851ddaa310916bd46d2c74a9d60d190ddc1",
      "bytesPerFile": 34702,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69404,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-8b0338dcec059798c30b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-8b0338dcec059798c30b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-8b0338dcec059798c30b.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "8aaa28981656dcf00623-34678",
      "sha256": "8aaa28981656dcf006237dc0df56e1ad9bb77ebb7c9a9c163bda6fe96c8e43d6",
      "bytesPerFile": 34678,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69356,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-a33c016adfa744986992.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-a33c016adfa744986992.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-a33c016adfa744986992.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "060c225174c266645bac-34618",
      "sha256": "060c225174c266645bac8325535cc2b62cbfd4be599b8db4e21b4ee43158c329",
      "bytesPerFile": 34618,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69236,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-ed651f81ea0a1e58da7c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-ed651f81ea0a1e58da7c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-ed651f81ea0a1e58da7c.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "047c9d09a81f4db1d65e-34595",
      "sha256": "047c9d09a81f4db1d65e6c5c8f757952ef734182ed4caeca5a24ed1a2a14fb0e",
      "bytesPerFile": 34595,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69190,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-67499fafc4a4482ebe45.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-67499fafc4a4482ebe45.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-67499fafc4a4482ebe45.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "389abeaafc0a2168e8e5-34590",
      "sha256": "389abeaafc0a2168e8e54d7ed3cd926962c6b1a989999078d1d323104d25a548",
      "bytesPerFile": 34590,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69180,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-a282b41ebdf3b8d6afc9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-a282b41ebdf3b8d6afc9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-a282b41ebdf3b8d6afc9.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9bb671b86c7fc45c9d3d-34581",
      "sha256": "9bb671b86c7fc45c9d3dc62efe8c8ddeb95acff63f31245da963e04d31fc5dfa",
      "bytesPerFile": 34581,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 69162,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-6e816e4b07e8598afea2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-6e816e4b07e8598afea2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-6e816e4b07e8598afea2.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "8ca7e6323f42a5d318f8-31235",
      "sha256": "8ca7e6323f42a5d318f8d94acb4328a2cc9a478a38a6d39bffeb824f91c58ec8",
      "bytesPerFile": 31235,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62470,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-91c62739c68780206ea9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-91c62739c68780206ea9.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-91c62739c68780206ea9.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "d39e317c84c8d89facc6-31167",
      "sha256": "d39e317c84c8d89facc6f59ec755a5934e091253d4c40f1e980ae880363c3a11",
      "bytesPerFile": 31167,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62334,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-1bdebb5a0c935393a86b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-1bdebb5a0c935393a86b.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-1bdebb5a0c935393a86b.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "6c9db00ce368f5beeffa-31150",
      "sha256": "6c9db00ce368f5beeffa75ca8b635aad1c84ee10ee3961b4cd52319f6f612896",
      "bytesPerFile": 31150,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62300,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-783778f5fed7bc692bec.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-783778f5fed7bc692bec.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-783778f5fed7bc692bec.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "37bcba5eb455b29f0ab9-31144",
      "sha256": "37bcba5eb455b29f0ab9ab2d988dd9e3170f3c9b75f13698935399a47198288b",
      "bytesPerFile": 31144,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62288,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-21f32295f67b1b2a2192.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-21f32295f67b1b2a2192.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-21f32295f67b1b2a2192.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "8c6570895db83b9ff363-31137",
      "sha256": "8c6570895db83b9ff363b0d97a9a8632fe669b955d7341dfda9b1e534340ebb9",
      "bytesPerFile": 31137,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62274,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-d69dfa6e672e1f2245f4.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-d69dfa6e672e1f2245f4.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-d69dfa6e672e1f2245f4.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "a0d172d410bab0e00fcf-31119",
      "sha256": "a0d172d410bab0e00fcfd4f87abf5ed05cc9011ae9cbf144b1ce7dbaaa7adcec",
      "bytesPerFile": 31119,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62238,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-4c97e99bb3ee62405ebd.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-4c97e99bb3ee62405ebd.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-4c97e99bb3ee62405ebd.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "955e3dab658790c5d69f-31112",
      "sha256": "955e3dab658790c5d69f95b2aab8193e4efdbe25c9d6b8866283a481f0fed405",
      "bytesPerFile": 31112,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62224,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-3302d1dbb29bfb45e985.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-3302d1dbb29bfb45e985.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-3302d1dbb29bfb45e985.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "c8b31210504d08d93928-31112",
      "sha256": "c8b31210504d08d9392869dcb196c52464cc01dfbaded7cd021f15e1f5ff6edb",
      "bytesPerFile": 31112,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62224,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-e69f866d7075f41eb05e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-e69f866d7075f41eb05e.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-e69f866d7075f41eb05e.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "b5794ab26a65714fd86e-31099",
      "sha256": "b5794ab26a65714fd86e9915362f68e08c40891e34452f0e9280e27c26a40038",
      "bytesPerFile": 31099,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62198,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-d6bfbcb5d80881eb98e3.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-d6bfbcb5d80881eb98e3.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-d6bfbcb5d80881eb98e3.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "61cd56e3b93620647713-31095",
      "sha256": "61cd56e3b936206477132e13c538c5f441373afd7667e6d121fe49879e71feac",
      "bytesPerFile": 31095,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62190,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-b998669e10c921d18220.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-b998669e10c921d18220.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-b998669e10c921d18220.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "64a91d77629b8b08d60e-31095",
      "sha256": "64a91d77629b8b08d60ed9bd5ba9cc292e7b3c8ddfeb0f8e138aabb3437590d0",
      "bytesPerFile": 31095,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62190,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-9c080204dea4e2109333.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-9c080204dea4e2109333.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-9c080204dea4e2109333.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "a75a11015d35931638d7-31091",
      "sha256": "a75a11015d35931638d763aaa0d3d058a0d8777dac244799fcecbf0f97d189fa",
      "bytesPerFile": 31091,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62182,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-0290b8e04918228a8cbf.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-0290b8e04918228a8cbf.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-0290b8e04918228a8cbf.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "ba7c5504d1eed9238c45-31084",
      "sha256": "ba7c5504d1eed9238c45217cd4b1ac2fdd4151beed93349298e64abcf280437d",
      "bytesPerFile": 31084,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 62168,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions\u002fsession-763669f978bbac193bd0.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-763669f978bbac193bd0.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-763669f978bbac193bd0.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "72f46f8fd42dc134a3ee-41501",
      "sha256": "72f46f8fd42dc134a3ee2047438c7e27417f84e9ca23273816dc426f774fdd43",
      "bytesPerFile": 41501,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 41501,
      "retentionClasses": [
        "TEMPORARY_CAPTURE"
      ],
      "reviewState": "LOWER_RISK_REVIEW",
      "paths": [
        {
          "rootId": "workshop",
          "path": "tmp\u002faxm-vh-modular-draft-with-bytecode\u002fapp\u002fvisual_handshake.py",
          "retentionClass": "TEMPORARY_CAPTURE"
        },
        {
          "rootId": "workshop",
          "path": "tmp\u002faxm-vh-v030-zip-proof\u002fAXM_VISUAL_HANDSHAKE_v0_3_0_MODULAR_2026-07-28\u002fapp\u002fvisual_handshake.py",
          "retentionClass": "TEMPORARY_CAPTURE"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "d5203b919060969371b1-36695",
      "sha256": "d5203b919060969371b14ad9fc72d04d23fb424901f755b3e29921b605fd0c53",
      "bytesPerFile": 36695,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 36695,
      "retentionClasses": [
        "REPETITIVE_TELEMETRY"
      ],
      "reviewState": "LOWER_RISK_REVIEW",
      "paths": [
        {
          "rootId": "workshop",
          "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002fshared\u002fgrowth\u002faxm-growth-metrics.js",
          "retentionClass": "REPETITIVE_TELEMETRY"
        },
        {
          "rootId": "workshop",
          "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002fshared\u002fgrowth\u002faxm-growth-metrics.js",
          "retentionClass": "REPETITIVE_TELEMETRY"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "7ff6a71adc62a0de67f2-18107",
      "sha256": "7ff6a71adc62a0de67f26a45e1395fc2adf1d1014b66a6dce1c9354ce29f84d1",
      "bytesPerFile": 18107,
      "filePaths": 3,
      "physicalCopies": 3,
      "redundantLogicalPaths": 2,
      "redundantPhysicalBytes": 36214,
      "retentionClasses": [
        "TEMPORARY_CAPTURE"
      ],
      "reviewState": "LOWER_RISK_REVIEW",
      "paths": [
        {
          "rootId": "workshop",
          "path": "tmp\u002faxm-vh-modular-draft-with-bytecode\u002fapp\u002fstatic\u002fapp.js",
          "retentionClass": "TEMPORARY_CAPTURE"
        },
        {
          "rootId": "workshop",
          "path": "tmp\u002faxm-vh-v030-zip-proof\u002fAXM_VISUAL_HANDSHAKE_v0_3_0_MODULAR_2026-07-28\u002fapp\u002fstatic\u002fapp.js",
          "retentionClass": "TEMPORARY_CAPTURE"
        },
        {
          "rootId": "workshop",
          "path": "tmp\u002faxm-visual-handshake-modularization\u002fAXM_VISUAL_HANDSHAKE_v0_2_0_2026-07-28\u002fapp\u002fstatic\u002fapp.js",
          "retentionClass": "TEMPORARY_CAPTURE"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "bd6e705c696b1ec86ca8-34818",
      "sha256": "bd6e705c696b1ec86ca825aa4d05994c0837e029991b9f438b1365f86cf00002",
      "bytesPerFile": 34818,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34818,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-2b4d10407674b720ca08.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-2b4d10407674b720ca08.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "1d5188661d9d5273d7a6-34769",
      "sha256": "1d5188661d9d5273d7a654bdd192dec5a0035f89b6a2c7ddb13b92ea2a78afa4",
      "bytesPerFile": 34769,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34769,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-58347aecc6ad50bc5afc.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-58347aecc6ad50bc5afc.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "6f87740fd6d9d77c2b28-34762",
      "sha256": "6f87740fd6d9d77c2b281760a069deb6dfaa04dd084d353fd639c19055f2c69d",
      "bytesPerFile": 34762,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34762,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-322c9a40410c6c092900.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-322c9a40410c6c092900.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "7d0ca06a281f5caa5cd4-34755",
      "sha256": "7d0ca06a281f5caa5cd4e0e54da617ecc0b1392dd0fbdd330aeb550db8e95184",
      "bytesPerFile": 34755,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34755,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-8327aa7da0688b56da3c.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-8327aa7da0688b56da3c.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "eb81663e5bfd44507f9c-34755",
      "sha256": "eb81663e5bfd44507f9c48374b6f9c1917821f7a192b94d433947cdbaa1df63b",
      "bytesPerFile": 34755,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34755,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-554507ae19c7bba5eafb.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-554507ae19c7bba5eafb.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "2a4d12702b34e8d9e33c-34752",
      "sha256": "2a4d12702b34e8d9e33cc7aad99d710e3420cf70680cc5f0104851d101e0ac65",
      "bytesPerFile": 34752,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34752,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-d8e4656e78a7514960aa.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-d8e4656e78a7514960aa.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "2b172ad7bb088d679c2b-34750",
      "sha256": "2b172ad7bb088d679c2b7dc8a2dba799da751103b9488a69e681abc5c58b50d3",
      "bytesPerFile": 34750,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34750,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-1361460284ca00ddde66.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-1361460284ca00ddde66.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "64220a22513f98c0e409-34750",
      "sha256": "64220a22513f98c0e40962a8818edabf73e0a742dcac385fd17ba820bce5e64e",
      "bytesPerFile": 34750,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34750,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-47741d672dc393c6df6f\u002fsessions\u002fsession-acef8eef96b91b3778d2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-85614e3705202bb713c3\u002fsessions\u002fsession-acef8eef96b91b3778d2.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "9fdc46fe1b95f1fcc072-34741",
      "sha256": "9fdc46fe1b95f1fcc0729e7911dbc6e943b8ab5ff69b1d245dd2005cef525269",
      "bytesPerFile": 34741,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34741,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-4b6d457487961bf7afb1.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-4b6d457487961bf7afb1.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "94114dfeeeed4580ec30-34728",
      "sha256": "94114dfeeeed4580ec305e21d7dab80c8b97c30f5391735a05db4f8616b1c64f",
      "bytesPerFile": 34728,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34728,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-fe450ca4ba945bf63e68.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-fe450ca4ba945bf63e68.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "17ac13cdd811e2a7fbb2-34727",
      "sha256": "17ac13cdd811e2a7fbb2d873abde97b85c0aab522ae767df07496a2895d69eca",
      "bytesPerFile": 34727,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34727,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-947b2dfb9a52e26d66c2.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-947b2dfb9a52e26d66c2.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "5349d94c2aaea24eb9b9-34727",
      "sha256": "5349d94c2aaea24eb9b9719e53cc88a6ca379b55c1c7dcfa1f0d2371f22ac893",
      "bytesPerFile": 34727,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34727,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-cb860fa40b664bd6d337.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-cb860fa40b664bd6d337.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    },
    {
      "id": "c2dd599dd246a29cec9a-34724",
      "sha256": "c2dd599dd246a29cec9a456926cc469cab7deded245dc17b01a5f17e4b39251f",
      "bytesPerFile": 34724,
      "filePaths": 2,
      "physicalCopies": 2,
      "redundantLogicalPaths": 1,
      "redundantPhysicalBytes": 34724,
      "retentionClasses": [
        "SESSION_SEGMENT"
      ],
      "reviewState": "PROTECTED_OR_MIXED_HOLD",
      "paths": [
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions\u002fsession-6ffc07d99bbc40ca476f.json",
          "retentionClass": "SESSION_SEGMENT"
        },
        {
          "rootId": "mirror",
          "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions\u002fsession-6ffc07d99bbc40ca476f.json",
          "retentionClass": "SESSION_SEGMENT"
        }
      ],
      "pathsOmitted": 0
    }
  ],
  "exactDuplicateGroupsOmitted": 166,
  "directoryPressure": [
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@phosphor-icons\u002freact\u002fdist\u002fssr",
      "immediateEntries": 2436,
      "immediateFiles": 2436,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@phosphor-icons\u002freact\u002fdist\u002fcsr",
      "immediateEntries": 2435,
      "immediateFiles": 2435,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@phosphor-icons\u002freact\u002fdist\u002fdefs",
      "immediateEntries": 2434,
      "immediateFiles": 2434,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fcaniuse-lite\u002fdata\u002ffeatures",
      "immediateEntries": 583,
      "immediateFiles": 583,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "node_modules\u002fcore-js\u002fmodules",
      "immediateEntries": 563,
      "immediateFiles": 563,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "exports\u002fworkshop-packages\u002faxm-workshop-public-20260715-053110-470c18\u002ftools\u002fgame-hub\u002fgame-library\u002f008-district-party\u002fassets\u002fthird_party\u002fkenney_rpg_urban\u002fTiles",
      "immediateEntries": 486,
      "immediateFiles": 486,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "exports\u002fworkshop-packages\u002faxm-workshop-public-20260718-004631-bf9ea8\u002ftools\u002fgame-hub\u002fgame-library\u002f008-district-party\u002fassets\u002fthird_party\u002fkenney_rpg_urban\u002fTiles",
      "immediateEntries": 486,
      "immediateFiles": 486,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002ftools\u002fgame-hub\u002fgame-library\u002f008-district-party\u002fassets\u002fthird_party\u002fkenney_rpg_urban\u002fTiles",
      "immediateEntries": 486,
      "immediateFiles": 486,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002ftools\u002fgame-hub\u002fgame-library\u002f008-district-party\u002fassets\u002fthird_party\u002fkenney_rpg_urban\u002fTiles",
      "immediateEntries": 486,
      "immediateFiles": 486,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fgame-hub\u002fgame-library\u002f008-district-party\u002fassets\u002fthird_party\u002fkenney_rpg_urban\u002fTiles",
      "immediateEntries": 486,
      "immediateFiles": 486,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@react-three\u002fdrei\u002fcore",
      "immediateEntries": 369,
      "immediateFiles": 369,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "node_modules\u002fcore-js\u002finternals",
      "immediateEntries": 324,
      "immediateFiles": 324,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fpython-cpython\u002f3.13.14\u002fLib\u002fsite-packages\u002fOCP",
      "immediateEntries": 322,
      "immediateFiles": 2,
      "immediateDirectories": 320
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fpython-cpython\u002f3.13.14\u002fLib\u002fsite-packages\u002fvtkmodules",
      "immediateEntries": 319,
      "immediateFiles": 310,
      "immediateDirectories": 9
    },
    {
      "rootId": "mirror",
      "path": "training\u002fdatasets\u002freasoning-receipts",
      "immediateEntries": 302,
      "immediateFiles": 302,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "contracts",
      "immediateEntries": 279,
      "immediateFiles": 279,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fthree-stdlib\u002fshaders",
      "immediateEntries": 261,
      "immediateFiles": 261,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": ".git\u002fobjects",
      "immediateEntries": 258,
      "immediateFiles": 0,
      "immediateDirectories": 258
    },
    {
      "rootId": "workshop",
      "path": ".git\u002fobjects",
      "immediateEntries": 258,
      "immediateFiles": 0,
      "immediateDirectories": 258
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@babel\u002fhelpers\u002flib\u002fhelpers",
      "immediateEntries": 244,
      "immediateFiles": 244,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fthree-stdlib\u002floaders",
      "immediateEntries": 241,
      "immediateFiles": 240,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fcaniuse-lite\u002fdata\u002fregions",
      "immediateEntries": 240,
      "immediateFiles": 240,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "tools",
      "immediateEntries": 210,
      "immediateFiles": 2,
      "immediateDirectories": 208
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fpython-cpython\u002f3.13.14\u002fLib\u002fsite-packages\u002fvtk.libs",
      "immediateEntries": 209,
      "immediateFiles": 209,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-contract-curriculum-runs\u002freasoning-contract-curriculum-3d64a56d1c21403507fc\u002fsessions",
      "immediateEntries": 205,
      "immediateFiles": 205,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fcontracts\u002fcommon",
      "immediateEntries": 192,
      "immediateFiles": 192,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fblender\u002f5.2.0-fbe6228777e7\u002f5.2\u002fpython\u002flib",
      "immediateEntries": 184,
      "immediateFiles": 151,
      "immediateDirectories": 33
    },
    {
      "rootId": "workshop",
      "path": "logs",
      "immediateEntries": 184,
      "immediateFiles": 184,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002ftools",
      "immediateEntries": 181,
      "immediateFiles": 2,
      "immediateDirectories": 179
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002ftools",
      "immediateEntries": 181,
      "immediateFiles": 2,
      "immediateDirectories": 179
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fadapter-translation-garden\u002fruntime\u002ftests\u002f__pycache__",
      "immediateEntries": 170,
      "immediateFiles": 170,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fktx-tools\u002f4.4.2\u002fshare\u002fdoc\u002fKTX-Software\u002fhtml\u002flibktx",
      "immediateEntries": 161,
      "immediateFiles": 160,
      "immediateDirectories": 1
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fblender\u002f5.2.0-fbe6228777e7\u002f5.2\u002fdatafiles\u002ficons",
      "immediateEntries": 149,
      "immediateFiles": 149,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "shared\u002fasset-hands",
      "immediateEntries": 148,
      "immediateFiles": 142,
      "immediateDirectories": 6
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002fshared\u002fasset-hands",
      "immediateEntries": 148,
      "immediateFiles": 142,
      "immediateDirectories": 6
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002fshared\u002fasset-hands",
      "immediateEntries": 148,
      "immediateFiles": 142,
      "immediateDirectories": 6
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fthree-stdlib\u002fpostprocessing",
      "immediateEntries": 140,
      "immediateFiles": 140,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freview-copies\u002fmirror-review-20260719102523\u002fcontracts",
      "immediateEntries": 137,
      "immediateFiles": 137,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fadapter-translation-garden\u002fruntime\u002fshared\u002faxm_translation_core\u002f__pycache__",
      "immediateEntries": 136,
      "immediateFiles": 136,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-contract-curriculum-runs\u002freasoning-contract-curriculum-3d6967858512764856ea\u002fsessions",
      "immediateEntries": 134,
      "immediateFiles": 134,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-7a9425d9f9ff35294818\u002fsessions",
      "immediateEntries": 127,
      "immediateFiles": 127,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-db4f52d777ecee397a2f\u002fsessions",
      "immediateEntries": 127,
      "immediateFiles": 127,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-route-readiness-runs\u002freasoning-route-readiness-1d534ffe6d859f120026\u002fsessions",
      "immediateEntries": 127,
      "immediateFiles": 127,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-route-readiness-runs\u002freasoning-route-readiness-6552a55c10bbb4fc19fe\u002fsessions",
      "immediateEntries": 127,
      "immediateFiles": 127,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-route-readiness-runs\u002freasoning-route-readiness-cf232d6c77e4e281928c\u002fsessions",
      "immediateEntries": 127,
      "immediateFiles": 127,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002ftools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fmodels",
      "immediateEntries": 125,
      "immediateFiles": 124,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002ftools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fmodels",
      "immediateEntries": 125,
      "immediateFiles": 124,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fmodels",
      "immediateEntries": 125,
      "immediateFiles": 124,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002fasset-extract\u002fAXM-Workshop-v0.3.0-experimental\u002ftools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fpreviews",
      "immediateEntries": 124,
      "immediateFiles": 124,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "state\u002fpublic-release\u002f2026-07-27-v0.3.0-experimental\u002ffresh-main\u002ftools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fpreviews",
      "immediateEntries": 124,
      "immediateFiles": 124,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fps2-asset-forge\u002fassets\u002fkenney\u002fretro-urban\u002fpreviews",
      "immediateEntries": 124,
      "immediateFiles": 124,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-contract-curriculum-runs\u002freasoning-contract-curriculum-2c546631e7a89eef03ff\u002fsessions",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-handoff-graph-runs\u002freasoning-handoff-graph-1f17fec571d37c33d253\u002fsessions",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-route-readiness-runs\u002freasoning-route-readiness-526756df9bc9c3f1e127\u002fsessions",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-route-readiness-runs\u002freasoning-route-readiness-5c598f6ff653455a9293\u002fsessions",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fblender\u002f5.2.0-fbe6228777e7\u002f5.2\u002fpython\u002flib\u002fencodings",
      "immediateEntries": 123,
      "immediateFiles": 122,
      "immediateDirectories": 1
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fblender\u002f5.2.0-fbe6228777e7\u002f5.2\u002fscripts\u002faddons_core\u002fcycles\u002fshader",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "node_modules\u002f@babel\u002fruntime\u002fhelpers",
      "immediateEntries": 123,
      "immediateFiles": 122,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "node_modules\u002f@babel\u002fruntime\u002fhelpers\u002fesm",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@babel\u002fruntime\u002fhelpers",
      "immediateEntries": 123,
      "immediateFiles": 122,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002f@babel\u002fruntime\u002fhelpers\u002fesm",
      "immediateEntries": 123,
      "immediateFiles": 123,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fadapter-translation-garden\u002fvendor\u002ftzdata-2026b\u002fzoneinfo\u002fAmerica",
      "immediateEntries": 123,
      "immediateFiles": 119,
      "immediateDirectories": 4
    },
    {
      "rootId": "mirror",
      "path": "state\u002freasoning-contract-curriculum-runs\u002freasoning-contract-curriculum-a32a126fd384bfc9259c\u002fsessions",
      "immediateEntries": 122,
      "immediateFiles": 122,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "tests",
      "immediateEntries": 118,
      "immediateFiles": 117,
      "immediateDirectories": 1
    },
    {
      "rootId": "workshop",
      "path": "tools\u002fgame-hub\u002fgame-library\u002f016-hexbound-rooftops\u002fevidence\u002fvisual-temp-last-rites-v19-story",
      "immediateEntries": 111,
      "immediateFiles": 111,
      "immediateDirectories": 0
    },
    {
      "rootId": "mirror",
      "path": "state\u002fai-organ-archive\u002fobjects",
      "immediateEntries": 110,
      "immediateFiles": 0,
      "immediateDirectories": 110
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fthree\u002fsrc\u002frenderers\u002fshaders\u002fShaderChunk",
      "immediateEntries": 110,
      "immediateFiles": 110,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "projects\u002fdice-duel-underdeck\u002fnode_modules\u002fstats-gl\u002fnode_modules\u002fthree\u002fsrc\u002frenderers\u002fshaders\u002fShaderChunk",
      "immediateEntries": 109,
      "immediateFiles": 109,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL",
      "immediateEntries": 108,
      "immediateFiles": 102,
      "immediateDirectories": 6
    },
    {
      "rootId": "workshop",
      "path": "state\u002fintake-staging\u002fseed-portfolio-run100-20260727\u002fAXM_100_SEED_LOCAL_INTAKE_RUNS_001_100_2026-07-27\u002f03_RUNS",
      "immediateEntries": 107,
      "immediateFiles": 7,
      "immediateDirectories": 100
    },
    {
      "rootId": "workshop",
      "path": "state\u002fintake-verification\u002fseed-portfolio-run100-20260727-audit\u002f03_RUNS",
      "immediateEntries": 107,
      "immediateFiles": 7,
      "immediateDirectories": 100
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fcatalog",
      "immediateEntries": 105,
      "immediateFiles": 105,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "node_modules\u002fhtml2canvas\u002fdist\u002flib\u002fcss\u002fproperty-descriptors",
      "immediateEntries": 103,
      "immediateFiles": 102,
      "immediateDirectories": 1
    },
    {
      "rootId": "mirror",
      "path": "substrates\u002fp0-v1\u002fruntimes\u002fktx-tools\u002f4.4.2\u002fshare\u002fdoc\u002fKTX-Software\u002fhtml\u002flibktx\u002fsearch",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f001_model-descriptor\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f002_odd-description-builder\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f003_world-lineage-identity\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f004_time-model-contract\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f005_event-queue-kernel\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f006_randomness-seed-registry\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f007_state-transition-contract\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f008_invariant-conservation-ledger\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f009_world-snapshot-envelope\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f010_simulation-boundary-map\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f011_entity-identity-registry\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f012_component-schema-catalog\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f013_agent-capability-envelope\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f014_behaviour-tree-adapter\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f015_finite-state-agent-controller\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f016_utility-decision-module\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f017_goal-plan-stack\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f018_need-drive-regulator\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f019_relationship-network\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f020_game-organism-assembly-adapter\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f021_habitat-patch-model\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f022_population-cohort-ledger\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f023_species-trait-profile\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f024_food-web-network\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f025_resource-regeneration-loop\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    },
    {
      "rootId": "workshop",
      "path": "intakes\u002fsim-living-run102\u002fpayload\u002fAXM_SIMULATION_LIVING_SYSTEMS_COMPLETE_100_STEWARD_RUNS_LOCAL_INTAKE_FINAL\u002fmodules\u002f026_carrying-capacity-adapter\u002ffixtures",
      "immediateEntries": 102,
      "immediateFiles": 102,
      "immediateDirectories": 0
    }
  ],
  "growth": {
    "state": "BASELINE_ONLY",
    "previousSnapshotId": null,
    "elapsedHours": null,
    "totalFiles": null,
    "logicalBytes": null,
    "logicalBytesPerDay": null
  },
  "reviewProposals": [
    {
      "id": "exact-duplicate-review",
      "state": "REVIEW_AVAILABLE",
      "groups": 266,
      "boundary": "Review content identity and ownership. No keep\u002fdelete target is selected."
    },
    {
      "id": "repetitive-telemetry-retention-review",
      "state": "REVIEW_AVAILABLE",
      "files": 408,
      "boundary": "Prefer bounded checkpoints plus aggregate counts only after the owning module confirms replay and audit needs."
    },
    {
      "id": "derived-view-regeneration-review",
      "state": "REVIEW_AVAILABLE",
      "files": 5259,
      "boundary": "Regenerability is not assumed from path class alone. Verify a rebuild path before any cleanup proposal."
    }
  ],
  "classificationBoundary": "Retention classes are deterministic path-based operational labels, not semantic truth. CANONICAL_STATE, DURABLE_EVENT, PRIVATE_OR_USER_SOURCE, and UNCLASSIFIED are protected by default. A duplicate hash proves equal bytes at observation time, not that either path is disposable.",
  "truth": {
    "contentIdentityForReportedGroupsProven": true,
    "duplicateScopeCoverageComplete": true,
    "duplicateCoverageComplete": false,
    "allocatedBytesExact": false,
    "semanticImportanceInferred": false,
    "deletionTargetSelected": false,
    "deletionPerformed": false,
    "compressionPerformed": false,
    "hardlinkPerformed": false,
    "sourceMutationPerformed": false,
    "permissionChanged": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
