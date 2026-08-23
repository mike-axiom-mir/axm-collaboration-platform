"use strict";

const fs = require("fs");
const { parentPort, workerData } = require("worker_threads");
const Receipts = require("./scope-transition-receipts");
const OperationsUtils = require("../operations/operations-utils");

try {
  const ledger = JSON.parse(fs.readFileSync(workerData.ledgerFile, "utf8"));
  const ledgerCheck = Receipts.validateLedger(ledger);
  if (!ledgerCheck.pass) throw new Error(ledgerCheck.errors.join("; "));
  const transition = ledger.transitions[ledger.transitions.length - 1];
  const receipt = Receipts.auditArchive({ workshopRoot: workerData.workshopRoot, transition });
  if (!receipt.pass) {
    parentPort.postMessage({ ok: false, error: "ARCHIVE_VERIFICATION_FAILED", receipt });
  } else {
    OperationsUtils.atomicJson(workerData.outputFile, receipt);
    parentPort.postMessage({ ok: true, receipt });
  }
} catch (error) {
  parentPort.postMessage({ ok: false, error: String(error && error.message || error).slice(0, 500) });
}
