'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Core = require('./discord-bridge-core');

const ROOT = path.resolve(__dirname, '..', '..');
const STATE_DIR = process.env.AXM_DISCORD_STATE_DIR || path.join(ROOT, 'state', 'discord-bridge');
const SETTINGS_FILE = path.join(STATE_DIR, 'settings.local.json');
const BOT_TOKEN_FILE = path.join(STATE_DIR, 'bot-token.txt');
const RUNTIME_TOKEN_FILE = path.join(STATE_DIR, 'runtime-token.txt');
const PROPOSALS_FILE = path.join(STATE_DIR, 'proposals.json');
const JOURNAL_FILE = path.join(STATE_DIR, 'journal.jsonl');
const HOST = '127.0.0.1';
const PORT = Number(process.env.AXM_DISCORD_BRIDGE_PORT || 8822);
const DISCORD_API = 'https://discord.com/api/v10';
const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

function ensureState() { fs.mkdirSync(STATE_DIR, { recursive: true }); }
function atomicJson(file, value) {
  ensureState();
  const temp = file + '.tmp-' + process.pid;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return fallback; }
}
function secret(file, create) {
  ensureState();
  try { const value = fs.readFileSync(file, 'utf8').trim(); if (value) return value; } catch (_) {}
  if (!create) return '';
  const value = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, value + '\n', { encoding: 'utf8', mode: 0o600 });
  return value;
}
function writeSecret(file, value) {
  ensureState();
  fs.writeFileSync(file, String(value).trim() + '\n', { encoding: 'utf8', mode: 0o600 });
}
function settings() { return Core.publicSettings(readJson(SETTINGS_FILE, Core.defaults())); }
function proposals() { return readJson(PROPOSALS_FILE, []); }
function journal(kind, detail) {
  ensureState();
  const record = { at: new Date().toISOString(), kind: String(kind), detail: detail || {} };
  fs.appendFileSync(JOURNAL_FILE, JSON.stringify(record) + '\n', 'utf8');
}
function safeEqual(a, b) {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; if (body.length > 65536) { reject(new Error('request body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (_) { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}
function requireHuman(input) {
  const actor = input && input.actor;
  if (!actor || actor.kind !== 'human' || !String(actor.id || '').trim()) throw new Error('A named human actor is required');
  return actor;
}

class DiscordRuntime {
  constructor() {
    this.socket = null;
    this.seq = null;
    this.heartbeat = null;
    this.heartbeatAck = true;
    this.state = 'DISCONNECTED';
    this.bot = null;
    this.lastError = null;
    this.lastReadyAt = null;
    this.intentionalStop = true;
  }
  status() {
    return { state: this.state, connected: this.state === 'READY', bot: this.bot, lastError: this.lastError, lastReadyAt: this.lastReadyAt };
  }
  async api(method, endpoint, body) {
    const token = secret(BOT_TOKEN_FILE, false);
    if (!token) throw new Error('Discord bot token is not configured');
    const response = await fetch(DISCORD_API + endpoint, {
      method,
      headers: { authorization: 'Bot ' + token, 'content-type': 'application/json', 'user-agent': 'AXMWorkshopBridge/0.1 (local-first)' },
      body: body == null ? undefined : JSON.stringify(body)
    });
    const raw = await response.text();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { parsed = raw; }
    if (!response.ok) throw new Error('Discord API ' + response.status + ': ' + String(parsed && parsed.message || raw || 'request failed').slice(0, 300));
    return parsed;
  }
  commands() {
    return [{
      name: 'axm', description: 'Use the local AXM Workshop collaboration doorway',
      options: [
        { type: 1, name: 'status', description: 'Show the bridge state without changing anything' },
        { type: 1, name: 'propose', description: 'Place a proposal in the local human-review queue', options: [{ type: 3, name: 'text', description: 'What should the Workshop stewards consider?', required: true, max_length: 1200 }] },
        { type: 1, name: 'pause', description: 'Pause outbound AXM Discord activity' }
      ]
    }];
  }
  async registerCommands() {
    const config = settings();
    if (!config.applicationId || !config.guildId) throw new Error('Application ID and Server ID are required');
    await this.api('PUT', '/applications/' + config.applicationId + '/guilds/' + config.guildId + '/commands', this.commands());
    journal('commands-registered', { guildId: config.guildId, ordinaryMessageReading: false });
  }
  identify() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ op: 2, d: { token: secret(BOT_TOKEN_FILE, false), intents: 1, properties: { os: process.platform, browser: 'axm-workshop', device: 'axm-workshop' } } }));
  }
  startHeartbeat(interval) {
    clearInterval(this.heartbeat);
    const beat = () => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      if (!this.heartbeatAck) { this.lastError = 'Gateway heartbeat was not acknowledged'; return this.stop(false); }
      this.heartbeatAck = false;
      this.socket.send(JSON.stringify({ op: 1, d: this.seq }));
    };
    this.heartbeat = setInterval(beat, Number(interval));
    setTimeout(beat, Math.min(1000, Number(interval))).unref();
  }
  async connect() {
    const config = settings();
    if (!config.enabled) throw new Error('Enable the connector before connecting');
    if (config.paused) throw new Error('Unpause the connector before connecting');
    if (!config.applicationId || !config.guildId) throw new Error('Application ID and Server ID are required');
    if (!secret(BOT_TOKEN_FILE, false)) throw new Error('Discord bot token is not configured');
    await this.stop(true);
    this.intentionalStop = false;
    this.state = 'CONNECTING'; this.lastError = null;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Discord Gateway connection timed out')); this.stop(false); } }, 15000);
      const socket = new WebSocket(GATEWAY);
      this.socket = socket;
      socket.addEventListener('message', async event => {
        try {
          const packet = JSON.parse(String(event.data));
          if (packet.s != null) this.seq = packet.s;
          if (packet.op === 10) { this.startHeartbeat(packet.d.heartbeat_interval); this.identify(); }
          if (packet.op === 11) this.heartbeatAck = true;
          if (packet.op === 7 || packet.op === 9) { this.lastError = 'Gateway requested a fresh connection'; this.stop(false); }
          if (packet.op === 0 && packet.t === 'READY') {
            this.state = 'READY'; this.bot = packet.d.user ? { id: packet.d.user.id, username: packet.d.user.username } : null; this.lastReadyAt = new Date().toISOString();
            journal('gateway-ready', { botId: this.bot && this.bot.id, guilds: Array.isArray(packet.d.guilds) ? packet.d.guilds.length : 0 });
            if (config.commandsEnabled) await this.registerCommands();
            if (!settled) { settled = true; clearTimeout(timeout); resolve(this.status()); }
          }
          if (packet.op === 0 && packet.t === 'INTERACTION_CREATE') await this.handleInteraction(packet.d);
        } catch (error) { this.lastError = String(error.message || error).slice(0, 500); journal('gateway-handler-error', { error: this.lastError }); }
      });
      socket.addEventListener('close', event => {
        clearInterval(this.heartbeat); this.heartbeat = null; this.socket = null;
        if (this.state !== 'DISCONNECTED') this.state = 'DISCONNECTED';
        if (!this.intentionalStop) this.lastError = 'Gateway closed (' + event.code + ')';
        if (!settled) { settled = true; clearTimeout(timeout); reject(new Error(this.lastError || 'Gateway closed')); }
      });
      socket.addEventListener('error', () => { this.lastError = 'Discord Gateway WebSocket error'; });
    });
  }
  async stop(intentional) {
    this.intentionalStop = intentional !== false;
    clearInterval(this.heartbeat); this.heartbeat = null;
    if (this.socket) { try { this.socket.close(1000, 'AXM local pause'); } catch (_) {} }
    this.socket = null; this.state = 'DISCONNECTED'; this.bot = null;
  }
  option(interaction, name) {
    const sub = interaction && interaction.data && Array.isArray(interaction.data.options) ? interaction.data.options[0] : null;
    const option = sub && Array.isArray(sub.options) ? sub.options.find(item => item.name === name) : null;
    return option ? option.value : '';
  }
  async respond(interaction, content) {
    await fetch(DISCORD_API + '/interactions/' + interaction.id + '/' + interaction.token + '/callback', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 4, data: { content: String(content).slice(0, 1900), flags: 64, allowed_mentions: { parse: [] } } })
    });
  }
  async handleInteraction(interaction) {
    if (!interaction || !interaction.data || interaction.data.name !== 'axm') return;
    const config = settings();
    if (!config.commandsEnabled || config.paused) return this.respond(interaction, 'AXM Discord commands are currently paused by a local steward.');
    const sub = Array.isArray(interaction.data.options) && interaction.data.options[0] ? interaction.data.options[0].name : 'status';
    if (sub === 'status') return this.respond(interaction, 'AXM Workshop Bridge: ' + this.state + '. Feed: ' + (config.feedPostingEnabled ? 'enabled' : 'off') + '. Ordinary message reading: off. Proposals require local human review.');
    if (sub === 'pause') {
      const permissions = BigInt(String(interaction.member && interaction.member.permissions || '0'));
      if ((permissions & 32n) !== 32n) return this.respond(interaction, 'Pause requires Discord Manage Server permission.');
      const next = Core.updateSettings(config, { paused: true }, { id: interaction.member.user.id, kind: 'human', name: interaction.member.user.username });
      atomicJson(SETTINGS_FILE, next); journal('paused-from-discord', { actorId: interaction.member.user.id });
      await this.respond(interaction, 'AXM outbound Discord activity is paused. Re-enable it only from the local Workshop.');
      return this.stop(true);
    }
    if (sub === 'propose') {
      const proposal = Core.proposalFromInteraction(interaction, this.option(interaction, 'text'));
      atomicJson(PROPOSALS_FILE, Core.appendBounded(proposals(), proposal));
      journal('proposal-received', { proposalId: proposal.id, authorId: proposal.author.discordUserId });
      return this.respond(interaction, 'Proposal recorded in the local Workshop review queue. It is not a lesson and will not execute automatically. Reference: `' + proposal.id + '`.');
    }
  }
  async postReceipt(action) {
    const config = settings();
    if (!config.enabled || config.paused || !config.feedPostingEnabled) return { posted: false, state: 'HELD_DISABLED' };
    if (this.state !== 'READY') return { posted: false, state: 'HELD_OFFLINE' };
    if (!config.channelId) return { posted: false, state: 'HELD_NO_CHANNEL' };
    const safe = Core.sanitizeAction(action);
    const result = await this.api('POST', '/channels/' + config.channelId + '/messages', { content: Core.renderReceipt(safe), allowed_mentions: { parse: [] } });
    journal('receipt-posted', { actionId: safe.id, state: safe.state, messageId: result && result.id });
    return { posted: true, state: 'POSTED', messageId: result && result.id };
  }
}

