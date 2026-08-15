'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PublicInventory = require('../kernel/foundation-public-source-inventory-cell');
const PublicIntegrity = require('../kernel/foundation-public-body-integrity-cell');
const Archive = require('../modules/ai-organ-archive/core/organ-archive');
const Evidence = require('../modules/ai-organ-archive/core/organ-verification-evidence');

const ORGAN_ID = 'axm.mirror.organ/ai-organ-verification-v1';
const RESULT_SCHEMA = 'axm.mirror.ai-organ-verification-result/v1';
const MAX_DURATION_MS = 10 * 60 * 1000;

function forward(value) { return String(value).replace(/\\/g, '/'); }
function byteDigest(file) { return Evidence.digest(fs.readFileSync(file)); }

function exactOrganPath(value) {
  const logical = forward(value || '');
  if (!/^organs\/[^/]+-organ\.js$/.test(logical)) throw new Error('organ verification requires one exact organs/*-organ.js path');
  return logical;
}

function resolveDirect(from, specifier, files) {
  if (!specifier.startsWith('.')) return null;
  const raw = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  if (raw === '..' || raw.startsWith('../') || raw.startsWith('/')) return null;
  return [raw, `${raw}.js`, `${raw}.cjs`, `${raw}.mjs`, `${raw}/index.js`, `${raw}/index.cjs`, `${raw}/index.mjs`].find(candidate => files.has(candidate)) || null;
}

function directTestWitnesses(root, inventory, organPath) {
  const files = new Set(inventory.files.map(item => item.path));
  const records = new Map(inventory.files.map(item => [item.path, item]));
  const witnesses = [];
  for (const testPath of Array.from(files).filter(item => /^tests\/[^/]+\.test\.(?:c?js|mjs)$/.test(item)).sort()) {
    const file = Evidence.boundedFile(root, testPath);
    const record = records.get(testPath);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== record.bytes || Evidence.digest(bytes) !== record.sha256) throw new Error(`organ verification test changed after public inventory: ${testPath}`);
    const dependencies = PublicIntegrity.staticRequires(bytes.toString('utf8')).map(specifier => resolveDirect(testPath, specifier, files));
    if (dependencies.includes(organPath)) witnesses.push({ path: testPath, sha256: record.sha256 });
  }
  if (witnesses.length > Evidence.MAX_TEST_WITNESSES) throw new Error(`organ verification has more than ${Evidence.MAX_TEST_WITNESSES} direct test witnesses`);
  return witnesses;
}

function safeEnvironment() {
  const output = { NODE_ENV: 'test' };
  for (const name of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'ComSpec']) {
    if (process.env[name] !== undefined) output[name] = process.env[name];
  }
  return output;
}

