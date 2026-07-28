import test from "node:test";
import assert from "node:assert/strict";
import {
  assessGameAdapterConformance,
  createGameContractFromMold
} from "../src/index.mjs";

function contract() {
  return createGameContractFromMold({
    moldId: "full-presentation",
    gameId: "test.conformance",
    gameVersion: "1.0.0"
  });
}

test("generated full-game contracts pass structural conformance with runtime proof pending", () => {
  const report = assessGameAdapterConformance({ gameContract: contract() });
  assert.equal(report.readiness, "CONTRACT_READY_RUNTIME_PENDING");
  assert.equal(report.summary.failed, 0);
  assert.equal(report.summary.pending, 4);
  assert.equal(report.automaticWrites, 0);
});

test("four observed runtime receipts advance a valid contract to adoption review", () => {
  const report = assessGameAdapterConformance({
    gameContract: contract(),
    adapterEvidence: {
      previewIsolated: true,
      fallbackObserved: true,
      rollbackObserved: true,
      receiptObserved: true
    }
  });
  assert.equal(report.readiness, "READY_FOR_ADOPTION_REVIEW");
  assert.equal(report.summary.pending, 0);
  assert.equal(report.summary.passed, report.summary.total);
});

test("duplicate slots and unknown properties fail conformance", () => {
  const hostile = contract();
  hostile.slots[1].id = hostile.slots[0].id;
  hostile.slots[0].supportedProperties.push("unknownShaderRoute");
  const report = assessGameAdapterConformance({ gameContract: hostile });
  assert.equal(report.readiness, "NOT_READY");
  assert(report.checks.some((check) => check.id === "uniqueSlotIds" && check.state === "FAIL"));
  assert(
    report.checks.some(
      (check) => check.id === "materialPropertiesRecognized" && check.state === "FAIL"
    )
  );
});

