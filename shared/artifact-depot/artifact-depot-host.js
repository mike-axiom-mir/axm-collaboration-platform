'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./artifact-depot-core');

function depotPath(root, digest) {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Core.ArtifactError('INVALID_ARTIFACT_DIGEST', 'Artifact digest must be SHA-256 hex');
  return path.join(path.resolve(root), 'sha256', digest.slice(0, 2), digest);
}

function put(root, bytes, options) {
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const ref = Core.artifactRef(bytes, options);
  const target = depotPath(root, ref.digest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    Core.verifyRef(ref, fs.readFileSync(target));
    return { state: 'EXISTS_VERIFIED', ref, path: target };
  }
  const temporary = path.join(path.dirname(target), `.${ref.digest}.partial-${process.pid}`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx');
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, target);
  } catch (error) {
    if (descriptor != null) fs.closeSync(descriptor);
    throw new Core.ArtifactError('ARTIFACT_WRITE_FAILED', `Atomic artifact write failed: ${error.message}`, { temporary, target });
  }
  Core.verifyRef(ref, fs.readFileSync(target));
  return { state: 'STORED_VERIFIED', ref, path: target };
}

function get(root, ref) {
  const target = depotPath(root, ref.digest);
  if (!fs.existsSync(target)) throw new Core.ArtifactError('ARTIFACT_NOT_FOUND', `Artifact ${ref.digest} is absent`);
  const bytes = fs.readFileSync(target);
  Core.verifyRef(ref, bytes);
  return bytes;
}

function list(root) {
  const base = path.join(path.resolve(root), 'sha256');
  if (!fs.existsSync(base)) return [];
  const rows = [];
  for (const prefix of fs.readdirSync(base).sort()) {
    const folder = path.join(base, prefix);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const name of fs.readdirSync(folder).sort()) {
      if (/^[a-f0-9]{64}$/.test(name) && fs.statSync(path.join(folder, name)).isFile()) rows.push(name);
    }
  }
  return rows;
}

function putLease(root, input) {
  const value = Core.lease(input);
  if (!/^[A-Za-z0-9._-]+$/.test(value.id)) throw new Core.ArtifactError('INVALID_LEASE_ID', 'Lease id is not path safe');
  const target = path.join(path.resolve(root), 'leases', `${value.id}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const content = JSON.stringify(value, null, 2) + '\n';
  try { fs.writeFileSync(target, content, { flag: 'wx' }); }
  catch (error) { throw new Core.ArtifactError(error.code === 'EEXIST' ? 'LEASE_ALREADY_EXISTS' : 'LEASE_WRITE_FAILED', error.message); }
  return value;
}

module.exports = { depotPath, put, get, list, putLease };
