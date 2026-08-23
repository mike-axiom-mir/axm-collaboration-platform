"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LEDGER_SCHEMA = "axm.workshop.scope-transition-ledger.v1";
const AUDIT_SCHEMA = "axm.workshop.archive-verification-receipt.v1";
const PLAN_SCHEMA = "axm.workshop.intake-archive-plan.v1";
const ARCHIVE_MANIFEST_SCHEMA = "axm.workshop.intake-archive-manifest.v1";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function portableRelative(file, root) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function collectInventory(root) {
  const base = path.resolve(root);
  const entries = [];
  function visit(dir) {
    fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile()) {
          entries.push({ path: portableRelative(file, base), bytes: fs.statSync(file).size });
        }
      });
  }
  visit(base);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const digestInput = entries.map((entry) => `${entry.path}\t${entry.bytes}\n`).join("");
  return {
    fileCount: entries.length,
    byteCount: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    inventoryDigest: sha256Buffer(Buffer.from(digestInput, "utf8")),
  };
}

function manifestSummary(manifest) {
  const items = Array.isArray(manifest && manifest.items) ? manifest.items : [];
  return {
    itemCount: items.length,
    fileCount: items.reduce((sum, item) => sum + Number(item.fileCount || 0), 0),
    byteCount: items.reduce((sum, item) => sum + Number(item.byteCount || 0), 0),
    admittedCount: items.filter((item) => item.admittedTarget).length,
    heldCount: items.filter((item) => !item.admittedTarget).length,
  };
}

function validateLedger(ledger) {
  const errors = [];
  if (!ledger || ledger.schema !== LEDGER_SCHEMA) errors.push("LEDGER_SCHEMA_INVALID");
  const rows = Array.isArray(ledger && ledger.transitions) ? ledger.transitions : [];
  if (!rows.length) errors.push("TRANSITION_RECEIPT_MISSING");
  const ids = new Set();
  rows.forEach((row) => {
    if (!row || !row.id || ids.has(row.id)) errors.push("TRANSITION_ID_INVALID");
    else ids.add(row.id);
    if (!row.previousSnapshot || !row.comparableBaseline) errors.push(`SNAPSHOT_BINDING_MISSING:${row && row.id}`);
    if (!row.archive || !row.archive.manifestPath || !/^[a-f0-9]{64}$/i.test(String(row.archive.manifestSha256 || ""))) {
      errors.push(`ARCHIVE_BINDING_INVALID:${row && row.id}`);
    }
    if (!row.truth || row.truth.automaticLossInferencePrevented !== true || row.truth.arithmeticBalanceRequired !== false) {
      errors.push(`TRUTH_BOUNDARY_INVALID:${row && row.id}`);
    }
  });
  return { pass: errors.length === 0, errors };
}

function snapshotMatches(actual, expected) {
  if (!actual || !expected) return false;
  return ["id", "scopeRulesVersion", "totalFiles", "exactCapabilities", "capabilityDeclarations"]
    .every((key) => String(actual[key]) === String(expected[key]));
}

function unsignedAudit(receipt) {
  const copy = Object.assign({}, receipt);
  delete copy.receiptSha256;
  return copy;
}

function sealAudit(receipt) {
  const out = Object.assign({}, receipt);
  out.receiptSha256 = sha256Buffer(Buffer.from(JSON.stringify(unsignedAudit(out)), "utf8"));
  return out;
}

function validateAuditReceipt(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== AUDIT_SCHEMA) errors.push("AUDIT_RECEIPT_SCHEMA_INVALID");
  if (!receipt || receipt.pass !== true) errors.push("ARCHIVE_AUDIT_NOT_PASSING");
  const expected = receipt && receipt.receiptSha256;
  const actual = receipt ? sealAudit(receipt).receiptSha256 : null;
  if (!expected || expected !== actual) errors.push("AUDIT_RECEIPT_DIGEST_MISMATCH");
  return { pass: errors.length === 0, errors };
}

function resolveManifest(workshopRoot, manifestPath) {
  const root = path.resolve(workshopRoot);
  const allowed = path.resolve(root, "..");
  const resolved = path.resolve(root, String(manifestPath || ""));
  const relative = path.relative(allowed, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("ARCHIVE_MANIFEST_OUTSIDE_ALLOWED_WORKSHOP_PARENT");
    error.code = "ARCHIVE_MANIFEST_OUTSIDE_ALLOWED_WORKSHOP_PARENT";
    throw error;
  }
  return resolved;
}