const runtime = new DiscordRuntime();
const runtimeToken = secret(RUNTIME_TOKEN_FILE, true);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/health') return send(res, 200, { ok: true, body: 'axm-discord-bridge', version: '0.1.0', state: runtime.state });
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!safeEqual(auth, runtimeToken)) return send(res, 401, { ok: false, error: 'local authorization required' });
    if (url.pathname === '/v1/status' && req.method === 'GET') {
      const config = settings();
      return send(res, 200, { ok: true, settings: config, botTokenConfigured: !!secret(BOT_TOKEN_FILE, false), installUrl: Core.installUrl(config.applicationId), runtime: runtime.status(), proposalCount: proposals().length, boundaries: { loopbackOnly: true, packageDefaultOff: true, ordinaryMessageReading: false, rawActionContentPosted: false, automaticTraining: false, automaticExecution: false } });
    }
    if (url.pathname === '/v1/settings' && req.method === 'POST') {
      const input = await readBody(req), next = Core.updateSettings(settings(), input.settings || input, requireHuman(input));
      atomicJson(SETTINGS_FILE, next); journal('settings-updated', { actorId: next.updatedBy.id, enabled: next.enabled, paused: next.paused, commands: next.commandsEnabled, feed: next.feedPostingEnabled });
      return send(res, 200, { ok: true, settings: next, installUrl: Core.installUrl(next.applicationId) });
    }
    if (url.pathname === '/v1/token' && req.method === 'POST') {
      const input = await readBody(req); requireHuman(input);
      const token = String(input.token || '').trim();
      if (token.length < 30 || /\s/.test(token)) throw new Error('That does not look like a Discord bot token');
      writeSecret(BOT_TOKEN_FILE, token); journal('bot-token-replaced', { actorId: input.actor.id });
      return send(res, 200, { ok: true, botTokenConfigured: true });
    }
    if (url.pathname === '/v1/control' && req.method === 'POST') {
      const input = await readBody(req), actor = requireHuman(input), action = String(input.action || '');
      if (action === 'connect') { const status = await runtime.connect(); return send(res, 200, { ok: true, runtime: status }); }
      if (action === 'disconnect') { await runtime.stop(true); journal('disconnected', { actorId: actor.id }); return send(res, 200, { ok: true, runtime: runtime.status() }); }
      if (action === 'pause') {
        const next = Core.updateSettings(settings(), { paused: true }, actor); atomicJson(SETTINGS_FILE, next); await runtime.stop(true); journal('paused', { actorId: actor.id });
        return send(res, 200, { ok: true, settings: next, runtime: runtime.status() });
      }
      throw new Error('Unsupported control action');
    }
    if (url.pathname === '/v1/feed' && req.method === 'POST') {
      const input = await readBody(req); return send(res, 200, Object.assign({ ok: true }, await runtime.postReceipt(input.action || input)));
    }
    if (url.pathname === '/v1/proposals' && req.method === 'GET') return send(res, 200, { ok: true, proposals: proposals().slice().reverse() });
    return send(res, 404, { ok: false, error: 'route not found' });
  } catch (error) {
    const message = String(error.message || error).slice(0, 500);
    journal('request-error', { route: req.url, error: message });
    return send(res, 400, { ok: false, error: message });
  }
});

server.listen(PORT, HOST, () => console.log('AXM Discord Bridge ready on http://' + HOST + ':' + PORT + ' (default off)'));
process.on('SIGINT', async () => { await runtime.stop(true); server.close(() => process.exit(0)); });
process.on('SIGTERM', async () => { await runtime.stop(true); server.close(() => process.exit(0)); });

module.exports = { server, runtime, paths: { STATE_DIR, SETTINGS_FILE, BOT_TOKEN_FILE, RUNTIME_TOKEN_FILE, PROPOSALS_FILE } };
