'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const Codec = require('./canonical');

const SCHEMA = 'axm.hand-process-confinement-probe/v1';
const TEMP_PREFIX = 'AXM-GPR-Confinement-';

function clockFrom(options) { return typeof options.clock === 'function' ? options.clock : () => new Date().toISOString(); }

function cleanEnvironment() {
  const environment = Object.assign({}, process.env);
  for (const key of Object.keys(environment)) if (/^NODE_/i.test(key)) delete environment[key];
  return environment;
}

function permissionFlag() {
  const help = childProcess.spawnSync(process.execPath, ['--help'], { encoding: 'utf8', windowsHide: true, timeout: 5000, env: cleanEnvironment() });
  const output = String(help.stdout || '') + '\n' + String(help.stderr || '');
  if (/^\s*--permission\b/m.test(output)) return '--permission';
  if (/^\s*--experimental-permission\b/m.test(output)) return '--experimental-permission';
  return null;
}

function childSource(body) {
  return [
    "'use strict';",
    "function emit(outcome,error){process.stdout.write(JSON.stringify({outcome:outcome,error_code:error&&error.code||null,permission:error&&error.permission||null})+'\\n');}",
    body
  ].join('\n');
}

function parseChild(result) {
  const lines = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean);
  let observed = null;
  try { observed = lines.length ? JSON.parse(lines[lines.length - 1]) : null; } catch (_) { observed = null; }
  if (!observed || !['AVAILABLE', 'ALLOWED', 'DENIED', 'ERROR'].includes(observed.outcome)) observed = { outcome: 'ERROR', error_code: result.error && result.error.code || 'INVALID_PROBE_OUTPUT', permission: null };
  return {
    outcome: observed.outcome,
    error_code: observed.error_code || null,
    permission: observed.permission || null,
    exit_code: Number.isInteger(result.status) ? result.status : null,
    timed_out: !!(result.error && result.error.code === 'ETIMEDOUT')
  };
}

function runChild(flag, body) {
  if (!flag) return { outcome: 'ERROR', error_code: 'PERMISSION_FLAG_UNAVAILABLE', permission: null, exit_code: null, timed_out: false };
  const result = childProcess.spawnSync(process.execPath, [flag, '-e', childSource(body)], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 4000,
    env: cleanEnvironment()
  });
  return parseChild(result);
}

function check(id, expected, observed) {
  const known = ['AVAILABLE', 'ALLOWED', 'DENIED'].includes(observed.outcome);
  return { id, expected, observed, verdict: !known ? 'UNKNOWN' : observed.outcome === expected ? 'PASS' : 'FAIL' };
}

function safeCleanup(temporaryRoot) {
  const resolved = path.resolve(temporaryRoot);
  const base = path.resolve(os.tmpdir());
  if (!resolved.startsWith(base + path.sep) || !path.basename(resolved).startsWith(TEMP_PREFIX)) throw new Error('refused unsafe confinement probe cleanup');
  fs.rmSync(resolved, { recursive: true, force: true });
  return !fs.existsSync(resolved);
}

function networkProbe(flag) {
  return new Promise((resolve) => {
    if (!flag) { resolve({ observed: { outcome: 'ERROR', error_code: 'PERMISSION_FLAG_UNAVAILABLE', permission: null, exit_code: null, timed_out: false }, server_closed: true }); return; }
    const server = net.createServer((socket) => socket.destroy());
    let settled = false;
    function finish(observed) {
      if (settled) return;
      settled = true;
      if (!server.listening) { resolve({ observed, server_closed: true }); return; }
      server.close(() => resolve({ observed, server_closed: !server.listening }));
    }
    server.once('error', (error) => finish({ outcome: 'ERROR', error_code: error.code || 'LISTENER_ERROR', permission: null, exit_code: null, timed_out: false }));
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const body = [
        "const net=require('node:net');",
        "let finished=false; function done(outcome,error,code){if(finished)return;finished=true;emit(outcome,error);process.exitCode=code;}",
        "try{const socket=net.connect({host:'127.0.0.1',port:" + port + "});",
        "socket.once('connect',()=>{socket.destroy();done('ALLOWED',null,0);});",
        "socket.once('error',(error)=>done(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error,error&&error.code==='ERR_ACCESS_DENIED'?0:2));",
        "setTimeout(()=>{socket.destroy();done('ERROR',{code:'PROBE_TIMEOUT'},3);},1500);}",
        "catch(error){done(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error,error&&error.code==='ERR_ACCESS_DENIED'?0:2);}"
      ].join('\n');
      const result = childProcess.spawnSync(process.execPath, [flag, '-e', childSource(body)], { encoding: 'utf8', windowsHide: true, timeout: 4000, env: cleanEnvironment() });
      finish(parseChild(result));
    });
  });
}

