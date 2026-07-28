import {
  SLOT_LIBRARY,
  UNIVERSAL_MATERIAL_PROPERTIES
} from "./molds.mjs";
import { clone } from "./stable.mjs";
import { validateGameSkinContract } from "./validator.mjs";

const RUNTIME_EVIDENCE = Object.freeze([
  Object.freeze({
    id: "previewIsolated",
    name: "Isolated preview observed",
    message: "Preview changes presentation in a specimen without mutating the active game."
  }),
  Object.freeze({
    id: "fallbackObserved",
    name: "Game fallback observed",
    message: "A missing or rejected surface visibly retains the game-owned appearance."
  }),
  Object.freeze({
    id: "rollbackObserved",
    name: "Rollback observed",
    message: "An applied skin can restore the exact previous presentation state."
  }),
  Object.freeze({
    id: "receiptObserved",
    name: "Resolution receipt observed",
    message: "The adapter returns applied, fallback, protected, and unsupported evidence."
  })
]);

function contractCheck(id, name, state, message, detail = null) {
  return {
    id,
    stage: "CONTRACT",
    name,
    state,
    message,
    detail
  };
}

function runtimeCheck(definition, evidence) {
  const observed = evidence?.[definition.id] === true;
  return {
    id: definition.id,
    stage: "RUNTIME",
    name: definition.name,
    state: observed ? "PASS" : "PENDING",
    message: definition.message,
    detail: observed
      ? "Recorded as an observed local proof; attach a real test receipt before promotion."
      : "No observed adapter proof has been recorded."
  };
}

function semanticRole(slot) {
  return slot?.adapterHints?.semanticRole ?? slot?.id ?? null;
}

export function assessGameAdapterConformance({
  gameContract,
  adapterEvidence = {}
} = {}) {
  const validation = validateGameSkinContract(gameContract);
  const slots = Array.isArray(gameContract?.slots) ? gameContract.slots : [];
  const ids = slots.map((slot) => slot?.id).filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const unknownRoles = slots
    .map((slot) => semanticRole(slot))
    .filter((role) => role && !SLOT_LIBRARY[role]);
  const unknownProperties = slots.flatMap((slot) =>
    (slot?.supportedProperties ?? [])
      .filter((property) => !UNIVERSAL_MATERIAL_PROPERTIES.includes(property))
      .map((property) => `${slot.id}:${property}`)
  );
  const missingFallbacks = slots
    .filter(
      (slot) =>
        !slot?.fallback ||
        typeof slot.fallback !== "object" ||
        Object.keys(slot.fallback).length === 0
    )
    .map((slot) => slot?.id ?? "(unnamed)");
  const missingProtectedCues = slots.flatMap((slot) => {
    const role = semanticRole(slot);
    const requiredCues = SLOT_LIBRARY[role]?.protectedCues ?? [];
    const declared = new Set(slot?.protectedCues ?? []);
    const missing = requiredCues.filter((cue) => !declared.has(cue));
    return missing.map((cue) => `${slot.id}:${cue}`);
  });

  const checks = [
    contractCheck(
      "contractValid",
      "Contract structure valid",
      validation.ok ? "PASS" : "FAIL",
      "The game contract matches the portable v1 declaration.",
      validation.ok ? null : clone(validation.errors)
    ),
    contractCheck(
      "uniqueSlotIds",
      "Semantic slot IDs unique",
      duplicateIds.length ? "FAIL" : "PASS",
      "Every renderer mapping has one unambiguous game-owned slot ID.",
      duplicateIds
    ),
    contractCheck(
      "knownSemanticRoles",
      "Semantic roles recognized",
      unknownRoles.length ? "FAIL" : "PASS",
      "Every declared role belongs to the shared Style Fabric surface catalog.",
      [...new Set(unknownRoles)]
    ),
    contractCheck(
      "materialPropertiesRecognized",
      "Material properties bounded",
      unknownProperties.length ? "FAIL" : "PASS",
      "The adapter exposes only declarative material properties understood by the policy gate.",
      unknownProperties
    ),
    contractCheck(
      "fallbacksDeclared",
      "Game fallbacks declared",
      missingFallbacks.length ? "FAIL" : "PASS",
      "Every adopted surface retains a game-owned original appearance.",
      missingFallbacks
    ),
    contractCheck(
      "protectedCuesRetained",
      "Protected cues retained",
      missingProtectedCues.length ? "FAIL" : "PASS",
      "Readability, identity, status, and motion cues required by each semantic role remain declared.",
      missingProtectedCues
    ),
    ...RUNTIME_EVIDENCE.map((definition) => runtimeCheck(definition, adapterEvidence))
  ];
  const summary = {
    passed: checks.filter((check) => check.state === "PASS").length,
    failed: checks.filter((check) => check.state === "FAIL").length,
    pending: checks.filter((check) => check.state === "PENDING").length,
    total: checks.length
  };

  return {
    type: "axm.game-adapter-conformance-report",
    version: "1.0",
    gameId: gameContract?.gameId ?? null,
    adapterApi: gameContract?.adapterApi ?? null,
    readiness:
      summary.failed > 0
        ? "NOT_READY"
        : summary.pending > 0
          ? "CONTRACT_READY_RUNTIME_PENDING"
          : "READY_FOR_ADOPTION_REVIEW",
    evidenceMode: "DECLARED_LOCAL_OBSERVATION",
    summary,
    checks,
    automaticWrites: 0
  };
}

