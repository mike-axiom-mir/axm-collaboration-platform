'use strict';
window.AXM_STORAGE_NAMESPACE_REVIEW_REQUEST = {
  "schema": "axm.storage-namespace-review-request\u002fv1",
  "version": "v0.1",
  "generatedAt": "2026-07-27T04:44:29.955Z",
  "fingerprint": "f1dbdeabff8cbe8e5ea0a514429e09d57bdc2c7088fecaefc4e5ecb417c3fd00",
  "sourceObservation": {
    "schema": "axm.storage-namespace-map\u002fv1",
    "measuredAt": "2026-07-27T04:44:29.951Z",
    "freshnessTtlMs": 7200000,
    "fingerprint": "fc2d4e0f61c98d36d5b822344215f8e673e9415a1c59c6bdac3f36c7dc1a6ed3"
  },
  "selectedGroup": {
    "id": "bda2b4e6d04ea4cc4dc0",
    "storageKind": "LOCALSTORAGE",
    "namespace": "axm.collaboration.notice.open",
    "state": "SHARED_EXACT_NAMESPACE_REVIEW",
    "ownershipScopes": [
      "ai-task-talk",
      "ai-team"
    ],
    "occurrences": [
      {
        "path": "tools\u002fai-task-talk\u002findex.html",
        "line": 83,
        "operation": "GETITEM",
        "sourceOwner": "ai-task-talk",
        "consumingModules": [
          "ai-task-talk"
        ]
      },
      {
        "path": "tools\u002fai-task-talk\u002findex.html",
        "line": 83,
        "operation": "REMOVEITEM",
        "sourceOwner": "ai-task-talk",
        "consumingModules": [
          "ai-task-talk"
        ]
      },
      {
        "path": "tools\u002fai-team\u002fai-team.js",
        "line": 40,
        "operation": "SETITEM",
        "sourceOwner": "ai-team",
        "consumingModules": [
          "ai-team"
        ]
      },
      {
        "path": "tools\u002fai-team\u002fai-team.js",
        "line": 99,
        "operation": "GETITEM",
        "sourceOwner": "ai-team",
        "consumingModules": [
          "ai-team"
        ]
      }
    ]
  },
  "questions": [
    {
      "id": "CONFIRM_NAMESPACE_IS_INTENTIONALLY_SHARED_OR_ACCIDENTAL",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "IDENTIFY_RUNTIME_OWNER_FOR_EACH_SCOPE",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "CHECK_VALUE_SHAPE_AND_LIFECYCLE_COMPATIBILITY_SEPARATELY",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "RECORD_KEEP_ADAPT_OR_RENAME_DECISION_WITH_MIGRATION_BOUNDARY",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    }
  ],
  "summary": {
    "groupsSelected": 1,
    "questionsRequested": 4,
    "questionsAnswered": 0
  },
  "scopeBoundary": "This packet asks existing storage and module owners to explain one exact repeated namespace. It contains no stored value, migration, rename command, browser action, grant, or execution authority.",
  "truth": {
    "requestOnly": true,
    "liveStorageRead": false,
    "storedValuesIncluded": false,
    "migrationPerformed": false,
    "namespaceRenamed": false,
    "browserLoaded": false,
    "permissionChanged": false,
    "installationPerformed": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