function tapNumber(output, label) {
  const expression = new RegExp(`^[^\\r\\n]*[ℹ#]\\s*${label}\\s+(\\d+)\\s*$`, 'gmi');
  const rows = Array.from(String(output).replace(/\u001b\[[0-9;]*m/g, '').matchAll(expression));
  return rows.length ? Number(rows[rows.length - 1][1]) : null;
}

function assertions(output) {
  return {
    tests: tapNumber(output, 'tests'),
    passed: tapNumber(output, 'pass'),
    failed: tapNumber(output, 'fail'),
    skipped: tapNumber(output, 'skipped')
  };
}

function runProcess(root, witnesses, timeoutMs) {
  const command = [process.execPath, '--test', '--test-concurrency=1', ...witnesses.map(item => item.path)];
  const started = Date.now();
  const child = spawnSync(command[0], command.slice(1), {
    cwd: root,
    env: safeEnvironment(),
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: timeoutMs,
    maxBuffer: Math.floor(Evidence.MAX_OUTPUT_BYTES / 2)
  });
  const durationMs = Date.now() - started;
  const output = Buffer.from(`--- STDOUT ---\n${child.stdout || ''}\n--- STDERR ---\n${child.stderr || ''}`, 'utf8');
  const summary = assertions(output.toString('utf8'));
  const unavailable = !!child.error || output.length > Evidence.MAX_OUTPUT_BYTES || summary.tests === null;
  let state = 'FAIL_EXACT_CURRENT_TEST_PROCESS';
  if (unavailable) state = 'HOLD_TEST_PROCESS_UNAVAILABLE';
  else if (child.status === 0 && summary.tests > 0 && summary.failed === 0 && summary.passed + summary.skipped === summary.tests) state = 'PASS_EXACT_CURRENT_TEST_PROCESS';
  return {
    output: output.length <= Evidence.MAX_OUTPUT_BYTES ? output : Buffer.from(String(child.error && child.error.message || 'test output exceeded hard limit'), 'utf8'),
    execution: {
      processStarted: true,
      executionTrigger: 'EXPLICIT_LOCAL_STEWARD_CALL',
      command: command.map((item, index) => index === 0 ? path.basename(item) : item),
      exitCode: Number.isInteger(child.status) ? child.status : null,
      signal: child.signal || null,
      timedOut: !!(child.error && child.error.code === 'ETIMEDOUT'),
      durationMs,
      outputFile: null,
      outputSha256: null,
      outputBytes: null,
      sandboxed: false,
      inheritedSecretEnvironment: false,
      externalNetworkBlockedByOrgan: false
    },
    result: { state, assertions: summary, testsExecuted: summary.tests || 0 }
  };
}

function noProcess(state) {
  return {
    output: Buffer.alloc(0),
    execution: {
      processStarted: false,
      executionTrigger: 'EXPLICIT_LOCAL_STEWARD_CALL',
      command: [],
      exitCode: null,
      signal: null,
      timedOut: false,
      durationMs: 0,
      outputFile: null,
      outputSha256: null,
      outputBytes: null,
      sandboxed: false,
      inheritedSecretEnvironment: false,
      externalNetworkBlockedByOrgan: false
    },
    result: { state, assertions: { tests: null, passed: null, failed: null, skipped: null }, testsExecuted: 0 }
  };
}

function verifyOrgan(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const archiveRoot = path.resolve(options.archiveRoot || Archive.DEFAULT_ARCHIVE_ROOT);
  const organPath = exactOrganPath(options.organPath);
  const organFile = Evidence.boundedFile(root, organPath);
  const sourceSha256 = byteDigest(organFile);
  const initialArchive = Archive.scanAndArchive({ sourceRoot: path.join(root, 'organs'), archiveRoot, repositoryRoot: root, at: options.recordedAt });
  const archived = initialArchive.results.find(item => item.sourcePath === organPath);
  if (!archived) throw new Error('organ verification could not bind the source to the archive');

  const inventory = PublicInventory.collect(root);
  const integrity = PublicIntegrity.inspect(root, inventory);
  const witnesses = directTestWitnesses(root, inventory, organPath);
  const timeoutMs = Math.max(1000, Math.min(MAX_DURATION_MS, Number(options.timeoutMs) || MAX_DURATION_MS));
  let processResult;
  if (!witnesses.length) processResult = noProcess('HOLD_NO_DIRECT_TEST_WITNESS');
  else if (integrity.state !== PublicIntegrity.PASS_STATE) processResult = noProcess('HOLD_PUBLIC_BODY_INTEGRITY');
  else processResult = runProcess(root, witnesses, timeoutMs);

  const rawReceipt = {
    schema: Evidence.RECEIPT_SCHEMA,
    status: 'TEST',
    receiptId: null,
    receiptDigest: null,
    recordedAt: String(options.recordedAt || new Date().toISOString()),
    organ: { path: organPath, sha256: sourceSha256, archiveObjectId: archived.archiveObjectId },
    testWitnesses: witnesses,
    publicBody: { inventoryDigest: inventory.digest, integrityDigest: integrity.digest, integrityState: integrity.state },
    execution: processResult.execution,
    result: processResult.result,
    authority: {
      automaticExecution: false,
      runtimeAdmission: false,
      compatibilityDecision: false,
      behaviorConclusion: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This explicit organ runs exact direct public Node test witnesses in a separate unsandboxed local process with a reduced environment, then seals the output. PASS means only that those exact current source and test bytes passed this process. Test code still has the local user permissions of its process. No compatibility, universal behavior, safety, admission, promotion, CANON, or world-action conclusion follows.'
  };
  const stored = Evidence.storeReceipt(archiveRoot, rawReceipt, processResult.output);
  const refreshed = Archive.scanAndArchive({ sourceRoot: path.join(root, 'organs'), archiveRoot, repositoryRoot: root });
  return {
    schema: RESULT_SCHEMA,
    status: 'TEST',
    state: stored.receipt.result.state,
    organ: stored.receipt.organ,
    testWitnesses: stored.receipt.testWitnesses,
    assertions: stored.receipt.result.assertions,
    receiptId: stored.receipt.receiptId,
    receiptReused: stored.reused,
    catalogDigest: refreshed.catalogDigest,
    automaticExecution: false,
    runtimeAdmissions: 0,
    compatibilityDecisions: 0,
    behaviorConclusions: 0,
    promotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
}

module.exports = { ORGAN_ID, RESULT_SCHEMA, MAX_DURATION_MS, exactOrganPath, directTestWitnesses, assertions, verifyOrgan };
