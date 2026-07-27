'use strict';
window.AXM_HUMAN_CONTROL_BINDING_REVIEW_REQUEST = {
  "schema": "axm.human-control-binding-review-request\u002fv1",
  "version": "v0.1",
  "generatedAt": "2026-07-27T04:58:01.441Z",
  "fingerprint": "9ceb1fbccc3f20a3b1bd603798331412ee6470e2a568c4f162fec3ebac9ee601",
  "sourceObservation": {
    "schema": "axm.human-control-binding-map\u002fv1",
    "measuredAt": "2026-07-27T04:58:01.414Z",
    "freshnessTtlMs": 7200000,
    "fingerprint": "34703a3de048ef7e29989764f3d53100d44d7b61c5d6167c53e4622e06529f28"
  },
  "selectedModule": {
    "id": "c436755aea96fc3ddfb3",
    "moduleId": "claude-connector",
    "entryPath": "tools\u002fclaude-connector\u002findex.html",
    "state": "STATIC_HUMAN_CONTROL_REVIEW",
    "noStaticBindingEvidence": 1,
    "unnamedControlObservations": 0,
    "duplicateIdGroups": 0,
    "controlIds": [
      "39fc8c7725dd494cc1df"
    ]
  },
  "selectedControls": [
    {
      "tag": "button",
      "id": "refresh",
      "name": null,
      "type": null,
      "accessibleNameObservation": "REFRESH",
      "inlineBindings": [],
      "nativeAction": null,
      "disabledDeclared": false,
      "hiddenDeclared": false,
      "hrefDeclared": null,
      "entryPath": "tools\u002fclaude-connector\u002findex.html",
      "line": 37,
      "controlId": "39fc8c7725dd494cc1df",
      "evidence": [],
      "bindingState": "NO_STATIC_BINDING_EVIDENCE",
      "runtimeInteractionProven": false,
      "accessibleNameAdequacyProven": false
    }
  ],
  "questions": [
    {
      "id": "CONFIRM_EACH_REVIEWED_ELEMENT_IS_INTENDED_AS_A_HUMAN_CONTROL",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "VERIFY_INTERACTION_IN_BROWSER_QA_AND_ATTACH_VISIBLE_EVIDENCE",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "CHECK_ACCESSIBLE_NAME_KEYBOARD_AND_FOCUS_BEHAVIOR_WITH_HUMAN_JUDGMENT",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    },
    {
      "id": "RECORD_KEEP_BIND_REMOVE_OR_REDESIGN_DECISION_WITH_ROUTE_AND_PERMISSION_BOUNDARIES",
      "state": "REQUEST_NOT_RUN",
      "answer": null,
      "evidence": null
    }
  ],
  "summary": {
    "modulesSelected": 1,
    "controlsSelected": 1,
    "questionsRequested": 4,
    "questionsAnswered": 0
  },
  "scopeBoundary": "This packet asks existing module, browser QA, route, accessibility, visual, and permission owners to inspect one module. It clicks nothing, changes no source, grants no permission, and makes no accessibility or broken-control verdict.",
  "truth": {
    "requestOnly": true,
    "browserLoaded": false,
    "controlClicked": false,
    "runtimeInteractionProven": false,
    "accessibilityAdequacyProven": false,
    "routeBehaviorProven": false,
    "sourceChanged": false,
    "permissionChanged": false,
    "installationPerformed": false,
    "promotionPerformed": false,
    "canonChanged": false
  }
};
