'use strict';

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { CdpClient } = require('./cdp-client');

const REQUEST_SCHEMA = 'axm.ai-seat-courier.request/v1';
const RESPONSE_SCHEMA = 'axm.ai-seat-courier.response/v1';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const SAFE_CODES = /^(Key[A-Z]|Digit[0-9]|Arrow(?:Up|Down|Left|Right)|Space|Enter|Escape|Numpad[0-9])$/;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null) return true;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once('exit', onExit);
  });
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null) return;
  try { child.kill('SIGTERM'); } catch (_) { /* already stopped */ }
  if (await waitForChildExit(child, 2000)) return;
  try { child.kill('SIGKILL'); } catch (_) { /* already stopped */ }
  await waitForChildExit(child, 2000);
}

function ensureInside(root, candidate, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`${label || 'path'} escapes its allowed root`);
  }
  return resolved;
}

function assertLocalUrl(value, expectedOrigin) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('only local http://127.0.0.1 or localhost URLs are allowed');
  }
  if (expectedOrigin && url.origin !== expectedOrigin) {
    throw new Error(`URL origin ${url.origin} does not match the active game origin ${expectedOrigin}`);
  }
  return url;
}

function keyDescriptor(code) {
  if (!SAFE_CODES.test(code)) throw new Error(`unsupported key code: ${code}`);
  if (code.startsWith('Key')) return { code, key: code.slice(3).toLowerCase(), windowsVirtualKeyCode: code.charCodeAt(3) };
  if (code.startsWith('Digit')) return { code, key: code.slice(5), windowsVirtualKeyCode: 48 + Number(code.slice(5)) };
  const map = {
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27]
  };
  if (map[code]) return { code, key: map[code][0], windowsVirtualKeyCode: map[code][1] };
  const digit = Number(code.slice(-1));
  return { code, key: String(digit), windowsVirtualKeyCode: 96 + digit, isKeypad: true };
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function detectEdge() {
  const candidates = [
    process.env.AXM_EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error('Microsoft Edge was not found; set AXM_EDGE_PATH explicitly');
  return found;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : null; } catch (_) { value = text; }
  return { status: response.status, ok: response.ok, value };
}

class CourierCore {
  constructor(options = {}) {
    this.moduleRoot = options.moduleRoot || path.resolve(__dirname, '..');
    this.workshopRoot = options.workshopRoot || path.resolve(this.moduleRoot, '..', '..', '..');
    this.libraryRoot = options.libraryRoot || path.join(this.workshopRoot, 'tools', 'game-hub', 'game-library');
    this.stateRoot = options.stateRoot || path.join(this.workshopRoot, 'state', 'ai-seat-courier');
    this.captureRoot = path.join(this.stateRoot, 'captures');
    this.browser = null;
    this.server = null;
    this.session = null;
    fs.mkdirSync(this.captureRoot, { recursive: true });
  }

