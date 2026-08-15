'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Browser = require('./code-clone-web-browser-organ');
const Executor = require('./code-clone-vm-executor-organ');
const Transfer = require('./code-clone-ivan-transfer-packager-organ');

const ORGAN_ID = 'axm.mirror.organ/code-clone-ivan-linux-preflight-v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-ivan-linux-preflight-receipt/v1';
const SHARED_FILESYSTEMS = new Set(['9p', 'virtiofs', 'vboxsf', 'fuse.vmhgfs-fuse', 'fuse.sshfs', 'drvfs', 'cifs', 'smb3', 'nfs', 'nfs4']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }

function authority() {
  return { writesPerformed: false, markerCreated: false, executionActivated: false, snapshotProved: false, evidenceAdmission: false, canonChange: false };
}

function decodeMountField(value) {
  return String(value || '').replace(/\\040/g, ' ').replace(/\\011/g, '\t').replace(/\\012/g, '\n').replace(/\\134/g, '\\');
}

function parseMountInfo(text) {
  const rows = [];
  for (const line of String(text || '').split(/\r?\n/).filter(Boolean)) {
    const fields = line.split(' ');
    const separator = fields.indexOf('-');
    if (separator < 6 || fields.length < separator + 4) continue;
    rows.push(stable({
      mountId: fields[0],
      parentId: fields[1],
      majorMinor: fields[2],
      root: decodeMountField(fields[3]),
      mountPoint: decodeMountField(fields[4]),
      mountOptions: fields[5].split(',').filter(Boolean),
      optionalFields: fields.slice(6, separator),
      filesystem: fields[separator + 1],
      source: decodeMountField(fields[separator + 2]),
      superOptions: fields.slice(separator + 3).join(' ').split(',').filter(Boolean)
    }));
  }
  return rows.sort((left, right) => right.mountPoint.length - left.mountPoint.length || left.mountPoint.localeCompare(right.mountPoint));
}

function mountFor(target, mounts) {
  const absolute = path.posix.normalize(target);
  return mounts.find(item => absolute === item.mountPoint || absolute.startsWith(item.mountPoint === '/' ? '/' : `${item.mountPoint}/`)) || null;
}

function readText(file, maximum = 1024 * 1024) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) return null;
    return fs.readFileSync(file, 'utf8').trim();
  } catch { return null; }
}

function rootObservation(name, root, mounts) {
  let state = 'MISSING';
  let realPath = null;
  let writable = null;
  try {
    const stat = fs.lstatSync(root);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      state = 'PRESENT';
      realPath = fs.realpathSync(root);
      try { fs.accessSync(root, fs.constants.W_OK); writable = true; } catch { writable = false; }
    } else state = stat.isSymbolicLink() ? 'SYMLINK_REFUSED' : 'NOT_DIRECTORY';
  } catch {}
  const mount = mountFor(root, mounts);
  const mountWritable = mount ? mount.mountOptions.includes('rw') : null;
  const potentialHostShare = Boolean(mount && SHARED_FILESYSTEMS.has(String(mount.filesystem).toLowerCase()));
  return stable({ name, path: root, state, realPath, writable, mount: mount ? { mountPoint: mount.mountPoint, filesystem: mount.filesystem, source: mount.source, writable: mountWritable, potentialHostShare } : null });
}

function cgroupObservation() {
  const controllers = readText('/sys/fs/cgroup/cgroup.controllers');
  return stable({
    version: controllers == null ? 'UNKNOWN_OR_V1' : 'V2',
    controllers: controllers == null ? [] : controllers.split(/\s+/).filter(Boolean).sort(),
    cpuMax: readText('/sys/fs/cgroup/cpu.max'),
    memoryMax: readText('/sys/fs/cgroup/memory.max'),
    pidsMax: readText('/sys/fs/cgroup/pids.max'),
    machineEnforcementProved: false
  });
}