function auditArchive(options) {
  const input = options || {};
  const transition = input.transition || {};
  const archiveBinding = transition.archive || {};
  const manifestFile = input.manifestFile || resolveManifest(input.workshopRoot, archiveBinding.manifestPath);
  const manifest = readJson(manifestFile);
  const manifestSha256 = sha256File(manifestFile);
  const summary = manifestSummary(manifest);
  const mismatches = [];
  const evidenceMismatches = [];
  if (manifest.schema !== ARCHIVE_MANIFEST_SCHEMA) mismatches.push({ code: "ARCHIVE_MANIFEST_SCHEMA_INVALID" });
  if (manifestSha256 !== String(archiveBinding.manifestSha256 || "").toLowerCase()) mismatches.push({ code: "ARCHIVE_MANIFEST_DIGEST_MISMATCH" });
  ["itemCount", "fileCount", "byteCount"].forEach((key) => {
    if (Number(summary[key]) !== Number(archiveBinding[key])) mismatches.push({ code: `ARCHIVE_${key.toUpperCase()}_MISMATCH` });
  });
  const archiveRoot = path.dirname(manifestFile);
  (manifest.items || []).forEach((item) => {
    const itemRoot = path.resolve(archiveRoot, String(item.name || ""));
    if (path.dirname(itemRoot) !== archiveRoot || !fs.existsSync(itemRoot)) {
      mismatches.push({ code: "ARCHIVE_ITEM_MISSING", item: item.name });
      return;
    }
    const actual = collectInventory(itemRoot);
    if (actual.fileCount !== Number(item.fileCount) || actual.byteCount !== Number(item.byteCount) || actual.inventoryDigest !== item.inventoryDigest) {
      mismatches.push({ code: "ARCHIVE_ITEM_INVENTORY_MISMATCH", item: item.name, expected: { fileCount: item.fileCount, byteCount: item.byteCount, inventoryDigest: item.inventoryDigest }, actual });
    }
    if (item.evidenceFile && item.evidenceSha256) {
      const evidenceFile = path.resolve(itemRoot, item.evidenceFile);
      const relative = path.relative(itemRoot, evidenceFile);
      if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(evidenceFile) || sha256File(evidenceFile) !== item.evidenceSha256) {
        evidenceMismatches.push({ code: "ARCHIVE_EVIDENCE_MISMATCH", item: item.name, evidenceFile: item.evidenceFile });
      }
    }
  });
  return sealAudit({
    schema: AUDIT_SCHEMA,
    transitionId: transition.id,
    verifiedAt: new Date().toISOString(),
    pass: mismatches.length === 0 && evidenceMismatches.length === 0,
    archiveManifestSha256: manifestSha256,
    checkedItemCount: summary.itemCount,
    checkedFileCount: summary.fileCount,
    checkedByteCount: summary.byteCount,
    inventoryMismatches: mismatches,
    evidenceMismatches,
    truth: { contentDeletionPerformed: false, fullInventoryRehashed: true, automaticPromotion: false },
  });
}

