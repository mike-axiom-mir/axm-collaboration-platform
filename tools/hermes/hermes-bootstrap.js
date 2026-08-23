#!/usr/bin/env node
/* AXM Hermes Runtime Bootstrap v0.4

   Build hard, fail visibly, repair deterministically.

   Hermes stays external and pinned. AXM owns launch policy, credential guard,
   evidence capsules, Return Packets, and repair. This is not OS/network isolation.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const RuntimePolicy = require('./axm/runtime-policy');
const RunLedger = require('./axm/run-ledger');

const ROOT = __dirname;
const EXTERNAL = path.join(ROOT, 'external');
const HERMES_DIR = path.join(EXTERNAL, 'hermes-agent');
const SOURCE_LOCK = path.join(ROOT, 'hermes-source.lock.json');
const RUNTIME = path.join(ROOT, 'runtime');
const HERMES_HOME = path.join(RUNTIME, 'hermes-home');
const WORKSPACE = path.join(RUNTIME, 'workspace');
const RUNS_DIR = path.join(RUNTIME, 'runs');
const BACKUP_DIR = path.join(RUNTIME, 'backups');
const AUDIT_DIR = path.join(RUNTIME, 'audit');
const REPORT_DIR = path.join(ROOT, 'run-reports');
const POLICY_FILE = path.join(RUNTIME, 'policy.json');
const POLICY_EXAMPLE = path.join(ROOT, 'axm-policy.example.json');
const HERMES_CONFIG = path.join(HERMES_HOME, 'config.yaml');
const HERMES_ENV_FILE = path.join(HERMES_HOME, '.env');
const GATE = path.join(ROOT, 'axm', 'axm_gate.py');
const CONTEXT = path.join(ROOT, 'axm', 'axm_context.py');
const RECEIPT = path.join(ROOT, 'axm', 'axm_receipt.py');
const PROVIDER_RECEIPT = path.join(ROOT, 'axm', 'axm_provider_receipt.py');
const SESSION_EVENT = path.join(ROOT, 'axm', 'axm_session_event.py');
const MANAGED_BEGIN = '# BEGIN AXM MANAGED HERMES RUNTIME';
const MANAGED_END = '# END AXM MANAGED HERMES RUNTIME';

function exists(p) { try { fs.accessSync(p); return true; } catch (_) { return false; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } }
function writeJson(p, value) { fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function now() { return new Date().toISOString(); }
function shortHash(value) { return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16); }

function run(cmd, args, opts) {
  const options = Object.assign({ stdio: 'inherit', shell: false }, opts || {});
  const redactArgs = options.redactArgs === true;
  delete options.redactArgs;
  const display = redactArgs ? `[${args.length} argument(s) withheld from command display]` : args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ');
  console.log('> ' + cmd + (display ? ' ' + display : ''));
  return cp.spawnSync(cmd, args, options);
}
function capture(cmd, args, opts) { return cp.spawnSync(cmd, args, Object.assign({ encoding: 'utf8', shell: false }, opts || {})); }
function hasCommand(cmd) { return capture(cmd, ['--version']).status === 0; }
function pythonCommand() {
  if (process.env.AXM_HERMES_PYTHON) return process.env.AXM_HERMES_PYTHON;
  if (hasCommand('python')) return 'python';
  if (hasCommand('python3')) return 'python3';
  return null;
}

function sourceLock() {
  const lock = readJson(SOURCE_LOCK);
  if (!lock || lock.schema !== 'axm.hermes-source-lock/v1' || !lock.repo_url ||
      !/^[0-9a-f]{40}$/i.test(lock.commit || '') || !/^[0-9a-f]{40}$/i.test(lock.tree || '') || !lock.observed_version) {
    throw new Error('Invalid hermes-source.lock.json; repository, commit, tree and version are required.');
  }
  return lock;
}
function normalizeRemote(value) { return String(value || '').trim().replace(/\.git$/i, '').replace(/\/$/, '').toLowerCase(); }
function gitValue(args) { const r = capture('git', args, { cwd: HERMES_DIR }); return r.status === 0 ? String(r.stdout || '').trim() : null; }
function observedHermesVersion() {
  try {
    const text = fs.readFileSync(path.join(HERMES_DIR, 'pyproject.toml'), 'utf8');
    const match = text.match(/^version\s*=\s*["']([^"']+)["']/m);
    return match ? match[1] : null;
  } catch (_) { return null; }
}
function verifyPinnedSource(verbose) {
  if (!exists(path.join(HERMES_DIR, '.git'))) return { ok: false, reason: 'Hermes clone missing' };
  const lock = sourceLock();
  const head = gitValue(['rev-parse', 'HEAD']);
  const tree = gitValue(['rev-parse', 'HEAD^{tree}']);
  const remote = gitValue(['remote', 'get-url', 'origin']);
  const clean = gitValue(['status', '--porcelain']);
  const version = observedHermesVersion();
  const ok = head === lock.commit && tree === lock.tree && normalizeRemote(remote) === normalizeRemote(lock.repo_url) && clean === '' && version === lock.observed_version;
  if (verbose) {
    console.log('source origin:  ' + (remote || 'UNKNOWN'));
    console.log('source HEAD:    ' + (head || 'UNKNOWN'));
    console.log('source tree:    ' + (tree || 'UNKNOWN'));
    console.log('source version: ' + (version || 'UNKNOWN'));
    console.log('expected HEAD:  ' + lock.commit);
    console.log('expected tree:  ' + lock.tree);
    console.log('worktree:       ' + (clean === '' ? 'clean' : 'modified/unknown'));
  }
  return { ok, reason: ok ? 'verified immutable commit+tree+version' : 'source verification failed', head, tree, remote, clean, version };
}

function loadPolicy() {
  const policy = readJson(POLICY_FILE);
  if (!policy) throw new Error('Missing or invalid runtime/policy.json. Run prepare.');
  const result = RuntimePolicy.validatePolicy(policy);
  if (!result.ok) throw new Error('Invalid AXM Hermes policy: ' + result.errors.join('; '));
  return policy;
}
function policyForSetup() {
  const policy = readJson(POLICY_FILE) || readJson(POLICY_EXAMPLE);
  const result = RuntimePolicy.validatePolicy(policy);
  if (!result.ok) throw new Error('Invalid AXM Hermes policy/example: ' + result.errors.join('; '));
  return policy;
}

function quoteCommandPart(value) {
  const text = String(value);
  if (process.platform === 'win32') return '"' + text.replace(/"/g, '""') + '"';
  return "'" + text.replace(/'/g, "'\\''") + "'";
}
function hookCommand(python, script) { return quoteCommandPart(python) + ' ' + quoteCommandPart(script); }
function managedBlock(python) {
  const scalar = value => JSON.stringify(value);
  const gate = hookCommand(python, GATE), context = hookCommand(python, CONTEXT), receipt = hookCommand(python, RECEIPT);
  const provider = hookCommand(python, PROVIDER_RECEIPT), session = hookCommand(python, SESSION_EVENT);
  return [
    MANAGED_BEGIN,
    '# Generated/repaired by AXM. User provider/model settings may live outside this block.',
    'hooks:',
    '  pre_tool_call:', `    - command: ${scalar(gate)}`, '      timeout: 8', '      fail_closed: true',
    '  pre_llm_call:', `    - command: ${scalar(context)}`, '      timeout: 5',
    '  post_tool_call:', `    - command: ${scalar(receipt)}`, '      timeout: 5',
    '  pre_api_request:', `    - command: ${scalar(provider)}`, '      timeout: 5',
    '  post_api_request:', `    - command: ${scalar(provider)}`, '      timeout: 5',
    '  api_request_error:', `    - command: ${scalar(provider)}`, '      timeout: 5',
    '  on_session_end:', `    - command: ${scalar(session)}`, '      timeout: 5',
    '  on_session_finalize:', `    - command: ${scalar(session)}`, '      timeout: 5',
    MANAGED_END
  ].join('\n');
}

function backupFile(file, label, keep) {
  if (!exists(file)) return null;
  ensureDir(BACKUP_DIR);
  const stamp = now().replace(/[^0-9]/g, '').slice(0, 14);
  const target = path.join(BACKUP_DIR, `${label}-${stamp}-${shortHash(fs.readFileSync(file))}${path.extname(file)}`);
  fs.copyFileSync(file, target);
  const files = fs.readdirSync(BACKUP_DIR).filter(name => name.startsWith(label + '-')).sort().reverse();
  files.slice(Math.max(1, keep || 5)).forEach(name => { try { fs.unlinkSync(path.join(BACKUP_DIR, name)); } catch (_) {} });
  return target;
}
function removeTopLevelYamlBlock(text, key) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex(line => new RegExp('^' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(?:#.*)?$').test(line));
  if (start < 0) return text;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^[A-Za-z0-9_.-]+\s*:/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(0, start).concat(lines.slice(end)).join('\n').replace(/^\s*\n/, '');
}
function mergeManagedConfig(current, block, force) {
  const start = current.indexOf(MANAGED_BEGIN), end = current.indexOf(MANAGED_END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    if (!force) throw new Error('AXM managed config markers are damaged. Run repair --force to back up and rebuild.');
    return block + '\n';
  }
  if (start >= 0) return current.slice(0, start) + block + current.slice(end + MANAGED_END.length);
  if (/^hooks\s*:/m.test(current)) {
    if (!force) throw new Error('Existing unmanaged hooks: block detected. Refusing duplicate YAML key; use repair --force after review.');
    const preserved = removeTopLevelYamlBlock(current, 'hooks');
    return block + (preserved.trim() ? '\n\n' + preserved.replace(/^\s+/, '') : '\n');
  }
  return block + (current.trim() ? '\n\n' + current.replace(/^\s+/, '') : '\n');
}

function prepare(force) {
  const py = pythonCommand();
  if (!py) throw new Error('Python 3 is required for AXM Hermes hooks.');
  [RUNTIME, HERMES_HOME, WORKSPACE, RUNS_DIR, BACKUP_DIR, AUDIT_DIR, REPORT_DIR].forEach(ensureDir);
  if (!exists(POLICY_EXAMPLE)) throw new Error('Missing axm-policy.example.json.');
  if (!exists(POLICY_FILE)) { fs.copyFileSync(POLICY_EXAMPLE, POLICY_FILE); console.log('Created local policy with consent OFF: ' + POLICY_FILE); }
  const policy = loadPolicy();
  const current = exists(HERMES_CONFIG) ? fs.readFileSync(HERMES_CONFIG, 'utf8') : '';
  const wanted = mergeManagedConfig(current, managedBlock(py), force);
  if (current !== wanted) {
    if (current && policy.repair && policy.repair.backup_before_managed_config_change !== false) console.log('Config backup: ' + backupFile(HERMES_CONFIG, 'hermes-config', policy.repair.retain_config_backups || 5));
    fs.writeFileSync(HERMES_CONFIG, wanted, 'utf8');
  }
  console.log('Prepared/repaired AXM Hermes home: ' + HERMES_HOME);
  console.log('Workspace: ' + WORKSPACE);
  console.log('Policy:    ' + POLICY_FILE);
}

function parseEnvSecretKeys(file) {
  if (!exists(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => line.split('=', 1)[0].trim()).filter(RuntimePolicy.isSecretKey);
}
function verifyHermesHomeCredentialPolicy(policy) {
  const keys = parseEnvSecretKeys(HERMES_ENV_FILE);
  if (!keys.length) return { ok: true, secret_keys: [] };
  const allowed = new Set((policy.provider_egress.allowed_secret_env || []).map(String));
  if (policy.provider_egress.mode === 'local_only') throw new Error('local_only provider posture refuses secret-bearing HERMES_HOME/.env; use process-local loopback credentials or explicit_remote policy. Keys: ' + keys.join(', '));
  const denied = keys.filter(key => !allowed.has(key));
  if (denied.length) throw new Error('HERMES_HOME/.env contains secret keys not allowlisted by provider_egress.allowed_secret_env: ' + denied.join(', '));
  return { ok: true, secret_keys: keys };
}
function guardedEnvironment(policy) {
  const guarded = RuntimePolicy.sanitizeEnvironment(process.env, policy);
  Object.assign(guarded.env, {
    HERMES_HOME, HERMES_ENABLE_PROJECT_PLUGINS: 'false', HERMES_YOLO_MODE: '',
    AXM_HERMES_ROOT: ROOT, AXM_HERMES_POLICY_FILE: POLICY_FILE, AXM_HERMES_WORKSPACE: WORKSPACE
  });
  return guarded;
}

function auditConsent(previous, next, reason) {
  ensureDir(AUDIT_DIR);
  fs.appendFileSync(path.join(AUDIT_DIR, 'consent-events.jsonl'), JSON.stringify({
    schema: 'axm.hermes-consent-event/v1', timestamp: now(), previous: Boolean(previous), next: Boolean(next),
    reason_sha256_16: shortHash(reason), raw_reason_stored_in_audit: false
  }) + '\n', 'utf8');
}
function setConsent(enabled, reason) {
  if (!exists(POLICY_FILE)) prepare(false);
  const policy = loadPolicy(), previous = policy.consent.enabled === true;
  const text = reason || (enabled ? 'explicit local CLI enable' : 'explicit local CLI disable');
  policy.consent = { enabled: Boolean(enabled), reason: text, changed_at: now() };
  writeJson(POLICY_FILE, policy); auditConsent(previous, enabled, text);
  console.log('AXM Hermes action consent: ' + (enabled ? 'ON' : 'OFF'));
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}
function incompleteRuns() {
  if (!exists(RUNS_DIR)) return [];
  return fs.readdirSync(RUNS_DIR).filter(name => exists(path.join(RUNS_DIR, name, 'run-manifest.json')) && !exists(path.join(RUNS_DIR, name, 'return-packet.json'))).sort();
}
function repairInterruptedRuns() {
  const lock = sourceLock(); let repaired = 0, skippedActive = 0;
  for (const runId of incompleteRuns()) {
    const runDir = path.join(RUNS_DIR, runId), manifest = readJson(path.join(runDir, 'run-manifest.json')) || {};
    if (pidAlive(manifest.launcher_pid)) { skippedActive += 1; continue; }
    RunLedger.finalizeRun({
      runId, runDir, receiptDir: path.join(runDir, 'receipts'), providerReceiptDir: path.join(runDir, 'provider-receipts'), sessionEventDir: path.join(runDir, 'session-events'),
      reportDir: REPORT_DIR, sourceLock: lock, policyFile: POLICY_FILE, configFile: HERMES_CONFIG,
      sourceVerified: manifest.source && manifest.source.verified_before_launch === true, sourceVerifiedAfter: false,
      exitCode: null, signal: 'recovered-after-incomplete-run', watchdogTimedOut: false
    });
    repaired += 1;
  }
  return { repaired, skippedActive };
}
function repair(force) {
  prepare(force);
  const source = verifyPinnedSource(false), policy = loadPolicy(), credentials = verifyHermesHomeCredentialPolicy(policy), recovery = repairInterruptedRuns();
  console.log('Repair report:');
  console.log('  source pin:       ' + (source.ok ? 'verified' : 'not verified / not installed'));
  console.log('  policy:           valid');
  console.log('  profile:          managed block reconciled');
  console.log('  credential guard: ok (' + credentials.secret_keys.length + ' approved .env secret keys)');
  console.log('  orphan runs:      ' + recovery.repaired + ' closed; ' + recovery.skippedActive + ' still have a live launcher PID');
}

function showDoctor() {
  let lock = null; try { lock = sourceLock(); } catch (_) {}
  const verification = exists(HERMES_DIR) && hasCommand('git') ? verifyPinnedSource(false) : { ok: false };
  const policy = readJson(POLICY_FILE), policyCheck = RuntimePolicy.validatePolicy(policy);
  let credentialStatus = 'not checked';
  if (policyCheck.ok) { try { verifyHermesHomeCredentialPolicy(policy); credentialStatus = 'ok'; } catch (e) { credentialStatus = 'REFUSED: ' + e.message; } }
  console.log('AXM Hermes Runtime doctor v0.4');
  console.log('git:               ' + (hasCommand('git') ? 'ok' : 'missing'));
  console.log('python:            ' + (pythonCommand() || 'missing'));
  console.log('node:              ' + (hasCommand('node') ? 'ok' : 'missing'));
  console.log('uv:                ' + (hasCommand('uv') ? 'ok' : 'missing (needed for deps/start)'));
  console.log('source lock:       ' + (lock ? lock.commit + ' / tree ' + lock.tree : 'invalid/missing'));
  console.log('Hermes checkout:   ' + (verification.ok ? 'PIN+TREE+VERSION VERIFIED' : (exists(HERMES_DIR) ? 'NOT VERIFIED' : 'missing')));
  console.log('policy:            ' + (policyCheck.ok ? 'valid' : 'invalid/missing: ' + policyCheck.errors.join('; ')));
  console.log('posture:           ' + (policy && policy.posture || 'UNKNOWN'));
  console.log('provider egress:   ' + (policy && policy.provider_egress && policy.provider_egress.mode || 'UNKNOWN'));
  console.log('run watchdog:      ' + (policy && policy.limits && policy.limits.max_run_minutes || 'UNKNOWN') + ' minute(s)');
  console.log('action consent:    ' + (policy && policy.consent && policy.consent.enabled === true ? 'ON' : 'OFF'));
  console.log('credential guard:  ' + credentialStatus);
  console.log('AXM profile:       ' + (exists(HERMES_CONFIG) ? 'prepared' : 'not prepared'));
  console.log('incomplete runs:   ' + incompleteRuns().length);
  console.log('workspace:         ' + WORKSPACE);
}

function installPinned() {
  if (!hasCommand('git')) throw new Error('Git is required.');
  const lock = sourceLock(); ensureDir(EXTERNAL);
  if (!exists(HERMES_DIR)) { const r = run('git', ['clone', '--no-checkout', lock.repo_url, HERMES_DIR]); if (r.status !== 0) throw new Error('Git clone failed with status ' + r.status); }
  if (normalizeRemote(gitValue(['remote', 'get-url', 'origin'])) !== normalizeRemote(lock.repo_url)) throw new Error('Existing Hermes origin differs from reviewed source lock. Refusing repoint.');
  if (gitValue(['status', '--porcelain']) !== '') throw new Error('Existing Hermes checkout has local changes. Refusing overwrite.');
  let r = run('git', ['fetch', '--depth', '1', 'origin', lock.commit], { cwd: HERMES_DIR }); if (r.status !== 0) throw new Error('Pinned fetch failed with status ' + r.status);
  r = run('git', ['checkout', '--detach', lock.commit], { cwd: HERMES_DIR }); if (r.status !== 0) throw new Error('Pinned checkout failed with status ' + r.status);
  if (!verifyPinnedSource(true).ok) throw new Error('Hermes commit/tree/version verification failed after checkout.');
  console.log('Pinned Hermes source installed and verified.');
}
function installDependencies() {
  if (!verifyPinnedSource(true).ok) throw new Error('Refusing deps until Hermes source verifies.');
  if (!hasCommand('uv')) throw new Error('uv is required for upstream locked dependency install.');
  const policy = policyForSetup(), guarded = RuntimePolicy.sanitizeEnvironment(process.env, policy);
  Object.assign(guarded.env, { HERMES_HOME, HERMES_ENABLE_PROJECT_PLUGINS: 'false', HERMES_YOLO_MODE: '' });
  const r = run('uv', ['sync', '--locked'], { cwd: HERMES_DIR, env: guarded.env });
  if (r.status !== 0) throw new Error('uv sync --locked failed with status ' + r.status);
}

function startHermes(extraArgs) {
  const source = verifyPinnedSource(true);
  if (!source.ok) throw new Error('Refusing start: Hermes source commit/tree/version not verified.');
  if (!exists(HERMES_CONFIG)) throw new Error('Runtime not prepared. Run prepare/repair.');
  if (!hasCommand('uv')) throw new Error('uv is required. Run explicit deps step first.');
  const policy = loadPolicy(); verifyHermesHomeCredentialPolicy(policy);
  const guarded = guardedEnvironment(policy), lock = sourceLock();
  const runContext = RunLedger.createRun({
    runtimeRoot: RUNTIME, sourceLock: lock, sourceVerified: true, policy, policyFile: POLICY_FILE,
    configFile: HERMES_CONFIG, args: extraArgs, environmentReport: guarded.report, launcherPid: process.pid
  });
  Object.assign(guarded.env, {
    AXM_HERMES_RUN_ID: runContext.runId, AXM_HERMES_RUN_DIR: runContext.runDir,
    AXM_HERMES_STATE_DIR: runContext.stateDir, AXM_HERMES_RECEIPT_DIR: runContext.receiptDir,
    AXM_HERMES_PROVIDER_RECEIPT_DIR: runContext.providerReceiptDir, AXM_HERMES_SESSION_EVENT_DIR: runContext.sessionEventDir
  });
  const maxRunMs = policy.limits.max_run_minutes * 60 * 1000;
  console.log('Run capsule:       ' + runContext.runId);
  console.log('AXM posture:       ' + policy.posture);
  console.log('Action consent:    ' + (policy.consent.enabled ? 'ON' : 'OFF'));
  console.log('Provider egress:   ' + policy.provider_egress.mode + ' (credential guard; not network isolation)');
  console.log('Run watchdog:      ' + policy.limits.max_run_minutes + ' minute(s)');
  console.log('Inherited secrets stripped from Hermes child: ' + guarded.report.inherited_secret_count);
  const result = run('uv', ['run', '--project', HERMES_DIR, 'hermes'].concat(extraArgs || []), {
    cwd: WORKSPACE,
    env: guarded.env,
    redactArgs: true,
    timeout: maxRunMs,
    killSignal: 'SIGTERM'
  });
  const watchdogTimedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');
  const sourceAfter = verifyPinnedSource(false);
  const packet = RunLedger.finalizeRun({
    runId: runContext.runId, runDir: runContext.runDir, receiptDir: runContext.receiptDir,
    providerReceiptDir: runContext.providerReceiptDir, sessionEventDir: runContext.sessionEventDir,
    reportDir: REPORT_DIR, sourceLock: lock, policyFile: POLICY_FILE, configFile: HERMES_CONFIG,
    sourceVerified: true, sourceVerifiedAfter: sourceAfter.ok, exitCode: result.status, signal: result.signal || null,
    watchdogTimedOut
  });
  console.log('Return Packet: ' + path.join(runContext.runDir, 'return-packet.json'));
  console.log('Outcome:       ' + packet.outcome);
  if (watchdogTimedOut) console.error('AXM WATCHDOG: Hermes exceeded max_run_minutes and the launcher terminated its direct child. Process-tree termination is not claimed.');
  if (!sourceAfter.ok) console.error('AXM WARNING: pinned Hermes checkout no longer verifies after run. Treat run as boundary failure.');
  if (packet.integrity_flags.provider_policy_mismatch) console.error('AXM WARNING: remote provider base URL observed under local_only policy. Treat run as boundary failure.');
  process.exitCode = Number.isInteger(result.status) ? result.status : 1;
}

const action = process.argv[2] || 'doctor';
const rest = process.argv.slice(3);
try {
  if (action === 'doctor') showDoctor();
  else if (action === 'install') installPinned();
  else if (action === 'verify') { if (!verifyPinnedSource(true).ok) process.exitCode = 1; }
  else if (action === 'deps') installDependencies();
  else if (action === 'prepare') prepare(rest.includes('--force'));
  else if (action === 'repair') repair(rest.includes('--force'));
  else if (action === 'consent') {
    if (!['on', 'off'].includes(rest[0])) throw new Error('Usage: consent on|off [reason]');
    setConsent(rest[0] === 'on', rest.slice(1).join(' '));
  } else if (action === 'start') startHermes(rest);
  else console.log('Usage: node hermes-bootstrap.js doctor|install|verify|deps|prepare [--force]|repair [--force]|consent on|off [reason]|start [hermes args...]');
} catch (error) {
  console.error('AXM Hermes bootstrap refused: ' + (error && error.message || error));
  process.exitCode = 1;
}