function executableVersion(executable, args = ['--version']) {
  const result = spawnSync(executable, args, { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  return stable({ executable, state: result.status === 0 ? 'AVAILABLE' : 'UNAVAILABLE', exitCode: result.status, version: String(result.stdout || result.stderr || '').trim().slice(0, 500) || null });
}

function gate(id, state, statement, evidence = null) { return stable({ id, state, statement, evidence }); }

function finalize(base) { return stable({ ...base, receiptDigest: sha256(stable(base)) }); }

function verifyReceipt(receipt) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || !/^[a-f0-9]{64}$/.test(String(receipt.receiptDigest || ''))) throw new Error('Linux preflight receipt is invalid');
  const base = { ...receipt };
  delete base.receiptDigest;
  if (sha256(stable(base)) !== receipt.receiptDigest) throw new Error('Linux preflight receipt digest changed');
  if (canonical(receipt.authority) !== canonical(authority())) throw new Error('Linux preflight authority changed');
  return true;
}

function inspect(options = {}) {
  const platform = options.platform || process.platform;
  const bundleRoot = path.resolve(options.bundleRoot || path.join(__dirname, '..'));
  const markerPath = path.resolve(String(options.markerPath || process.env.AXM_CODE_CLONE_VM_MARKER || Executor.DEFAULT_MARKER_PATH));
  let bundle;
  try {
    const verifier = options.bundleVerifier || Transfer.verifyBundle;
    bundle = { state: 'PASS', root: bundleRoot, verification: verifier(bundleRoot) };
  } catch (error) { bundle = { state: 'FAIL', root: bundleRoot, code: error.code || 'BUNDLE_VERIFY', reason: error.message }; }

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const host = stable({ platform, architecture: process.arch, node: process.version, nodeMajor, hostnameSha256: sha256(os.hostname()), logicalCpuCount: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), uptimeSeconds: Math.floor(os.uptime()), tar: executableVersion(options.tarExecutable || 'tar') });
  const activationProbe = Executor.probeActivation({ platform, markerPath, enableToken: options.enableToken == null ? process.env.AXM_CODE_CLONE_VM_ENABLE : options.enableToken });
  const activation = stable({ state: activationProbe.state, code: activationProbe.code, markerPath, markerSha256: activationProbe.markerSha256 || null, boundaryEvidence: activationProbe.boundaryEvidence || null, marker: activationProbe.marker || null, reason: activationProbe.reason || null });
  const mountText = platform === 'linux' ? readText('/proc/self/mountinfo', 16 * 1024 * 1024) : null;
  const mounts = mountText == null ? [] : parseMountInfo(mountText);
  const roots = activationProbe.marker ? Object.entries(activationProbe.marker.roots).filter(([, value]) => value != null).map(([name, value]) => rootObservation(name, value, mounts)) : [];
  const resources = stable({ cgroup: platform === 'linux' ? cgroupObservation() : { version: 'UNAVAILABLE_NON_LINUX', controllers: [], cpuMax: null, memoryMax: null, pidsMax: null, machineEnforcementProved: false }, mountInfoAvailable: mountText != null });
  const browser = Browser.discoverBrowser(options.browserExecutable || null);

  const rootFailures = roots.filter(item => item.state !== 'PRESENT');
  const hostShareRisks = roots.filter(item => item.name !== 'externalEvidenceSink' && item.mount && item.mount.potentialHostShare && item.mount.writable);
  const gates = [
    gate('linux-guest', platform === 'linux' ? 'PASS' : 'FAIL', platform === 'linux' ? 'Process is running on Linux.' : 'Preflight must run inside Ivan\'s Linux guest.', { platform }),
    gate('transfer-bundle', bundle.state === 'PASS' ? 'PASS' : 'FAIL', bundle.state === 'PASS' ? 'Full transfer manifest and every file digest verified.' : 'Transfer bundle verification failed.', bundle),
    gate('node-runtime', nodeMajor >= 20 && nodeMajor < 25 ? 'PASS' : 'FAIL', nodeMajor >= 20 && nodeMajor < 25 ? 'Node runtime matches the packaged Workshop range.' : 'Node 20 through 24 is required by the packaged Workshop profile.', { version: process.version, requiredRange: '>=20 <25' }),
    gate('activation-marker-and-latch', activation.state === 'ACTIVE' ? 'PASS' : 'HOLD', activation.state === 'ACTIVE' ? 'Marker and exact execution latch are active.' : 'General execution remains inactive.', { code: activation.code, markerSha256: activation.markerSha256 }),
    gate('declared-roots', activationProbe.marker && !rootFailures.length ? 'PASS' : activationProbe.marker ? 'FAIL' : 'HOLD', activationProbe.marker ? rootFailures.length ? 'One or more declared roots are missing or not real directories.' : 'Every declared root is a real directory.' : 'No valid activation marker is available.', { roots: roots.map(item => ({ name: item.name, state: item.state })) }),
    gate('writable-host-share-scan', !mounts.length ? 'UNKNOWN' : hostShareRisks.length ? 'FAIL' : 'PASS', !mounts.length ? 'Linux mount information was unavailable.' : hostShareRisks.length ? 'A writable clone root appears to use a known host-sharing filesystem.' : 'No declared clone root matched the known host-sharing filesystem set.', { findings: hostShareRisks.map(item => ({ name: item.name, filesystem: item.mount.filesystem, mountPoint: item.mount.mountPoint })) }),
    gate('browser-binary', browser.state === 'AVAILABLE' ? 'PASS' : 'HOLD', browser.state === 'AVAILABLE' ? 'A Chromium-class browser executable was discovered.' : 'No Chromium-class browser executable was discovered.', browser),
    gate('external-hard-resource-governor', resources.cgroup.version === 'V2' && resources.cgroup.cpuMax && resources.cgroup.memoryMax && resources.cgroup.pidsMax ? 'UNKNOWN' : 'HOLD', 'Guest-side observation can see limits but cannot prove Ivan configured or tested the external governor.', resources.cgroup),
    gate('snapshot-reset', activationProbe.marker && activationProbe.marker.vmBoundary.snapshotResetAvailable ? 'UNKNOWN' : 'HOLD', 'Snapshot/reset availability must be demonstrated from the hypervisor side; the guest cannot prove it.', null),
    gate('external-evidence-continuity', activationProbe.marker && activationProbe.marker.roots.externalEvidenceSink && roots.some(item => item.name === 'externalEvidenceSink' && item.state === 'PRESENT') ? 'UNKNOWN' : 'HOLD', 'A path can be observed, but append-only behavior and survival across reset require an external exam.', null)
  ];
  const hardFail = gates.some(item => item.state === 'FAIL');
  const held = gates.some(item => item.state === 'HOLD');
  const state = hardFail ? 'FAILED' : held ? 'HELD' : 'READY_FOR_LIVE_EXAMS';
  const next = gates.filter(item => item.state !== 'PASS').map(item => `${item.id}: ${item.statement}`);
  const receipt = finalize({
    schema: RECEIPT_SCHEMA,
    recordedAt: new Date().toISOString(),
    state,
    bundle,
    host,
    activation,
    roots,
    resources,
    browser,
    gates,
    next,
    authority: authority(),
    boundary: 'This is a read-only guest preflight. It does not create the activation marker, enable execution, prove hypervisor containment or snapshot reset, enforce resource limits, certify the browser network path, admit evidence, or accept CANON.'
  });
  verifyReceipt(receipt);
  return receipt;
}

module.exports = { ORGAN_ID, RECEIPT_SCHEMA, SHARED_FILESYSTEMS, stable, canonical, sha256, authority, decodeMountField, parseMountInfo, mountFor, rootObservation, cgroupObservation, verifyReceipt, inspect };