function evaluate(options) {
  const input = options || {};
  let ledger;
  let history;
  let auditReceipt = null;
  try { ledger = readJson(input.ledgerFile); } catch (error) {
    return { schema: "axm.workshop.scope-transition-status.v1", state: "BROKEN", errors: ["TRANSITION_LEDGER_UNREADABLE"], transitions: [] };
  }
  try { history = readJson(input.historyFile); } catch (_) { history = { snapshots: [] }; }
  try { auditReceipt = readJson(input.auditReceiptFile); } catch (_) {}
  const ledgerCheck = validateLedger(ledger);
  const snapshots = Array.isArray(history.snapshots) ? history.snapshots : [];
  const transitions = (ledger.transitions || []).map((transition) => {
    const errors = [];
    const previous = snapshots.find((row) => row.id === transition.previousSnapshot.id);
    const baseline = snapshots.find((row) => row.id === transition.comparableBaseline.id);
    if (!snapshotMatches(previous, transition.previousSnapshot)) errors.push("PREVIOUS_SNAPSHOT_MISSING_OR_CHANGED");
    if (!snapshotMatches(baseline, transition.comparableBaseline)) errors.push("COMPARABLE_BASELINE_MISSING_OR_CHANGED");
    let manifest = null;
    let summary = null;
    let manifestSha256 = null;
    try {
      const manifestFile = resolveManifest(input.workshopRoot, transition.archive.manifestPath);
      manifest = readJson(manifestFile);
      summary = manifestSummary(manifest);
      manifestSha256 = sha256File(manifestFile);
      if (manifestSha256 !== transition.archive.manifestSha256) errors.push("ARCHIVE_MANIFEST_DIGEST_MISMATCH");
      if (manifest.schema !== ARCHIVE_MANIFEST_SCHEMA) errors.push("ARCHIVE_MANIFEST_SCHEMA_INVALID");
      ["itemCount", "fileCount", "byteCount"].forEach((key) => {
        if (Number(summary[key]) !== Number(transition.archive[key])) errors.push(`ARCHIVE_${key.toUpperCase()}_MISMATCH`);
      });
    } catch (_) {
      errors.push("ARCHIVE_MANIFEST_UNAVAILABLE");
    }
    const auditCheck = validateAuditReceipt(auditReceipt);
    if (!auditCheck.pass || auditReceipt.transitionId !== transition.id || auditReceipt.archiveManifestSha256 !== transition.archive.manifestSha256 || Number(auditReceipt.checkedFileCount) !== Number(transition.archive.fileCount) || Number(auditReceipt.checkedByteCount) !== Number(transition.archive.byteCount)) {
      errors.push("CURRENT_ARCHIVE_AUDIT_RECEIPT_MISSING_OR_INVALID");
    }
    return {
      id: transition.id,
      state: errors.length ? "BROKEN" : "VERIFIED",
      effectiveAt: transition.effectiveAt,
      title: transition.title,
      reason: transition.reason,
      receiptPath: transition.receiptPath || null,
      previousSnapshot: transition.previousSnapshot,
      comparableBaseline: transition.comparableBaseline,
      archive: Object.assign({}, transition.archive, {
        manifestAvailable: !!manifest,
        manifestSha256,
        admittedCount: summary ? summary.admittedCount : transition.archive.admittedCount,
        heldCount: summary ? summary.heldCount : transition.archive.heldCount,
        items: manifest ? manifest.items.map((item) => ({ name: item.name, fileCount: item.fileCount, byteCount: item.byteCount, classification: item.classification, admittedTarget: item.admittedTarget })) : [],
      }),
      audit: auditReceipt ? { verifiedAt: auditReceipt.verifiedAt, receiptSha256: auditReceipt.receiptSha256, fullInventoryRehashed: auditReceipt.truth && auditReceipt.truth.fullInventoryRehashed === true } : null,
      recovery: transition.recovery,
      truth: transition.truth,
      errors,
    };
  });
  const errors = ledgerCheck.errors.concat(transitions.flatMap((row) => row.errors.map((error) => `${row.id}:${error}`)));
  return { schema: "axm.workshop.scope-transition-status.v1", state: errors.length ? "BROKEN" : "VERIFIED", ledgerStatus: ledger.status || "TEST", errors, transitions };
}

