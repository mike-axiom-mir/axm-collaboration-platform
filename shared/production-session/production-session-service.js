'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const Core = require('./production-session-core');

function mkdirs(paths) {
  ['home', 'state', 'exports', 'logs', 'workspace', 'browser'].forEach(key => fs.mkdirSync(paths[key], { recursive: true }));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function waitForHealth(port, attempts) {
  return new Promise((resolve, reject) => {
    let left = Number(attempts || 50);
    const tryOnce = () => {
      const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', timeout: 600 }, response => {
        let body = '';
        response.on('data', chunk => { if (body.length < 65536) body += chunk; });
        response.on('end', () => {
          try {
            const parsed = JSON.parse(body || '{}');
            if (response.statusCode === 200 && parsed.ok && parsed.productionSession) return resolve(parsed);
          } catch (e) {}
          retry();
        });
      });
      request.on('timeout', () => request.destroy());
      request.on('error', retry);
    };
    const retry = () => {
      left -= 1;
      if (left <= 0) return reject(Error('temporary session runtime did not become ready'));
      setTimeout(tryOnce, 120);
    };
    tryOnce();
  });
}

function create(options) {
  const opts = options || {};
  const workshopRoot = path.resolve(opts.workshopRoot || path.resolve(__dirname, '..', '..'));
  const serverFile = path.resolve(opts.serverFile || path.join(workshopRoot, 'server.js'));
  const baseDir = path.resolve(opts.baseDir || path.join(os.tmpdir(), 'AXM-Production-Sessions'));
  const auditFile = path.resolve(opts.auditFile || path.join(workshopRoot, 'state', 'production-sessions', 'audit.jsonl'));
  const active = new Map();

  function audit(event, record) {
    const row = {
      schema: 'axm.temporary-production-session-audit/v1',
      event,
      id: record.id,
      participant: record.participant,
      at: new Date().toISOString(),
      contentStored: false
    };
    fs.mkdirSync(path.dirname(auditFile), { recursive: true });
    fs.appendFileSync(auditFile, JSON.stringify(row) + '\n', 'utf8');
  }

  async function start(input) {
    if (active.size >= 2) throw Error('two temporary sessions are already active; close one before starting another');
    const participant = Core.cleanParticipant(input && input.participant);
    const id = Core.sessionId(participant);
    const paths = Core.sessionPaths(baseDir, id);
    const port = await freePort();
    mkdirs(paths);
    let info = Core.metadata({ id, participant, preset: input && input.preset, port, status: 'starting' });
    fs.writeFileSync(paths.metadata, JSON.stringify(info, null, 2) + '\n', 'utf8');
    fs.writeFileSync(paths.instructions, Core.workspaceInstructions(info, workshopRoot), 'utf8');
    const child = childProcess.spawn(process.execPath, [serverFile, '--open=none'], {
      cwd: workshopRoot,
      env: Object.assign({}, process.env, {
        AXM_PORT: String(port),
        AXM_HOST: '127.0.0.1',
        AXM_NO_BROWSER: '1',
        AXM_PRODUCTION_SESSION_ID: id,
        AXM_PRODUCTION_SESSION_PARTICIPANT: participant,
        AXM_PRODUCTION_SESSION_CREATED_AT: info.createdAt,
        AXM_PRODUCTION_SESSION_HOME: paths.home
      }),
      windowsHide: true,
      stdio: 'ignore'
    });
    info = Core.metadata(Object.assign({}, info, { pid: child.pid, status: 'starting' }));
    fs.writeFileSync(paths.metadata, JSON.stringify(info, null, 2) + '\n', 'utf8');
    const record = { id, participant, port, pid: child.pid, child, paths, createdAt: info.createdAt, status: 'starting' };
    active.set(id, record);
    child.once('exit', () => { active.delete(id); });
    try {
      await waitForHealth(port);
      record.status = 'active';
      info = Core.metadata(Object.assign({}, info, { status: 'active' }));
      fs.writeFileSync(paths.metadata, JSON.stringify(info, null, 2) + '\n', 'utf8');
      audit('started', record);
      return publicRecord(record);
    } catch (error) {
      try { child.kill(); } catch (e) {}
      active.delete(id);
      try { fs.rmSync(paths.home, { recursive: true, force: true }); } catch (e) {}
      throw error;
    }
  }

  function publicRecord(record) {
    return {
      id: record.id,
      participant: record.participant,
      status: record.status,
      port: record.port,
      pid: record.pid,
      createdAt: record.createdAt,
      url: `http://127.0.0.1:${record.port}/hub/index.html`,
      workspace: record.paths.workspace,
      automaticArchive: false,
      sharedLiveRuntimes: false
    };
  }

  function status() {
    return Array.from(active.values()).filter(record => record.child.exitCode == null).map(publicRecord);
  }

  return { start, status, baseDir };
}

module.exports = { create, freePort, waitForHealth };
