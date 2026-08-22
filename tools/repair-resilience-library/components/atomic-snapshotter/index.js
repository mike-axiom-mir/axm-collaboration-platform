"use strict";

const fs = require("fs");
const path = require("path");
const { sha256, iso, stableStringify } = require("../common");

function createAtomicSnapshot(root, state, metadata = {}) {
  fs.mkdirSync(root, { recursive: true });

  const stateDigest = sha256(state);
  const identity = {
    schema: "axm.atomic-snapshot.identity/v1",
    stateDigest,
    metadata
  };
  const snapshotId = sha256(identity);
  const finalPath = path.join(root, `${snapshotId}.json`);
  const existed = fs.existsSync(finalPath);

  if (!existed) {
    const record = {
      schema: "axm.atomic-snapshot/v1",
      snapshotId,
      digest: snapshotId,
      createdAt: iso(),
      stateDigest,
      state,
      metadata
    };
    const tempPath = path.join(root, `.${snapshotId}.${process.pid}.tmp`);
    fs.writeFileSync(tempPath, stableStringify(record));
    fs.renameSync(tempPath, finalPath);
  }

  const snapshot = JSON.parse(fs.readFileSync(finalPath, "utf8"));
  return {
    snapshot,
    path: finalPath,
    deduplicated: existed,
    restoreAuthorized: false
  };
}

module.exports = { createAtomicSnapshot };
