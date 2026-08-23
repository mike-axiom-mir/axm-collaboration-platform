#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Receipts = require("../shared/growth/scope-transition-receipts");

const ROOT = path.resolve(__dirname, "..");
const LEDGER_FILE = path.join(ROOT, "registry", "workshop-scope-transitions.json");
const OUTPUT_FILE = path.join(ROOT, "state", "workshop-growth", "archive-verification.json");

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  fs.renameSync(temporary, file);
}

const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
const ledgerCheck = Receipts.validateLedger(ledger);
if (!ledgerCheck.pass) throw new Error(ledgerCheck.errors.join("; "));
const transition = ledger.transitions[ledger.transitions.length - 1];
const receipt = Receipts.auditArchive({ workshopRoot: ROOT, transition });
if (!receipt.pass) {
  console.error(JSON.stringify(receipt, null, 2));
  throw new Error("ARCHIVE_VERIFICATION_FAILED; previous passing receipt was not overwritten");
}
atomicJson(OUTPUT_FILE, receipt);
console.log(JSON.stringify({
  state: "PASS",
  transitionId: receipt.transitionId,
  checkedItemCount: receipt.checkedItemCount,
  checkedFileCount: receipt.checkedFileCount,
  checkedByteCount: receipt.checkedByteCount,
  receiptSha256: receipt.receiptSha256,
  output: path.relative(ROOT, OUTPUT_FILE).replace(/\\/g, "/"),
}, null, 2));