function assertContained(root, candidate, code) {
  const base = path.resolve(root);
  const resolved = path.resolve(candidate);
  const relative = path.relative(base, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return resolved;
}

function moveVerifiedIntakes(options) {
  const input = options || {};
  const plan = input.plan || {};
  if (plan.schema !== PLAN_SCHEMA) throw Object.assign(new Error("ARCHIVE_PLAN_SCHEMA_INVALID"), { code: "ARCHIVE_PLAN_SCHEMA_INVALID" });
  if (input.confirm !== "explicit-local-reviewed-intake-archive") throw Object.assign(new Error("EXPLICIT_ARCHIVE_CONFIRMATION_REQUIRED"), { code: "EXPLICIT_ARCHIVE_CONFIRMATION_REQUIRED" });
  const sourceRoot = path.resolve(plan.sourceRoot);
  const archiveRoot = path.resolve(plan.archiveRoot);
  const sourceToArchive = path.relative(sourceRoot, archiveRoot);
  const archiveToSource = path.relative(archiveRoot, sourceRoot);
  if (sourceRoot === archiveRoot || path.parse(sourceRoot).root.toLowerCase() !== path.parse(archiveRoot).root.toLowerCase() || (!sourceToArchive.startsWith("..") && !path.isAbsolute(sourceToArchive)) || (!archiveToSource.startsWith("..") && !path.isAbsolute(archiveToSource))) throw Object.assign(new Error("ARCHIVE_ROOT_BOUNDARY_INVALID"), { code: "ARCHIVE_ROOT_BOUNDARY_INVALID" });
  const items = Array.isArray(plan.items) ? plan.items : [];
  if (!items.length) throw Object.assign(new Error("ARCHIVE_PLAN_EMPTY"), { code: "ARCHIVE_PLAN_EMPTY" });
  const preErrors = [];
  items.forEach((item) => {
    try {
      if (!item.name || path.basename(item.name) !== item.name) throw new Error("ARCHIVE_ITEM_NAME_INVALID");
      const source = assertContained(sourceRoot, path.join(sourceRoot, item.name), "ARCHIVE_SOURCE_BOUNDARY_INVALID");
      const destination = assertContained(archiveRoot, path.join(archiveRoot, item.name), "ARCHIVE_DESTINATION_BOUNDARY_INVALID");
      if (fs.existsSync(destination)) throw new Error("ARCHIVE_DESTINATION_EXISTS");
      const actual = collectInventory(source);
      if (actual.fileCount !== Number(item.fileCount) || actual.byteCount !== Number(item.byteCount) || actual.inventoryDigest !== item.inventoryDigest) preErrors.push(item.name);
    } catch (_) { preErrors.push(item.name); }
  });
  if (fs.existsSync(path.join(archiveRoot, "ARCHIVE_MANIFEST.json"))) preErrors.push("ARCHIVE_MANIFEST.json");
  if (preErrors.length) throw Object.assign(new Error(`PRE_MOVE_INVENTORY_MISMATCH:${preErrors.join(",")}`), { code: "PRE_MOVE_INVENTORY_MISMATCH" });
  fs.mkdirSync(archiveRoot, { recursive: true });
  const moved = [];
  try {
    items.forEach((item) => {
      const source = assertContained(sourceRoot, path.join(sourceRoot, item.name), "ARCHIVE_SOURCE_BOUNDARY_INVALID");
      const destination = assertContained(archiveRoot, path.join(archiveRoot, item.name), "ARCHIVE_DESTINATION_BOUNDARY_INVALID");
      if (fs.existsSync(destination)) throw Object.assign(new Error(`ARCHIVE_DESTINATION_EXISTS:${item.name}`), { code: "ARCHIVE_DESTINATION_EXISTS" });
      fs.renameSync(source, destination);
      moved.push({ source, destination });
    });
    if (typeof input.afterMove === "function") input.afterMove({ sourceRoot, archiveRoot, items });
    const postErrors = items.filter((item) => {
      try {
        const actual = collectInventory(path.join(archiveRoot, item.name));
        return actual.fileCount !== Number(item.fileCount) || actual.byteCount !== Number(item.byteCount) || actual.inventoryDigest !== item.inventoryDigest;
      } catch (_) { return true; }
    });
    if (postErrors.length) throw Object.assign(new Error(`POST_MOVE_INVENTORY_MISMATCH:${postErrors.map((item) => item.name).join(",")}`), { code: "POST_MOVE_INVENTORY_MISMATCH" });
    const manifest = Object.assign({}, plan, { schema: ARCHIVE_MANIFEST_SCHEMA, createdAt: new Date().toISOString(), moveMethod: "same-volume rename per exact reviewed root; no deletion" });
    delete manifest.reviewedAt;
    fs.writeFileSync(path.join(archiveRoot, "ARCHIVE_MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    return { pass: true, moved: moved.length, manifest };
  } catch (error) {
    moved.slice().reverse().forEach((entry) => {
      try { if (fs.existsSync(entry.destination) && !fs.existsSync(entry.source)) fs.renameSync(entry.destination, entry.source); } catch (_) {}
    });
    throw error;
  }
}

module.exports = {
  LEDGER_SCHEMA,
  AUDIT_SCHEMA,
  PLAN_SCHEMA,
  ARCHIVE_MANIFEST_SCHEMA,
  sha256File,
  collectInventory,
  manifestSummary,
  validateLedger,
  sealAudit,
  validateAuditReceipt,
  resolveManifest,
  auditArchive,
  evaluate,
  moveVerifiedIntakes,
};
