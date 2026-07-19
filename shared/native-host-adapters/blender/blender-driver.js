'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function versionTuple(value) {
  const match = /^(\d+)(?:\.(\d+))?/.exec(String(value || ''));
  return match ? [Number(match[1]), Number(match[2] || 0)] : null;
}

function compare(left, right) {
  return left[0] - right[0] || left[1] - right[1];
}

function boundedOutput(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(-4000);
}

function sha256File(filename) {
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(filename, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytes = 0;
    do {
      bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytes) digest.update(buffer.subarray(0, bytes));
    } while (bytes);
  } finally {
    fs.closeSync(descriptor);
  }
  return digest.digest('hex');
}

class BlenderDriver {
  constructor(options) {
    options = options || {};
    this.executable = path.resolve(options.executable || '');
    this.entrypoint = path.resolve(options.entrypoint || '');
    this.minimumVersion = versionTuple(options.minimumVersion || '4.2');
    this.maximumVersion = versionTuple(options.maximumVersionExclusive || '5.0');
    this.runner = options.runner || childProcess.spawnSync;
    if (!fs.existsSync(this.executable)) throw new Error('configured Blender executable does not exist');
    if (!fs.existsSync(this.entrypoint)) throw new Error('configured Blender adapter entrypoint does not exist');
    this.executableSha256 = sha256File(this.executable);
    this.executableDigestVerified = false;
    if (options.executableSha256) {
      if (this.executableSha256 !== String(options.executableSha256).toLowerCase()) throw new Error('configured Blender executable digest mismatch');
      this.executableDigestVerified = true;
    }
  }

  invoke(mode, input) {
    const projectExists = fs.existsSync(input.project_file);
    const args = [];
    if (mode === 'inspect' || projectExists) args.push(input.project_file);
    else args.push('--factory-startup');
    args.push('--background', '--python', this.entrypoint, '--', '--mode', mode, '--request', input.request_file, '--receipt', input.receipt_file);
    const result = this.runner(this.executable, args, {
      windowsHide: true,
      encoding: 'utf8',
      timeout: input.timeout_ms || 120000,
      maxBuffer: 4 * 1024 * 1024,
      env: Object.assign({}, process.env, { PYTHONNOUSERSITE: '1' })
    });
    if (result.error) throw new Error('Blender process failed: ' + result.error.message);
    if (result.status !== 0) throw new Error('Blender adapter exited ' + result.status + ': ' + boundedOutput(result.stderr));
    if (!fs.existsSync(input.receipt_file)) throw new Error('Blender adapter did not emit its bounded receipt');
    let receipt;
    try { receipt = JSON.parse(fs.readFileSync(input.receipt_file, 'utf8')); }
    catch (error) { throw new Error('Blender adapter receipt is invalid JSON'); }
    const parsed = versionTuple(receipt.blender_version);
    if (!parsed || compare(parsed, this.minimumVersion) < 0 || compare(parsed, this.maximumVersion) >= 0) throw new Error('running Blender version is outside the signed adapter package range');
    if (!receipt.ok) throw new Error('Blender adapter reported an unsuccessful ' + mode);
    receipt.host_executable_digest = this.executableSha256;
    receipt.host_executable_digest_verified = this.executableDigestVerified;
    return receipt;
  }

  apply(input) {
    return this.invoke('apply', input);
  }

  inspect(input) {
    return this.invoke('inspect', input);
  }
}

module.exports = { BlenderDriver, versionTuple, compare, sha256File };