function notProbed(reason, at) {
  return Codec.seal({
    schema: SCHEMA,
    status: 'NOT_PROBED',
    observed_at: at,
    reason,
    execution_authority: false,
    trusted_hand_activation: 'HOLD',
    untrusted_code_sandbox: false,
    installation_performed: false
  });
}

async function probe(options) {
  options = options || {};
  const clock = clockFrom(options);
  if (options.explicitProbe !== true) return notProbed('confinement substrate probe requires explicit opt-in', clock());
  const flag = permissionFlag();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  const readSentinel = path.join(temporaryRoot, 'read-sentinel.txt');
  const writeSentinel = path.join(temporaryRoot, 'write-sentinel.txt');
  fs.writeFileSync(readSentinel, 'AXM confinement probe sentinel\n', { flag: 'wx' });
  let network = { observed: { outcome: 'ERROR', error_code: 'NOT_RUN', permission: null, exit_code: null, timed_out: false }, server_closed: true };
  let temporaryRootRemoved = false;
  let checks;
  try {
    const permissionApi = runChild(flag, "emit(typeof process.permission==='object'?'AVAILABLE':'ERROR',typeof process.permission==='object'?null:{code:'PERMISSION_API_UNAVAILABLE'});");
    const filesystemRead = runChild(flag, "try{require('node:fs').readFileSync(" + JSON.stringify(readSentinel) + ");emit('ALLOWED');}catch(error){emit(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error);}");
    const filesystemWrite = runChild(flag, "try{require('node:fs').writeFileSync(" + JSON.stringify(writeSentinel) + ",'unexpected');emit('ALLOWED');}catch(error){emit(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error);}");
    const child = runChild(flag, "try{require('node:child_process').spawnSync(process.execPath,['--version']);emit('ALLOWED');}catch(error){emit(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error);}");
    const worker = runChild(flag, "try{const Worker=require('node:worker_threads').Worker;const value=new Worker('',{eval:true});value.terminate();emit('ALLOWED');}catch(error){emit(error&&error.code==='ERR_ACCESS_DENIED'?'DENIED':'ERROR',error);}");
    network = await networkProbe(flag);
    checks = [
      check('permission-api-available', 'AVAILABLE', permissionApi),
      check('filesystem-read-denied', 'DENIED', filesystemRead),
      check('filesystem-write-denied', 'DENIED', filesystemWrite),
      check('child-process-denied', 'DENIED', child),
      check('worker-thread-denied', 'DENIED', worker),
      check('loopback-network-denied', 'DENIED', network.observed)
    ];
  } finally {
    temporaryRootRemoved = safeCleanup(temporaryRoot);
  }
  const allPass = checks.every((item) => item.verdict === 'PASS');
  const permissionAvailable = checks[0].verdict === 'PASS';
  const status = allPass ? 'READY_WITH_LIMITS' : permissionAvailable ? 'DEGRADED' : 'UNAVAILABLE';
  return Codec.seal({
    schema: SCHEMA,
    status,
    observed_at: clock(),
    runtime: { node_version: process.versions.node, platform: process.platform, architecture: process.arch, permission_flag: flag },
    checks,
    cleanup: { temporary_root_removed: temporaryRootRemoved, loopback_server_closed: network.server_closed === true },
    activation: {
      trusted_hand_process: allPass ? 'ELIGIBLE_FOR_SEPARATE_EXPLICIT_GATE' : 'HOLD',
      untrusted_code: 'REFUSED',
      execution_authority: false
    },
    proof_scope: 'local Node permission behavior for accidental-capability containment only',
    limitations: [
      'Node permission mode is not a security boundary for malicious code.',
      'Only filesystem read/write, child process, worker thread, and loopback network behavior were exercised.',
      'No native addon, WASI, FFI, inspector, external-network, or OS-user isolation claim is made.'
    ],
    authority: { installed: false, promoted: false, canon: false, released: false }
  });
}

function inspect(options) {
  options = options || {};
  return notProbed('inspection does not start confinement probes', clockFrom(options)());
}

module.exports = { SCHEMA, inspect, probe };