  listGames() {
    const games = [];
    for (const entry of fs.readdirSync(this.libraryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const gameRoot = path.join(this.libraryRoot, entry.name);
      const manifestPath = path.join(gameRoot, 'game.manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.game_id && manifest.launch && manifest.launch.server_entry) games.push({ gameRoot, manifestPath, manifest });
      } catch (_) { /* malformed games stay unavailable */ }
    }
    return games;
  }

  findGame(gameId) {
    const game = this.listGames().find(item => item.manifest.game_id === gameId || String(item.manifest.slot) === String(gameId));
    if (!game) throw new Error(`registered game not found: ${gameId}`);
    const serverEntry = ensureInside(game.gameRoot, path.join(game.gameRoot, game.manifest.launch.server_entry), 'server entry');
    if (!fs.existsSync(serverEntry)) throw new Error(`server entry is missing: ${game.manifest.launch.server_entry}`);
    const port = Number(game.manifest.launch.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('manifest launch.port is invalid');
    return Object.assign({}, game, { serverEntry, port });
  }

  async waitForGame(game, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    const healthUrl = `http://127.0.0.1:${game.port}${game.manifest.launch.ready_path || '/health'}`;
    while (Date.now() < deadline) {
      try {
        const result = await fetchJson(healthUrl);
        if (result.ok && result.value && (result.value.gameId === game.manifest.game_id || result.value.game_id === game.manifest.game_id)) return;
        if (result.ok) throw new Error(`port ${game.port} belongs to another service`);
      } catch (error) {
        if (error.message.includes('belongs to another service')) throw error;
      }
      await delay(100);
    }
    throw new Error(`game did not become healthy on port ${game.port}`);
  }

  async startServer(game) {
    const healthUrl = `http://127.0.0.1:${game.port}${game.manifest.launch.ready_path || '/health'}`;
    try {
      const existing = await fetchJson(healthUrl);
      if (existing.ok && existing.value && (existing.value.gameId === game.manifest.game_id || existing.value.game_id === game.manifest.game_id)) {
        return { process: null, owned: false };
      }
      if (existing.ok) throw new Error(`port ${game.port} is already occupied by another service`);
    } catch (error) {
      if (error.message.includes('occupied')) throw error;
    }

    const child = spawn(process.execPath, [game.serverEntry], {
      cwd: game.gameRoot,
      env: Object.assign({}, process.env, { HOST: '127.0.0.1', PORT: String(game.port) }),
      windowsHide: true,
      stdio: 'ignore'
    });
    await this.waitForGame(game);
    return { process: child, owned: true };
  }

  async waitForEdge(cdpPort, targetUrl, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const targets = await fetch(`http://127.0.0.1:${cdpPort}/json/list`).then(response => response.json());
        const target = targets.find(item => item.type === 'page' && item.url === targetUrl) || targets.find(item => item.type === 'page');
        if (target && target.webSocketDebuggerUrl) return target;
      } catch (_) { /* Edge is still booting */ }
      await delay(100);
    }
    throw new Error('headless Edge did not expose a page target');
  }

