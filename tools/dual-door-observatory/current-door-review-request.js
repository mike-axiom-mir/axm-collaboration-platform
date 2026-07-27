'use strict';
window.AXM_DOOR_REVIEW_REQUEST = {
  "schema": "axm.door-review-request\u002fv1",
  "version": "v0.2",
  "generatedAt": "2026-07-27T03:47:14.270Z",
  "fingerprint": "29d95e6f0938b5f15b8aafed54ab783483ebedfe444f95b20f2e0ff945653027",
  "selectedModule": {
    "id": "evidence-desk",
    "folder": "evidence-desk",
    "version": "v0.1",
    "status": "TEST"
  },
  "selectedDoor": {
    "kind": "MACHINE",
    "path": "machine.js",
    "observedState": "PRESENT",
    "bytes": 1304,
    "status": "TEST",
    "apiVersion": "1.0",
    "effect": null,
    "actionShape": "OBJECT_MAP"
  },
  "selectedAction": {
    "id": "validate",
    "declarationShape": "OBJECT_DECLARATION",
    "descriptionDeclared": true,
    "effectDeclared": true,
    "inputSchemaDeclared": true
  },
  "sourceObservation": {
    "schema": "axm.dual-door-map\u002fv1",
    "measuredAt": "2026-07-27T03:47:14.265Z",
    "freshnessTtlMs": 7200000,
    "fingerprint": "18a4bc21ef10e80a8f8171a8e4946bbfb7fcda3ded6782691b0f5f09cf2b8e01",
    "freshnessAtRequest": {
      "status": "LIVE",
      "ageMs": 5,
      "remainingMs": 7199995
    }
  },
  "executionEnvelope": {
    "commandIncluded": false,
    "argumentsIncluded": false,
    "environmentValuesIncluded": false,
    "fixtureInputIncluded": false,
    "networkAccessRequested": false,
    "sourceWriteAccessRequested": false,
    "sideEffectsUnknownUntilOwnerReview": true
  },
  "summary": {
    "doorsSelected": 1,
    "actionsSelected": 1,
    "checksRequested": 4,
    "checksRun": 0
  },
  "checks": [
    {
      "id": "CHECK_SOURCE_FINGERPRINT_AND_ENTRY_PRESENCE",
      "state": "REQUEST_NOT_RUN",
      "executionAuthority": "MACHINE_HOST_AND_DECLARING_MODULE_OWNER",
      "observation": null,
      "decision": null
    },
    {
      "id": "CHECK_MACHINE_HOST_GATE_AND_ACTION_DECLARATION",
      "state": "REQUEST_NOT_RUN",
      "executionAuthority": "MACHINE_HOST_AND_DECLARING_MODULE_OWNER",
      "observation": null,
      "decision": null
    },
    {
      "id": "INVOKE_ONLY_SELECTED_ACTION_WITH_SEPARATELY_APPROVED_FIXTURE",
      "state": "REQUEST_NOT_RUN",
      "executionAuthority": "MACHINE_HOST_AND_DECLARING_MODULE_OWNER",
      "observation": null,
      "decision": null
    },
    {
      "id": "CAPTURE_RESULT_AND_SIDE_EFFECT_RECEIPT",
      "state": "REQUEST_NOT_RUN",
      "executionAuthority": "MACHINE_HOST_AND_DECLARING_MODULE_OWNER",
      "observation": null,
      "decision": null
    }
  ],
  "scopeBoundary": "This request names one already-observed human door or one machine door plus an exactly declared action. It supplies no command, arguments, environment values, or fixture and cannot open, render, or execute itself.",
  "truth": {
    "requestOnly": true,
    "entryCodeLoaded": false,
    "humanDoorRendered": false,
    "machineActionExecuted": false,
    "routeProven": false,
    "actionSemanticsProven": false,
    "visualQualityProven": false,
    "passingProven": false,
    "readinessProven": false,
    "permissionGranted": false,
    "sideEffectsProvenAbsent": false,
    "sourceMutationPerformed": false,
    "installerStagingPerformed": false,
    "installationPerformed": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
