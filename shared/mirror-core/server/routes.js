'use strict';

const fs = require('fs');
const path = require('path');
const { readJson, requiredString } = require('./request-validation');
const Compatibility = require('../foundation-adapter/pr13-compatibility');

const COLLECTIONS = new Set([
  'actors', 'entities', 'relations', 'evidence', 'capabilities', 'mappings',
  'proposals', 'consents', 'applications', 'events', 'snapshots', 'adapters'
]);

function sendJson(res, status, value) {
  const text = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(text);
}

function sendFile(res, file, type) {
  const data = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': type,
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(data);
}

function routeId(parts, at) {
  try { return decodeURIComponent(parts[at]); }
  catch (error) { throw Object.assign(new Error('malformed route identifier'), { statusCode: 400 }); }
}

function createRouter(core, rootDir) {
  const uiDir = path.join(rootDir, 'ui');
  return async function route(req, res) {
    const parsed = new URL(req.url, 'http://127.0.0.1');
    const pathname = parsed.pathname;
    const parts = pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && pathname === '/') return sendFile(res, path.join(uiDir, 'index.html'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && pathname === '/app.js') return sendFile(res, path.join(uiDir, 'app.js'), 'text/javascript; charset=utf-8');
    if (req.method === 'GET' && pathname === '/styles.css') return sendFile(res, path.join(uiDir, 'styles.css'), 'text/css; charset=utf-8');
    if (req.method === 'GET' && pathname === '/health') return sendJson(res, 200, core.status());
    if (req.method === 'GET' && pathname === '/foundation/discovery') {
      return sendJson(res, 200, Compatibility.discoveryDescriptor(core));
    }

    if (req.method === 'GET' && parts[0] === 'mirror' && COLLECTIONS.has(parts[1]) && parts.length === 2) {
      return sendJson(res, 200, { ok: true, items: core.data(parts[1]) });
    }
    if (req.method === 'GET' && parts[0] === 'mirror' && parts[1] === 'entities' && parts.length === 3) {
      const entity = core.store.read().entities[routeId(parts, 2)];
      return entity ? sendJson(res, 200, { ok: true, entity }) : sendJson(res, 404, { ok: false, error: 'entity not found' });
    }
    if (req.method === 'GET' && parts[0] === 'mirror' && parts[1] === 'proposals' && parts.length === 3) {
      const packet = core.store.read().proposals[routeId(parts, 2)];
      return packet ? sendJson(res, 200, { ok: true, packet }) : sendJson(res, 404, { ok: false, error: 'proposal not found' });
    }

    if (req.method === 'POST' && pathname === '/mirror/proposals') {
      const body = await readJson(req);
      return sendJson(res, 201, { ok: true, packet: core.createProposal(body) });
    }
    if (req.method === 'POST' && parts[0] === 'mirror' && parts[1] === 'proposals' && parts.length === 4) {
      const packetId = routeId(parts, 2);
      const action = parts[3];
      const body = await readJson(req);
      if (action === 'validate') return sendJson(res, 200, Object.assign({ ok: true }, core.validateProposal(packetId, requiredString(body, 'actor_id'))));
      if (action === 'propose') return sendJson(res, 200, { ok: true, packet: core.propose(packetId, requiredString(body, 'actor_id')) });
      if (action === 'review') return sendJson(res, 200, { ok: true, packet: core.review(packetId, requiredString(body, 'actor_id'), body.note) });
      if (action === 'approve') return sendJson(res, 200, { ok: true, packet: core.approve(packetId, requiredString(body, 'actor_id'), body.reason) });
      if (action === 'reject') return sendJson(res, 200, { ok: true, packet: core.reject(packetId, requiredString(body, 'actor_id'), body.reason) });
      if (action === 'amend') return sendJson(res, 200, { ok: true, packet: core.requestAmendment(packetId, requiredString(body, 'actor_id'), body.reason) });
      if (action === 'preview') return sendJson(res, 200, { ok: true, preview: core.preview(packetId) });
      if (action === 'apply') return sendJson(res, 200, core.apply(packetId, requiredString(body, 'actor_id')));
    }

    if (req.method === 'POST' && parts[0] === 'mirror' && parts[1] === 'applications' && parts.length === 4) {
      const applicationId = routeId(parts, 2);
      const action = parts[3];
      const body = await readJson(req);
      if (action === 'verify') return sendJson(res, 200, core.verify(applicationId, requiredString(body, 'actor_id')));
      if (action === 'rollback') return sendJson(res, 200, { ok: true, rollback: core.rollback(applicationId, requiredString(body, 'actor_id')) });
    }

    if (req.method === 'POST' && parts[0] === 'mirror' && parts[1] === 'adapters' && parts.length === 4) {
      const adapterId = routeId(parts, 2);
      const action = parts[3];
      const body = await readJson(req);
      const actor = core.actor(requiredString(body, 'actor_id'));
      if (action === 'connect') return sendJson(res, 200, { ok: true, connection: core.bridge.connect(adapterId, requiredString(body, 'mode'), actor, requiredString(body, 'consent_id')) });
      if (action === 'disconnect') return sendJson(res, 200, { ok: true, connection: core.bridge.disconnect(adapterId, actor) });
    }

    if (req.method === 'POST' && parts[0] === 'mirror' && parts[1] === 'consents' && parts[3] === 'revoke') {
      const consentId = routeId(parts, 2);
      const body = await readJson(req);
      const actor = core.actor(requiredString(body, 'actor_id'));
      core.gate.require({ actor_id: actor.actor_id, actor, permission: 'connect_adapter', context: { system_id: 'mirror-core' } });
      return sendJson(res, 200, { ok: true, consent: core.consentEngine.revoke(consentId, actor) });
    }

    if (req.method === 'GET' && pathname === '/demo/state') {
      let result = null;
      try { result = JSON.parse(fs.readFileSync(path.join(core.runtimeDir, 'demo-result.json'), 'utf8')); } catch (error) {}
      return sendJson(res, 200, { ok: true, result, status: core.status() });
    }
    if (req.method === 'POST' && pathname === '/demo/reset') {
      await readJson(req, 8192);
      return sendJson(res, 200, { ok: true, status: core.reset() });
    }

    return sendJson(res, 404, { ok: false, error: 'route not found' });
  };
}

module.exports = { createRouter, sendJson };
