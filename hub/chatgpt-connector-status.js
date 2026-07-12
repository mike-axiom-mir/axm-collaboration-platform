'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const SCHEMA = 'axm.chatgpt-connector-status/v1';
const CACHE_MS = 15000;
const PROBE_TIMEOUT_MS = 3500;

function codexCandidates(env, io) {
  env = env || process.env;
  io = io || fs;
  const candidates = [];
  function add(file) {
    if (!file || candidates.indexOf(file) >= 0) return;
    try { if (io.existsSync(file) && io.statSync(file).isFile()) candidates.push(file); } catch (e) {}
  }

  add(env.AXM_CODEX_BINARY);
  const localBin = path.join(env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  try {
    io.readdirSync(localBin, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => path.join(localBin, item.name, 'codex.exe'))
      .sort((a, b) => {
        try { return io.statSync(b).mtimeMs - io.statSync(a).mtimeMs; } catch (e) { return 0; }
      })
      .forEach(add);
  } catch (e) {}
  add(path.join(env.APPDATA || '', 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai', 'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe'));
  add(path.join(env.USERPROFILE || env.HOME || '', '.local', 'bin', 'codex.exe'));
  String(env.PATH || '').split(path.delimiter).filter(Boolean).forEach(dir => add(path.join(dir, 'codex.exe')));
  return candidates;
}

function runLoginStatus(binary, options) {
  options = options || {};
  const execFile = options.execFile || childProcess.execFile;
  return new Promise(resolve => {
    try {
      execFile(binary, ['login', 'status'], {
        encoding: 'utf8', windowsHide: true,
        timeout: options.timeoutMs || PROBE_TIMEOUT_MS,
        maxBuffer: 64 * 1024
      }, (error, stdout, stderr) => {
        const inaccessible = !!(error && (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM'));
        const output = String(stdout || '') + '\n' + String(stderr || '');
        resolve({
          accessible: !inaccessible,
          loginVerified: !error && /\blogged\s+in\b/i.test(output),
          timedOut: !!(error && (error.killed || error.code === 'ETIMEDOUT'))
        });
      });
    } catch (error) {
      resolve({ accessible: false, loginVerified: false, timedOut: false });
    }
  });
}

function chatAppOpen(options) {
  options = options || {};
  const execFileSync = options.execFileSync || childProcess.execFileSync;
  try {
    const list = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq ChatGPT.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8', windowsHide: true, timeout: 1800, maxBuffer: 64 * 1024
    });
    return /"ChatGPT\.exe"/i.test(String(list || ''));
  } catch (e) { return false; }
}

function createInspector(options) {
  options = options || {};
  const findCandidates = options.findCandidates || (() => codexCandidates(options.env, options.fs));
  const loginProbe = options.runLoginStatus || (binary => runLoginStatus(binary, options));
  const appProbe = options.chatAppOpen || (() => chatAppOpen(options));
  const clock = options.now || Date.now;
  const cacheMs = options.cacheMs == null ? CACHE_MS : options.cacheMs;
  let cached = null;
  let pending = null;

  async function inspect() {
    const now = clock();
    if (cached && cached.expiresAt > now) return cached.value;
    if (pending) return pending;
    pending = (async () => {
      const candidates = findCandidates();
      let probe = { accessible: false, loginVerified: false, timedOut: false };
      for (const candidate of candidates) {
        probe = await loginProbe(candidate);
        if (probe.accessible) break;
      }
      const appOpen = !!appProbe();
      let state = 'unavailable';
      if (probe.loginVerified) state = 'ready';
      else if (probe.accessible) state = 'login-required';
      else if (candidates.length) state = probe.timedOut ? 'probe-timeout' : 'inaccessible';
      const value = {
        schema: SCHEMA,
        checkedAt: new Date(clock()).toISOString(),
        codingSeat: {
          state,
          cliInstalled: candidates.length > 0,
          cliAccessible: !!probe.accessible,
          loginVerified: !!probe.loginVerified
        },
        chatApp: { appOpen },
        platformMcp: {
          state: 'manual',
          connected: false,
          safeTunnel: false,
          note: 'No explicit safe tunnel status is configured.'
        }
      };
      cached = { expiresAt: clock() + cacheMs, value };
      return value;
    })();
    try { return await pending; } finally { pending = null; }
  }

  return { inspect };
}

const inspector = createInspector();
module.exports = { SCHEMA, CACHE_MS, PROBE_TIMEOUT_MS, codexCandidates, runLoginStatus, chatAppOpen, createInspector, inspect: inspector.inspect };