  async startBrowser(url, viewport) {
    const edgePath = detectEdge();
    const cdpPort = await freePort();
    const profileDir = path.join(this.stateRoot, `edge-profile-${Date.now()}-${process.pid}`);
    ensureInside(this.stateRoot, profileDir, 'Edge profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const width = Math.max(640, Math.min(1920, Number(viewport && viewport.width) || 1280));
    const height = Math.max(480, Math.min(1200, Number(viewport && viewport.height) || 720));
    const args = [
      '--headless=new', `--remote-debugging-port=${cdpPort}`, '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profileDir}`, `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--metrics-recording-only', '--disable-features=OptimizationGuideModelDownloading,MediaRouter', url
    ];
    const child = spawn(edgePath, args, { windowsHide: true, stdio: 'ignore' });
    const target = await this.waitForEdge(cdpPort, url);
    const cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.connect();
    await Promise.all([
      cdp.call('Page.enable'), cdp.call('DOM.enable'), cdp.call('Accessibility.enable'),
      cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    ]);
    return { child, cdp, cdpPort, profileDir, viewport: { width, height } };
  }

  async capture(requestId) {
    if (!this.browser) throw new Error('no browser session is active');
    const safeId = String(requestId || Date.now()).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
    const filePath = path.join(this.captureRoot, `${safeId}.png`);
    ensureInside(this.captureRoot, filePath, 'capture path');
    const result = await this.browser.cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    return filePath;
  }

  async semanticSnapshot() {
    if (!this.browser) throw new Error('no browser session is active');
    const result = await this.browser.cdp.call('Accessibility.getFullAXTree');
    return (result.nodes || []).slice(0, 400).map(node => ({
      role: node.role && node.role.value,
      name: node.name && node.name.value,
      ignored: Boolean(node.ignored)
    })).filter(node => !node.ignored && (node.role || node.name));
  }

  async click(selector) {
    if (!this.browser) throw new Error('no browser session is active');
    if (typeof selector !== 'string' || selector.length < 1 || selector.length > 500) throw new Error('selector is required and must be <= 500 characters');
    const document = await this.browser.cdp.call('DOM.getDocument', { depth: 0, pierce: true });
    const found = await this.browser.cdp.call('DOM.querySelector', { nodeId: document.root.nodeId, selector });
    if (!found.nodeId) throw new Error(`selector did not match: ${selector}`);
    const box = await this.browser.cdp.call('DOM.getBoxModel', { nodeId: found.nodeId });
    const quad = box.model.content;
    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
    const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
    await this.browser.cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.browser.cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return { selector, x, y };
  }

  async pressKey(code, durationMs) {
    if (!this.browser) throw new Error('no browser session is active');
    const descriptor = keyDescriptor(String(code || ''));
    const holdMs = Math.max(20, Math.min(5000, Number(durationMs) || 60));
    await this.browser.cdp.call('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, descriptor));
    await delay(holdMs);
    await this.browser.cdp.call('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, descriptor));
    return { code: descriptor.code, durationMs: holdMs };
  }

  async httpRequest(request) {
    if (!this.session) throw new Error('no game session is active');
    const target = new URL(request.url || request.path || '/', this.session.baseUrl);
    assertLocalUrl(target.href, this.session.origin);
    const method = String(request.method || 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) throw new Error('only GET and POST are allowed');
    const headers = {};
    const allowedHeaders = new Set(['content-type', 'x-axm-seat-token', 'authorization']);
    for (const [name, value] of Object.entries(request.headers || {})) {
      if (allowedHeaders.has(name.toLowerCase())) headers[name] = String(value);
    }
    let body;
    if (method === 'POST' && request.body !== undefined) {
      body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      if (Buffer.byteLength(body) > 64 * 1024) throw new Error('HTTP request body exceeds 64 KiB');
      if (!Object.keys(headers).some(name => name.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
    }
    const result = await fetchJson(target.href, { method, headers, body });
    return { url: target.href, status: result.status, ok: result.ok, body: result.value };
  }

  async launch(request) {
    await this.stopSession();
    const game = this.findGame(String(request.gameId || ''));
    try {
      this.server = await this.startServer(game);
      const clientPath = request.path || game.manifest.launch.client_entry || '/';
      const target = assertLocalUrl(new URL(clientPath, `http://127.0.0.1:${game.port}/`).href);
      this.browser = await this.startBrowser(target.href, request.viewport);
      this.session = {
        gameId: game.manifest.game_id,
        slot: String(game.manifest.slot),
        baseUrl: `http://127.0.0.1:${game.port}/`,
        origin: target.origin,
        pageUrl: target.href,
        port: game.port,
        serverOwned: this.server.owned,
        startedAt: new Date().toISOString(),
        viewport: this.browser.viewport
      };
      await delay(Math.max(100, Math.min(3000, Number(request.waitMs) || 500)));
      const capture = await this.capture(`${request.id || 'launch'}-initial`);
      return { session: this.session, capture };
    } catch (error) {
      await this.stopSession();
      throw error;
    }
  }

  async stopSession() {
    const previous = this.session;
    if (this.browser) {
      try { await this.browser.cdp.call('Browser.close'); } catch (_) { /* close below */ }
      this.browser.cdp.close();
      await terminateChild(this.browser.child);
      const profileDir = this.browser.profileDir;
      this.browser = null;
      try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }); } catch (_) { /* next startup can reclaim a stale owned profile */ }
    }
    if (this.server && this.server.owned && this.server.process) {
      await terminateChild(this.server.process);
    }
    this.server = null;
    this.session = null;
    return { stopped: Boolean(previous), previous };
  }

  status() {
    return { sessionActive: Boolean(this.session), session: this.session };
  }

  async handle(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('request must be a JSON object');
    if (request.schema && request.schema !== REQUEST_SCHEMA) throw new Error(`unsupported request schema: ${request.schema}`);
    const action = String(request.action || '');
    if (action === 'ping' || action === 'status') return this.status();
    if (action === 'launch') return this.launch(request);
    if (action === 'click') return this.click(request.selector);
    if (action === 'key') return this.pressKey(request.code, request.durationMs);
    if (action === 'wait') { const ms = Math.max(0, Math.min(10000, Number(request.ms) || 0)); await delay(ms); return { waitedMs: ms }; }
    if (action === 'screenshot') return { capture: await this.capture(request.id) };
    if (action === 'snapshot') return { accessibility: await this.semanticSnapshot(), capture: request.capture === false ? null : await this.capture(request.id) };
    if (action === 'http') return this.httpRequest(request);
    if (action === 'stop') return this.stopSession();
    throw new Error(`unsupported action: ${action || '(missing)'}`);
  }
}

module.exports = {
  CourierCore, REQUEST_SCHEMA, RESPONSE_SCHEMA, assertLocalUrl, ensureInside, keyDescriptor, terminateChild
};
