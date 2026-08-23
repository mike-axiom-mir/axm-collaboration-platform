#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Receipts = require("./scope-transition-receipts");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function run() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "axm-scope-transition-"));
  let assertions = 0;
  try {
    const workshopRoot = path.join(fixture, "workshop");
    const archiveRoot = path.join(fixture, "archive", "transition-one");
    const itemRoot = path.join(archiveRoot, "raw-one");
    fs.mkdirSync(itemRoot, { recursive: true });
    fs.writeFileSync(path.join(itemRoot, "carrier.txt"), "preserved carrier\n");
    fs.writeFileSync(path.join(itemRoot, "receipt.json"), '{"accepted":true}\n');
    const inventory = Receipts.collectInventory(itemRoot);
    const archiveManifest = {
      schema: Receipts.ARCHIVE_MANIFEST_SCHEMA,
      items: [{
        name: "raw-one",
        fileCount: inventory.fileCount,
        byteCount: inventory.byteCount,
        inventoryDigest: inventory.inventoryDigest,
        evidenceFile: "receipt.json",
        evidenceSha256: Receipts.sha256File(path.join(itemRoot, "receipt.json")),
        classification: "fixture_preserved",
        admittedTarget: "shared/fixture",
      }],
    };
    const manifestFile = path.join(archiveRoot, "ARCHIVE_MANIFEST.json");
    writeJson(manifestFile, archiveManifest);
    const manifestSha256 = Receipts.sha256File(manifestFile);
    const transition = {
      id: "fixture-v0-v2",
      effectiveAt: "2026-08-23T00:00:00.000Z",
      title: "Fixture transition",
      reason: "Test scope migration",
      previousSnapshot: { id: "old", scopeRulesVersion: 0, totalFiles: 10, exactCapabilities: 2, capabilityDeclarations: 3 },
      comparableBaseline: { id: "new", scopeRulesVersion: 2, totalFiles: 6, exactCapabilities: 4, capabilityDeclarations: 5 },
      archive: { manifestPath: "../archive/transition-one/ARCHIVE_MANIFEST.json", manifestSha256, itemCount: 1, fileCount: inventory.fileCount, byteCount: inventory.byteCount, admittedCount: 1, heldCount: 0 },
      truth: { automaticLossInferencePrevented: true, arithmeticBalanceRequired: false },
    };
    const ledgerFile = path.join(workshopRoot, "registry", "workshop-scope-transitions.json");
    const historyFile = path.join(workshopRoot, "state", "workshop-growth", "history.json");
    const auditFile = path.join(workshopRoot, "state", "workshop-growth", "archive-verification.json");
    writeJson(ledgerFile, { schema: Receipts.LEDGER_SCHEMA, status: "TEST", transitions: [transition] });
    writeJson(historyFile, { snapshots: [transition.previousSnapshot, transition.comparableBaseline] });

    let status = Receipts.evaluate({ workshopRoot, ledgerFile, historyFile, auditReceiptFile: auditFile });
    assert.equal(status.state, "BROKEN", "a transition without a full archive audit must fail closed"); assertions++;
    const audit = Receipts.auditArchive({ workshopRoot, transition });
    assert.equal(audit.pass, true); assertions++;
    assert.equal(Receipts.validateAuditReceipt(audit).pass, true); assertions++;
    writeJson(auditFile, audit);
    status = Receipts.evaluate({ workshopRoot, ledgerFile, historyFile, auditReceiptFile: auditFile });
    assert.equal(status.state, "VERIFIED"); assertions++;
    assert.equal(status.transitions[0].archive.items[0].admittedTarget, "shared/fixture"); assertions++;

    writeJson(historyFile, { snapshots: [transition.comparableBaseline] });
    status = Receipts.evaluate({ workshopRoot, ledgerFile, historyFile, auditReceiptFile: auditFile });
    assert.equal(status.state, "BROKEN", "restart/history loss must remain visible"); assertions++;
    writeJson(historyFile, { snapshots: [transition.previousSnapshot, transition.comparableBaseline] });
    const tamperedAudit = Object.assign({}, audit, { checkedFileCount: 999 });
    writeJson(auditFile, tamperedAudit);
    status = Receipts.evaluate({ workshopRoot, ledgerFile, historyFile, auditReceiptFile: auditFile });
    assert.equal(status.state, "BROKEN", "a changed audit receipt must not be trusted"); assertions++;

    const preSource = path.join(fixture, "pre-source");
    const preArchive = path.join(fixture, "pre-archive");
    fs.mkdirSync(path.join(preSource, "candidate"), { recursive: true });
    fs.writeFileSync(path.join(preSource, "candidate", "a.txt"), "a\n");
    const wrong = Receipts.collectInventory(path.join(preSource, "candidate"));
    wrong.byteCount += 1;
    assert.throws(() => Receipts.moveVerifiedIntakes({ plan: { schema: Receipts.PLAN_SCHEMA, sourceRoot: preSource, archiveRoot: preArchive, items: [Object.assign({ name: "candidate" }, wrong)] }, confirm: "explicit-local-reviewed-intake-archive" }), (error) => error.code === "PRE_MOVE_INVENTORY_MISMATCH"); assertions++;
    assert.equal(fs.existsSync(path.join(preSource, "candidate")), true, "preflight failure must move nothing"); assertions++;

    const postSource = path.join(fixture, "post-source");
    const postArchive = path.join(fixture, "post-archive");
    fs.mkdirSync(path.join(postSource, "candidate"), { recursive: true });
    fs.writeFileSync(path.join(postSource, "candidate", "a.txt"), "a\n");
    const postExpected = Receipts.collectInventory(path.join(postSource, "candidate"));
    assert.throws(() => Receipts.moveVerifiedIntakes({
      plan: { schema: Receipts.PLAN_SCHEMA, sourceRoot: postSource, archiveRoot: postArchive, items: [Object.assign({ name: "candidate" }, postExpected)] },
      confirm: "explicit-local-reviewed-intake-archive",
      afterMove: ({ archiveRoot: movedRoot }) => fs.appendFileSync(path.join(movedRoot, "candidate", "a.txt"), "changed\n"),
    }), (error) => error.code === "POST_MOVE_INVENTORY_MISMATCH"); assertions++;
    assert.equal(fs.existsSync(path.join(postSource, "candidate", "a.txt")), true, "postflight mismatch must roll the exact root back"); assertions++;

    const goodSource = path.join(fixture, "good-source");
    const goodArchive = path.join(fixture, "good-archive");
    fs.mkdirSync(path.join(goodSource, "candidate"), { recursive: true });
    fs.writeFileSync(path.join(goodSource, "candidate", "a.txt"), "a\n");
    const goodExpected = Receipts.collectInventory(path.join(goodSource, "candidate"));
    const moved = Receipts.moveVerifiedIntakes({ plan: { schema: Receipts.PLAN_SCHEMA, sourceRoot: goodSource, archiveRoot: goodArchive, items: [Object.assign({ name: "candidate" }, goodExpected)] }, confirm: "explicit-local-reviewed-intake-archive" });
    assert.equal(moved.pass, true); assertions++;
    assert.equal(fs.existsSync(path.join(goodSource, "candidate")), false); assertions++;
    assert.equal(fs.existsSync(path.join(goodArchive, "candidate", "a.txt")), true); assertions++;
    assert.equal(fs.existsSync(path.join(goodArchive, "ARCHIVE_MANIFEST.json")), true); assertions++;
    return assertions;
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

if (require.main === module) console.log(`Workshop scope transition selftest: PASS (${run()} assertions)`);

module.exports = { run };
