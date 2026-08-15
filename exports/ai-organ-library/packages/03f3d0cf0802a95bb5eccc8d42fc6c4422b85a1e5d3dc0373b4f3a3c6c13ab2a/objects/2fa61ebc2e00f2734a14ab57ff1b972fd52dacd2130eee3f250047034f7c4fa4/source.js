'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { EventEmitter } = require('node:events');

const ORGAN_ID = 'axm.mirror.organ/code-clone-web-browser-v1';
const REQUEST_SCHEMA = 'axm.mirror.code-clone-web-browser-request/v1';
const RECEIPT_SCHEMA = 'axm.mirror.code-clone-web-browser-receipt/v1';
const LOG_SCHEMA = 'axm.mirror.code-clone-web-curiosity-log-entry/v1';
const ACTIONS = new Set(['SEARCH', 'NAVIGATE', 'WAIT', 'OBSERVE', 'CLICK', 'TYPE', 'PRESS', 'EVALUATE', 'BACK', 'SCREENSHOT', 'CLOSE']);
const LANGUAGE_SOURCES = new Set(['MACHINE_NATIVE_TEXT', 'ENGLISH_LEARNER_MIRROR', 'HUMAN_SUPPLIED', 'OTHER_UTF8', 'UNKNOWN']);
const DEFAULT_SEARCH_TEMPLATE = 'https://duckduckgo.com/?q={query}';
const FORBIDDEN_REASONING_KEYS = /^(chain[-_ ]?of[-_ ]?thought|hidden[-_ ]?reasoning|private[-_ ]?reasoning|scratchpad|internal[-_ ]?monologue)$/i;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function canonical(value) { return JSON.stringify(stable(value)); }

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex');
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || canonical(Object.keys(value).sort()) !== canonical(expected.slice().sort())) {
    throw typedError('SHAPE', `${label} shape is closed`);
  }
}

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function safeId(value, label, maximum = 160) {
  const output = String(value == null ? '' : value).trim();
  if (!output || output.length > maximum || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(output)) {
    throw typedError('IDENTITY', `${label} must be a safe machine identifier`);
  }
  return output;
}

function cleanText(value, maximum, label, allowEmpty = false) {
  const output = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').normalize('NFKC').trim();
  if ((!allowEmpty && !output) || output.length > maximum) throw typedError('TEXT', `${label} must contain ${allowEmpty ? '0' : '1'} through ${maximum} UTF-8 characters`);
  return output;
}

function nullableText(value, maximum, label) {
  return value == null ? null : cleanText(value, maximum, label, true);
}

function digest64(value, label) {
  if (value == null) return null;
  const output = String(value);
  if (!/^[a-f0-9]{64}$/.test(output)) throw typedError('DIGEST', `${label} must be a sha256 digest`);
  return output;
}

function boundedInteger(value, minimum, maximum, fallback, label) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw typedError('LIMIT', `${label} must be an integer from ${minimum} through ${maximum}`);
  return value;
}

function scanForbiddenReasoning(value, trail = ['request']) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_REASONING_KEYS.test(key)) throw typedError('PRIVATE_REASONING', `private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    scanForbiddenReasoning(child, trail.concat(key));
  }
}

function normalizeUrl(value, label, allowBlank = false) {
  const raw = cleanText(value, 8192, label);
  if (allowBlank && raw === 'about:blank') return raw;
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw typedError('URL', `${label} is not a valid URL`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw typedError('URL_PROTOCOL', `${label} must use http or https`);
  return parsed.toString();
}

function normalizeSearchTemplate(value) {
  const template = value == null ? DEFAULT_SEARCH_TEMPLATE : cleanText(value, 8192, 'input.searchTemplate');
  if (!template.includes('{query}')) throw typedError('SEARCH_TEMPLATE', 'search template must contain {query}');
  normalizeUrl(template.replace('{query}', 'axm'), 'search template');
  return template;
}

function normalizeRequest(input) {
  scanForbiddenReasoning(input);
  exactKeys(input, ['schema', 'requestId', 'sessionId', 'action', 'intentionRef', 'reason', 'language', 'input', 'limits'], 'browser request');
  if (input.schema !== REQUEST_SCHEMA) throw typedError('SCHEMA', 'browser request schema is unsupported');
  const requestId = safeId(input.requestId, 'requestId');
  const sessionId = safeId(input.sessionId, 'sessionId');
  const action = String(input.action || '').toUpperCase();
  if (!ACTIONS.has(action)) throw typedError('ACTION', 'browser action is unsupported');

  let intentionRef = null;
  if (input.intentionRef != null) {
    exactKeys(input.intentionRef, ['intentionId', 'intentionDigest'], 'intentionRef');
    intentionRef = {
      intentionId: safeId(input.intentionRef.intentionId, 'intentionRef.intentionId'),
      intentionDigest: digest64(input.intentionRef.intentionDigest, 'intentionRef.intentionDigest')
    };
  }

  exactKeys(input.language, ['locale', 'source', 'englishSpecialistResponseDigest'], 'language');
  const source = String(input.language.source || '').toUpperCase();
  if (!LANGUAGE_SOURCES.has(source)) throw typedError('LANGUAGE_SOURCE', 'language source is unsupported');
  const language = {
    locale: cleanText(input.language.locale, 40, 'language.locale'),
    source,
    englishSpecialistResponseDigest: digest64(input.language.englishSpecialistResponseDigest, 'language.englishSpecialistResponseDigest')
  };
  if (source === 'ENGLISH_LEARNER_MIRROR' && !language.englishSpecialistResponseDigest) {
    throw typedError('ENGLISH_LINEAGE', 'English Learner Mirror text requires its response digest');
  }

  exactKeys(input.input, ['query', 'url', 'selector', 'text', 'key', 'expression', 'clear', 'fullPage', 'searchTemplate', 'waitMs'], 'input');
  const normalizedInput = {
    query: nullableText(input.input.query, 2000, 'input.query'),
    url: input.input.url == null ? null : normalizeUrl(input.input.url, 'input.url', true),
    selector: nullableText(input.input.selector, 2048, 'input.selector'),
    text: nullableText(input.input.text, 65536, 'input.text'),
    key: nullableText(input.input.key, 80, 'input.key'),
    expression: nullableText(input.input.expression, 262144, 'input.expression'),
    clear: input.input.clear == null ? null : Boolean(input.input.clear),
    fullPage: input.input.fullPage == null ? null : Boolean(input.input.fullPage),
    searchTemplate: input.input.searchTemplate == null ? null : normalizeSearchTemplate(input.input.searchTemplate),
    waitMs: input.input.waitMs == null ? null : boundedInteger(input.input.waitMs, 0, 120000, 0, 'input.waitMs')
  };

  exactKeys(input.limits, ['timeoutMs', 'maxTextChars', 'maxLinks', 'maxResultBytes', 'maxScreenshotBytes'], 'limits');
  const limits = {
    timeoutMs: boundedInteger(input.limits.timeoutMs, 100, 900000, 30000, 'limits.timeoutMs'),
    maxTextChars: boundedInteger(input.limits.maxTextChars, 100, 500000, 50000, 'limits.maxTextChars'),
    maxLinks: boundedInteger(input.limits.maxLinks, 0, 2000, 200, 'limits.maxLinks'),
    maxResultBytes: boundedInteger(input.limits.maxResultBytes, 1024, 16 * 1024 * 1024, 1024 * 1024, 'limits.maxResultBytes'),
    maxScreenshotBytes: boundedInteger(input.limits.maxScreenshotBytes, 1024, 64 * 1024 * 1024, 16 * 1024 * 1024, 'limits.maxScreenshotBytes')
  };

  if (action === 'SEARCH' && !normalizedInput.query) throw typedError('ACTION_INPUT', 'SEARCH requires input.query');
  if (action === 'NAVIGATE' && !normalizedInput.url) throw typedError('ACTION_INPUT', 'NAVIGATE requires input.url');
  if (action === 'CLICK' && !normalizedInput.selector) throw typedError('ACTION_INPUT', 'CLICK requires input.selector');
  if (action === 'TYPE' && (!normalizedInput.selector || normalizedInput.text == null)) throw typedError('ACTION_INPUT', 'TYPE requires input.selector and input.text');
  if (action === 'PRESS' && !normalizedInput.key) throw typedError('ACTION_INPUT', 'PRESS requires input.key');
  if (action === 'EVALUATE' && !normalizedInput.expression) throw typedError('ACTION_INPUT', 'EVALUATE requires input.expression');
  if (action === 'WAIT' && normalizedInput.waitMs == null) throw typedError('ACTION_INPUT', 'WAIT requires input.waitMs');

  return stable({
    schema: REQUEST_SCHEMA,
    requestId,
    sessionId,
    action,
    intentionRef,
    reason: cleanText(input.reason, 2000, 'reason'),
    language,
    input: normalizedInput,
    limits
  });
}

function assertDirectoryRoot(stateDir) {
  const root = path.resolve(String(stateDir || ''));
  if (!root || !fs.existsSync(root)) throw typedError('STATE_ROOT', 'browser stateDir must already exist');
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw typedError('STATE_ROOT', 'browser stateDir must be a real directory');
  return root;
}

function assertInside(parent, target, label) {
  const root = path.resolve(parent);
  const child = path.resolve(target);
  if (child === root || !child.startsWith(root + path.sep)) throw typedError('PATH_BOUNDARY', `${label} must remain inside its session root`);
  return child;
}

function isExecutableCandidate(candidate) {
  try { return fs.statSync(candidate).isFile(); }
  catch { return false; }
}

function pathCandidates(name) {
  const pathEntries = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32' ? String(process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  const output = [];
  for (const entry of pathEntries) for (const extension of extensions) output.push(path.join(entry, name + extension.toLowerCase()), path.join(entry, name + extension.toUpperCase()));
  return output;
}

function discoverBrowser(explicitPath = null) {
  const explicit = explicitPath || process.env.AXM_CHROMIUM_PATH || null;
  if (explicit) {
    const resolved = path.resolve(explicit);
    return isExecutableCandidate(resolved)
      ? { state: 'AVAILABLE', executable: resolved, source: explicitPath ? 'EXPLICIT' : 'AXM_CHROMIUM_PATH' }
      : { state: 'MISSING', executable: resolved, source: explicitPath ? 'EXPLICIT' : 'AXM_CHROMIUM_PATH', reason: 'configured path is not a file' };
  }
  const names = process.platform === 'win32'
    ? ['chrome', 'msedge', 'chromium', 'google-chrome']
    : ['brave-browser', 'brave', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome-headless-shell'];
  const fixed = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')
      ]
    : ['/usr/bin/brave-browser', '/usr/bin/brave', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chrome-headless-shell'];
  for (const candidate of fixed.concat(names.flatMap(pathCandidates))) {
    if (isExecutableCandidate(candidate)) return { state: 'AVAILABLE', executable: path.resolve(candidate), source: 'DISCOVERED' };
  }
  return { state: 'MISSING', executable: null, source: 'DISCOVERY', reason: `no ${names.join(', ')} executable found` };
}

class CdpPipe extends EventEmitter {
  constructor(child, timeoutMs) {
    super();
    this.child = child;
    this.writer = child.stdio[3];
    this.reader = child.stdio[4];
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk).slice(-65536); });
    this.reader.on('data', chunk => this.consume(chunk));
    this.reader.on('error', error => this.failAll(typedError('CDP_PIPE_READ', error.message)));
    this.writer.on('error', error => this.failAll(typedError('CDP_PIPE_WRITE', error.message)));
    child.once('error', error => this.failAll(typedError('BROWSER_SPAWN', error.message)));
    child.once('exit', (code, signal) => {
      this.closed = true;
      this.failAll(typedError('BROWSER_EXIT', `browser exited with code ${code == null ? 'null' : code} and signal ${signal || 'none'}`, { stderrTail: this.stderr.slice(-4000) }));
      this.emit('exit', { code, signal });
    });
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const separator = this.buffer.indexOf(0);
      if (separator < 0) break;
      const frame = this.buffer.subarray(0, separator).toString('utf8').trim();
      this.buffer = this.buffer.subarray(separator + 1);
      if (!frame) continue;
      let message;
      try { message = JSON.parse(frame); }
      catch { this.failAll(typedError('CDP_FRAME', 'browser emitted malformed CDP JSON', { preview: frame.slice(0, 500) })); continue; }
      if (message.id != null && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(typedError('CDP_COMMAND', `${pending.method}: ${message.error.message || 'protocol error'}`, message.error));
        else pending.resolve(message.result || {});
      } else if (message.method) this.emit('event', message);
    }
  }

  send(method, params = {}, sessionId = null, timeoutMs = this.timeoutMs) {
    if (this.closed) return Promise.reject(typedError('CDP_CLOSED', 'browser debugging pipe is closed'));
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(typedError('CDP_TIMEOUT', `${method} exceeded ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      this.writer.write(Buffer.from(JSON.stringify(message) + '\0', 'utf8'), error => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(timer);
        reject(typedError('CDP_PIPE_WRITE', error.message));
      });
    });
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function trimResult(value, maximumBytes) {
  const serialized = canonical(value);
  const bytes = Buffer.byteLength(serialized);
  if (bytes <= maximumBytes) return { value: clone(value), truncated: false, bytes, sha256: sha256(serialized) };
  return {
    value: { state: 'TRUNCATED', preview: serialized.slice(0, Math.min(4000, maximumBytes)), originalBytes: bytes, originalSha256: sha256(serialized) },
    truncated: true,
    bytes,
    sha256: sha256(serialized)
  };
}

function classifyPage(page) {
  const title = String(page && page.title || '');
  const text = String(page && page.text || '');
  const readyState = String(page && page.readyState || '');
  const titleBlock = /(captcha|forbidden|access denied|verify|challenge|blocked)/i.test(title);
  const textBlock = /(verify(?:ing)? you(?:'|’)re not a bot|confirm this search was made by a human|automated quer(?:y|ies)|solve the challenge|select all squares|drag the slider|captcha)/i.test(text.slice(0, 8000));
  if (titleBlock || textBlock) return 'CHALLENGE_OR_BLOCK';
  if (text.trim().length < 20 && readyState && readyState !== 'complete') return 'EMPTY_OR_LOADING';
  return text.trim().length ? 'CONTENT_VISIBLE' : 'CONTENT_UNKNOWN';
}

function receiptDigestBasis(receipt) {
  const basis = clone(receipt);
  basis.receiptDigest = null;
  return basis;
}

function logDigestBasis(entry) {
  const basis = clone(entry);
  basis.entryDigest = null;
  return basis;
}

class CuriosityLogger {
  constructor(logPath, sessionId, clock) {
    this.logPath = logPath;
    this.sessionId = sessionId;
    this.clock = clock;
    this.sequence = 0;
    this.previousDigest = null;
  }

  append(eventType, request, target, outcome) {
    const entry = stable({
      schema: LOG_SCHEMA,
      entryDigest: null,
      previousDigest: this.previousDigest,
      sessionId: this.sessionId,
      sequence: ++this.sequence,
      recordedAt: this.clock().toISOString(),
      eventType,
      requestId: request ? request.requestId : null,
      action: request ? request.action : null,
      intentionRef: request ? clone(request.intentionRef) : null,
      language: request ? clone(request.language) : null,
      curiosity: request ? {
        reason: request.reason,
        query: request.action === 'SEARCH' ? request.input.query : null,
        querySha256: request.action === 'SEARCH' ? sha256(request.input.query) : null,
        typedTextCharacters: request.action === 'TYPE' ? request.input.text.length : null,
        typedTextSha256: request.action === 'TYPE' ? sha256(request.input.text) : null,
        expressionCharacters: request.action === 'EVALUATE' ? request.input.expression.length : null,
        expressionSha256: request.action === 'EVALUATE' ? sha256(request.input.expression) : null,
        humanProseDecisionAuthority: false
      } : null,
      target: target ? clone(target) : null,
      outcome: outcome ? clone(outcome) : null,
      authority: {
        targetLogOnly: true,
        pageBodyPersisted: false,
        typedTextPersisted: false,
        credentialCapture: false,
        decisionAuthority: false,
        canonAuthority: false
      }
    });
    entry.entryDigest = sha256(logDigestBasis(entry));
    fs.appendFileSync(this.logPath, canonical(entry) + '\n', { encoding: 'utf8', flag: 'a' });
    this.previousDigest = entry.entryDigest;
    return clone(entry);
  }
}

function verifyCuriosityLog(logPath) {
  const file = path.resolve(logPath);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw typedError('LOG_MISSING', 'curiosity log is missing');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!lines.length || lines.length > 100000) throw typedError('LOG_SIZE', 'curiosity log line count is invalid');
  let previous = null;
  let sessionId = null;
  const eventTypes = {};
  lines.forEach((line, index) => {
    const entry = JSON.parse(line);
    if (entry.schema !== LOG_SCHEMA || entry.sequence !== index + 1) throw typedError('LOG_CHAIN', `curiosity log sequence changed at ${index + 1}`);
    if (sessionId == null) sessionId = entry.sessionId;
    if (entry.sessionId !== sessionId || entry.previousDigest !== previous) throw typedError('LOG_CHAIN', `curiosity log lineage changed at ${index + 1}`);
    if (entry.entryDigest !== sha256(logDigestBasis(entry))) throw typedError('LOG_DIGEST', `curiosity log digest changed at ${index + 1}`);
    if (!entry.authority || entry.authority.decisionAuthority !== false || entry.authority.canonAuthority !== false) throw typedError('LOG_AUTHORITY', `curiosity log authority changed at ${index + 1}`);
    previous = entry.entryDigest;
    eventTypes[entry.eventType] = (eventTypes[entry.eventType] || 0) + 1;
  });
  return stable({ schema: 'axm.mirror.code-clone-web-curiosity-log-verification/v1', state: 'PASS', sessionId, entries: lines.length, finalDigest: previous, eventTypes });
}

class BrowserSession {
  constructor(options) {
    this.options = options;
    this.stateDir = assertDirectoryRoot(options.stateDir);
    this.sessionId = safeId(options.sessionId, 'sessionId');
    this.clock = typeof options.clock === 'function' ? options.clock : () => new Date();
    this.searchTemplate = normalizeSearchTemplate(options.searchTemplate || DEFAULT_SEARCH_TEMPLATE);
    this.sessionParent = path.join(this.stateDir, 'code-clone-web-browser-sessions');
    fs.mkdirSync(this.sessionParent, { recursive: true });
    this.sessionRoot = path.join(this.sessionParent, this.sessionId);
    if (fs.existsSync(this.sessionRoot)) throw typedError('SESSION_EXISTS', 'browser session root already exists');
    fs.mkdirSync(this.sessionRoot, { recursive: false });
    this.profileDir = path.join(this.sessionRoot, 'ephemeral-chromium-profile');
    this.evidenceDir = path.join(this.sessionRoot, 'evidence');
    fs.mkdirSync(this.profileDir, { recursive: false });
    fs.mkdirSync(this.evidenceDir, { recursive: false });
    this.logPath = path.join(this.sessionRoot, 'curiosity-targets.jsonl');
    this.logger = new CuriosityLogger(this.logPath, this.sessionId, this.clock);
    this.child = null;
    this.pipe = null;
    this.browserContextId = null;
    this.targetId = null;
    this.cdpSessionId = null;
    this.currentUrl = 'about:blank';
    this.closed = false;
    this.browser = null;
  }

  browserArguments(noSandbox) {
    return [
      ...(this.options.visible === true ? [] : ['--headless']),
      '--remote-debugging-pipe',
      `--user-data-dir=${this.profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--window-size=1440,1000',
      ...(noSandbox ? ['--no-sandbox'] : []),
      'about:blank'
    ];
  }

  async open() {
    const discovery = discoverBrowser(this.options.browserExecutable || null);
    const startTarget = { requestedUrl: 'about:blank', sourceUrl: null, finalUrl: null, selector: null, searchProvider: null };
    this.logger.append('SESSION_START_REQUEST', null, startTarget, { state: 'REQUESTED', browserDiscovery: discovery.state, browserSource: discovery.source });
    if (discovery.state !== 'AVAILABLE') {
      this.logger.append('SESSION_START_FAILURE', null, startTarget, { state: 'FAILED', errorCode: 'BROWSER_MISSING', message: discovery.reason });
      this.removeProfile();
      throw typedError('BROWSER_MISSING', discovery.reason, discovery);
    }
    const noSandbox = this.options.noSandbox === true;
    const args = Array.isArray(this.options.launchArguments) ? this.options.launchArguments.slice() : this.browserArguments(noSandbox);
    try {
      this.child = spawn(discovery.executable, args, {
        stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: this.sessionRoot,
        env: Object.assign({}, process.env, { AXM_BROWSER_SESSION_ID: this.sessionId })
      });
      this.pipe = new CdpPipe(this.child, this.options.startTimeoutMs || 30000);
      const version = await this.pipe.send('Browser.getVersion', {}, null, this.options.startTimeoutMs || 30000);
      const context = await this.pipe.send('Target.createBrowserContext', { disposeOnDetach: true });
      this.browserContextId = context.browserContextId;
      const target = await this.pipe.send('Target.createTarget', { url: 'about:blank', browserContextId: this.browserContextId });
      this.targetId = target.targetId;
      const attached = await this.pipe.send('Target.attachToTarget', { targetId: this.targetId, flatten: true });
      this.cdpSessionId = attached.sessionId;
      await this.pipe.send('Page.enable', {}, this.cdpSessionId);
      await this.pipe.send('Runtime.enable', {}, this.cdpSessionId);
      this.browser = stable({
        executable: discovery.executable,
        discoverySource: discovery.source,
        product: version.product || null,
        protocolVersion: version.protocolVersion || null,
        userAgent: version.userAgent || null,
        jsVersion: version.jsVersion || null,
        headless: args.some(argument => /^--headless(?:=|$)/.test(argument)),
        visibleRequested: this.options.visible === true,
        remoteDebuggingPipe: true,
        nonDefaultEphemeralProfile: true,
        chromiumSandboxDisabled: noSandbox
      });
      const ready = this.logger.append('SESSION_READY', null, { requestedUrl: 'about:blank', sourceUrl: null, finalUrl: 'about:blank', selector: null, searchProvider: null }, { state: 'READY', browser: this.browser });
      return stable({
        schema: 'axm.mirror.code-clone-web-browser-session-ready/v1',
        state: 'READY',
        organId: ORGAN_ID,
        sessionId: this.sessionId,
        browser: this.browser,
        log: { relativePath: path.relative(this.stateDir, this.logPath).replace(/\\/g, '/'), entryDigest: ready.entryDigest },
        capabilities: ['SEARCH', 'NAVIGATE', 'WAIT', 'OBSERVE', 'CLICK', 'TYPE', 'PRESS', 'EVALUATE', 'BACK', 'SCREENSHOT'],
        boundary: 'The browser is broad inside the disposable VM. The VM perimeter, browser process sandbox, server account, and external reset controls are the containment boundary; this organ is not a security sandbox.'
      });
    } catch (error) {
      this.logger.append('SESSION_START_FAILURE', null, startTarget, { state: 'FAILED', errorCode: error.code || 'BROWSER_START', message: String(error.message || error).slice(0, 1000) });
      await this.forceStop();
      this.removeProfile();
      throw error;
    }
  }

  ensureOpen() {
    if (this.closed || !this.pipe || !this.cdpSessionId) throw typedError('SESSION_CLOSED', 'browser session is not open');
  }

  targetFor(request) {
    let requestedUrl = null;
    let searchProvider = null;
    if (request.action === 'SEARCH') {
      const template = request.input.searchTemplate || this.searchTemplate;
      requestedUrl = normalizeUrl(template.replace('{query}', encodeURIComponent(request.input.query)), 'search target');
      try { searchProvider = new URL(requestedUrl).hostname; } catch { searchProvider = null; }
    } else if (request.action === 'NAVIGATE') requestedUrl = request.input.url;
    return {
      requestedUrl,
      sourceUrl: this.currentUrl,
      finalUrl: null,
      selector: request.input.selector,
      searchProvider
    };
  }

  async evaluate(expression, timeoutMs) {
    const response = await this.pipe.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    }, this.cdpSessionId, timeoutMs);
    if (response.exceptionDetails) throw typedError('PAGE_EVALUATION', response.exceptionDetails.text || 'page evaluation failed', response.exceptionDetails);
    if (!response.result) return null;
    if (Object.prototype.hasOwnProperty.call(response.result, 'value')) return response.result.value;
    if (response.result.unserializableValue) return response.result.unserializableValue;
    return response.result.description == null ? null : response.result.description;
  }

  async pageIdentity(timeoutMs) {
    const value = await this.evaluate('(() => ({ url: String(location.href), title: String(document.title || "") }))()', timeoutMs);
    if (value && value.url) this.currentUrl = value.url;
    return value || { url: this.currentUrl, title: '' };
  }

  async pageClassification(timeoutMs) {
    const value = await this.evaluate('(() => ({ url: String(location.href), title: String(document.title || ""), readyState: String(document.readyState), text: String(document.body ? document.body.innerText : "").slice(0, 8000) }))()', timeoutMs);
    if (value && value.url) this.currentUrl = value.url;
    const pageClass = classifyPage(value || {});
    return {
      url: value && value.url ? value.url : this.currentUrl,
      title: value && value.title ? value.title : '',
      readyState: value && value.readyState ? value.readyState : 'unknown',
      pageClass,
      visibleTextCharacters: value && typeof value.text === 'string' ? value.text.length : 0,
      visibleTextSha256: value && typeof value.text === 'string' ? sha256(value.text) : null
    };
  }

  async waitReady(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let last = 'unknown';
    while (Date.now() < deadline) {
      try {
        last = await this.evaluate('String(document.readyState)', Math.min(2000, Math.max(100, deadline - Date.now())));
        if (last === 'interactive' || last === 'complete') {
          await sleep(100);
          return last;
        }
      } catch (error) {
        if (error.code !== 'PAGE_EVALUATION' && error.code !== 'CDP_COMMAND') throw error;
      }
      await sleep(100);
    }
    throw typedError('PAGE_READY_TIMEOUT', `page did not become interactive within ${timeoutMs} ms`, { lastReadyState: last });
  }

  async navigate(url, timeoutMs) {
    const response = await this.pipe.send('Page.navigate', { url }, this.cdpSessionId, timeoutMs);
    if (response.errorText) throw typedError('NAVIGATION', response.errorText, response);
    await this.waitReady(timeoutMs);
    return this.pageClassification(timeoutMs);
  }

  async observe(request) {
    const maximumText = request.limits.maxTextChars;
    const maximumLinks = request.limits.maxLinks;
    const expression = `(() => {
      const visible = element => { const s = getComputedStyle(element); const r = element.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
      const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim();
      const links = Array.from(document.querySelectorAll('a[href]')).filter(visible).slice(0, ${maximumLinks}).map((a, index) => ({ index, text: normalize(a.innerText || a.textContent).slice(0, 500), href: String(a.href), rel: String(a.rel || '') }));
      return { url: String(location.href), title: String(document.title || ''), readyState: String(document.readyState), text: String(document.body ? document.body.innerText : '').slice(0, ${maximumText}), links };
    })()`;
    const value = await this.evaluate(expression, request.limits.timeoutMs);
    if (value && value.url) this.currentUrl = value.url;
    value.pageClass = classifyPage(value);
    return value;
  }

  async execute(request, target) {
    const timeoutMs = request.limits.timeoutMs;
    if (request.action === 'SEARCH' || request.action === 'NAVIGATE') {
      const page = await this.navigate(target.requestedUrl, timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'NAVIGATION', page };
    }
    if (request.action === 'WAIT') {
      await sleep(request.input.waitMs);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'WAIT', waitedMs: request.input.waitMs, page };
    }
    if (request.action === 'OBSERVE') return { kind: 'PAGE_OBSERVATION', page: await this.observe(request) };
    if (request.action === 'CLICK') {
      const selector = JSON.stringify(request.input.selector);
      const clicked = await this.evaluate(`(() => { const e = document.querySelector(${selector}); if (!e) return { state: 'NOT_FOUND' }; const before = String(location.href); const summary = { tag: String(e.tagName || ''), text: String(e.innerText || e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 500), href: e.href ? String(e.href) : null }; e.click(); return { state: 'CLICKED', beforeUrl: before, summary }; })()`, timeoutMs);
      if (!clicked || clicked.state !== 'CLICKED') throw typedError('SELECTOR_NOT_FOUND', `CLICK selector not found: ${request.input.selector}`);
      await sleep(250);
      await this.waitReady(timeoutMs);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'CLICK', clicked, page };
    }
    if (request.action === 'TYPE') {
      const selector = JSON.stringify(request.input.selector);
      const clear = request.input.clear === true;
      const focused = await this.evaluate(`(() => { const e = document.querySelector(${selector}); if (!e) return { state: 'NOT_FOUND' }; e.focus(); if (${clear ? 'true' : 'false'}) { if ('value' in e) e.value = ''; else if (e.isContentEditable) e.textContent = ''; e.dispatchEvent(new Event('input', { bubbles: true })); } return { state: 'FOCUSED', tag: String(e.tagName || ''), type: String(e.type || ''), contentEditable: Boolean(e.isContentEditable) }; })()`, timeoutMs);
      if (!focused || focused.state !== 'FOCUSED') throw typedError('SELECTOR_NOT_FOUND', `TYPE selector not found: ${request.input.selector}`);
      await this.pipe.send('Input.insertText', { text: request.input.text }, this.cdpSessionId, timeoutMs);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'TYPE', focused, insertedCharacters: request.input.text.length, insertedTextSha256: sha256(request.input.text), page };
    }
    if (request.action === 'PRESS') {
      if (request.input.selector) {
        const selector = JSON.stringify(request.input.selector);
        const focused = await this.evaluate(`(() => { const e = document.querySelector(${selector}); if (!e) return false; e.focus(); return true; })()`, timeoutMs);
        if (!focused) throw typedError('SELECTOR_NOT_FOUND', `PRESS selector not found: ${request.input.selector}`);
      }
      const key = request.input.key;
      const keyCode = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
      const params = { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
      await this.pipe.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, params, key.length === 1 ? { text: key } : {}), this.cdpSessionId, timeoutMs);
      await this.pipe.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, params), this.cdpSessionId, timeoutMs);
      await sleep(250);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'PRESS', key, page };
    }
    if (request.action === 'EVALUATE') {
      const result = await this.evaluate(request.input.expression, timeoutMs);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'EVALUATE', result, page };
    }
    if (request.action === 'BACK') {
      const history = await this.pipe.send('Page.getNavigationHistory', {}, this.cdpSessionId, timeoutMs);
      const index = Number(history.currentIndex);
      if (!Array.isArray(history.entries) || index <= 0) return { kind: 'BACK', state: 'NO_PREVIOUS_ENTRY', page: await this.pageIdentity(timeoutMs) };
      await this.pipe.send('Page.navigateToHistoryEntry', { entryId: history.entries[index - 1].id }, this.cdpSessionId, timeoutMs);
      await this.waitReady(timeoutMs);
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'BACK', state: 'NAVIGATED', page };
    }
    if (request.action === 'SCREENSHOT') {
      const capture = await this.pipe.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: request.input.fullPage === true }, this.cdpSessionId, timeoutMs);
      const bytes = Buffer.from(String(capture.data || ''), 'base64');
      if (!bytes.length || bytes.length > request.limits.maxScreenshotBytes) throw typedError('SCREENSHOT_SIZE', `screenshot bytes must be 1 through ${request.limits.maxScreenshotBytes}`);
      const output = assertInside(this.sessionRoot, path.join(this.evidenceDir, `${request.requestId}.png`), 'screenshot');
      fs.writeFileSync(output, bytes, { flag: 'wx' });
      const page = await this.pageIdentity(timeoutMs);
      target.finalUrl = page.url;
      return { kind: 'SCREENSHOT', page, artifact: { relativePath: path.relative(this.stateDir, output).replace(/\\/g, '/'), bytes: bytes.length, sha256: sha256(bytes), mediaType: 'image/png' } };
    }
    throw typedError('ACTION', `action ${request.action} is not executable in the open session`);
  }

  async act(input) {
    this.ensureOpen();
    const request = normalizeRequest(input);
    if (request.sessionId !== this.sessionId) throw typedError('SESSION_BINDING', 'browser request sessionId does not match the open session');
    const target = this.targetFor(request);
    const requestLog = this.logger.append('ACTION_REQUEST', request, target, { state: 'REQUESTED' });
    if (request.action === 'CLOSE') return this.close(request, requestLog);
    try {
      const raw = await this.execute(request, target);
      const bounded = trimResult(raw, request.limits.maxResultBytes);
      if (raw && raw.page && raw.page.url) target.finalUrl = raw.page.url;
      const resultLog = this.logger.append('ACTION_RESULT', request, target, {
        state: 'PASS',
        resultKind: raw.kind || null,
        resultBytes: bounded.bytes,
        resultSha256: bounded.sha256,
        resultTruncated: bounded.truncated,
        observedTitle: raw.page && raw.page.title ? String(raw.page.title).slice(0, 500) : null,
        observedPageClass: raw.page && raw.page.pageClass ? raw.page.pageClass : null,
        observedTextCharacters: raw.page && typeof raw.page.text === 'string' ? raw.page.text.length : null,
        observedLinks: raw.page && Array.isArray(raw.page.links) ? raw.page.links.length : null
      });
      const receipt = stable({
        schema: RECEIPT_SCHEMA,
        receiptDigest: null,
        organId: ORGAN_ID,
        sessionId: this.sessionId,
        requestId: request.requestId,
        requestDigest: sha256(request),
        action: request.action,
        state: 'PASS',
        target: clone(target),
        result: bounded.value,
        error: null,
        log: { requestEntryDigest: requestLog.entryDigest, resultEntryDigest: resultLog.entryDigest, relativePath: path.relative(this.stateDir, this.logPath).replace(/\\/g, '/') },
        authority: { browserAction: true, vmBoundaryRequired: true, decisionAuthority: false, evidenceAdmission: false, trainingAdmission: false, parentMirrorWrite: false, canonChange: false },
        boundary: 'This receipt proves what the browser hand requested and observed inside one session. It does not prove source truth, independent usefulness, safe content, complete network logging, external continuity, or CANON.'
      });
      receipt.receiptDigest = sha256(receiptDigestBasis(receipt));
      return receipt;
    } catch (error) {
      const failure = { code: error.code || 'BROWSER_ACTION', message: String(error.message || error).slice(0, 2000), detailsDigest: error.details == null ? null : sha256(error.details) };
      const failureLog = this.logger.append('ACTION_FAILURE', request, target, { state: 'FAILED', errorCode: failure.code, message: failure.message, detailsDigest: failure.detailsDigest });
      const receipt = stable({
        schema: RECEIPT_SCHEMA,
        receiptDigest: null,
        organId: ORGAN_ID,
        sessionId: this.sessionId,
        requestId: request.requestId,
        requestDigest: sha256(request),
        action: request.action,
        state: 'FAILED',
        target: clone(target),
        result: null,
        error: failure,
        log: { requestEntryDigest: requestLog.entryDigest, resultEntryDigest: failureLog.entryDigest, relativePath: path.relative(this.stateDir, this.logPath).replace(/\\/g, '/') },
        authority: { browserAction: true, vmBoundaryRequired: true, decisionAuthority: false, evidenceAdmission: false, trainingAdmission: false, parentMirrorWrite: false, canonChange: false },
        boundary: 'The failed target and reason remain append-only evidence. Failure does not become a pass, lesson, permission, or source-truth claim.'
      });
      receipt.receiptDigest = sha256(receiptDigestBasis(receipt));
      return receipt;
    }
  }

  async close(request = null, requestLog = null) {
    if (this.closed) {
      const receipt = stable({ schema: RECEIPT_SCHEMA, receiptDigest: null, organId: ORGAN_ID, sessionId: this.sessionId, requestId: request ? request.requestId : null, requestDigest: request ? sha256(request) : null, action: 'CLOSE', state: 'ALREADY_CLOSED', target: null, result: null, error: null, log: { requestEntryDigest: requestLog ? requestLog.entryDigest : null, resultEntryDigest: this.logger.previousDigest, relativePath: path.relative(this.stateDir, this.logPath).replace(/\\/g, '/') }, authority: { browserAction: true, vmBoundaryRequired: true, decisionAuthority: false, evidenceAdmission: false, trainingAdmission: false, parentMirrorWrite: false, canonChange: false }, boundary: 'Session was already closed.' });
      receipt.receiptDigest = sha256(receiptDigestBasis(receipt));
      return receipt;
    }
    let closeError = null;
    try {
      if (this.pipe && this.browserContextId) await this.pipe.send('Target.disposeBrowserContext', { browserContextId: this.browserContextId }, null, 5000).catch(error => { closeError = error; });
      if (this.pipe && !this.pipe.closed) await this.pipe.send('Browser.close', {}, null, 5000).catch(error => { closeError = closeError || error; });
      await this.waitForExit(3000);
    } finally {
      await this.forceStop();
      this.removeProfile();
      this.closed = true;
    }
    const target = { requestedUrl: null, sourceUrl: this.currentUrl, finalUrl: this.currentUrl, selector: null, searchProvider: null };
    const closeLog = this.logger.append('SESSION_CLOSED', request, target, { state: closeError ? 'CLOSED_WITH_PROTOCOL_ERROR' : 'CLOSED', errorCode: closeError ? closeError.code || 'CLOSE' : null, ephemeralProfileRemoved: !fs.existsSync(this.profileDir) });
    const receipt = stable({
      schema: RECEIPT_SCHEMA,
      receiptDigest: null,
      organId: ORGAN_ID,
      sessionId: this.sessionId,
      requestId: request ? request.requestId : null,
      requestDigest: request ? sha256(request) : null,
      action: 'CLOSE',
      state: closeError ? 'CLOSED_WITH_PROTOCOL_ERROR' : 'PASS',
      target,
      result: { ephemeralProfileRemoved: !fs.existsSync(this.profileDir), curiosityLog: verifyCuriosityLog(this.logPath) },
      error: closeError ? { code: closeError.code || 'CLOSE', message: String(closeError.message || closeError).slice(0, 2000), detailsDigest: closeError.details == null ? null : sha256(closeError.details) } : null,
      log: { requestEntryDigest: requestLog ? requestLog.entryDigest : null, resultEntryDigest: closeLog.entryDigest, relativePath: path.relative(this.stateDir, this.logPath).replace(/\\/g, '/') },
      authority: { browserAction: true, vmBoundaryRequired: true, decisionAuthority: false, evidenceAdmission: false, trainingAdmission: false, parentMirrorWrite: false, canonChange: false },
      boundary: 'The ephemeral Chromium profile was removed; the compact target log and explicitly requested evidence remain.'
    });
    receipt.receiptDigest = sha256(receiptDigestBasis(receipt));
    return receipt;
  }

  waitForExit(timeoutMs) {
    if (!this.child || this.child.exitCode != null || this.child.signalCode != null) return Promise.resolve();
    return new Promise(resolve => {
      const timer = setTimeout(resolve, timeoutMs);
      this.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }

  async forceStop() {
    if (!this.child || this.child.exitCode != null || this.child.signalCode != null) return;
    this.child.kill('SIGTERM');
    await this.waitForExit(1500);
    if (this.child.exitCode == null && this.child.signalCode == null) {
      this.child.kill('SIGKILL');
      await this.waitForExit(1500);
    }
  }

  removeProfile() {
    if (!fs.existsSync(this.profileDir)) return;
    assertInside(this.sessionRoot, this.profileDir, 'ephemeral profile');
    if (path.basename(this.profileDir) !== 'ephemeral-chromium-profile') throw typedError('PROFILE_BOUNDARY', 'ephemeral profile leaf changed');
    fs.rmSync(this.profileDir, { recursive: true, force: false });
  }
}

async function openSession(options) {
  const session = new BrowserSession(options || {});
  const ready = await session.open();
  return { session, ready };
}

function verifyReceipt(receipt) {
  if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.organId !== ORGAN_ID) throw typedError('RECEIPT', 'browser receipt identity is invalid');
  if (receipt.receiptDigest !== sha256(receiptDigestBasis(receipt))) throw typedError('RECEIPT_DIGEST', 'browser receipt digest changed');
  if (!receipt.authority || receipt.authority.decisionAuthority !== false || receipt.authority.evidenceAdmission !== false || receipt.authority.trainingAdmission !== false || receipt.authority.parentMirrorWrite !== false || receipt.authority.canonChange !== false) throw typedError('RECEIPT_AUTHORITY', 'browser receipt authority changed');
  return true;
}

module.exports = {
  ORGAN_ID,
  REQUEST_SCHEMA,
  RECEIPT_SCHEMA,
  LOG_SCHEMA,
  ACTIONS,
  LANGUAGE_SOURCES,
  DEFAULT_SEARCH_TEMPLATE,
  stable,
  canonical,
  sha256,
  normalizeRequest,
  normalizeSearchTemplate,
  discoverBrowser,
  verifyCuriosityLog,
  verifyReceipt,
  classifyPage,
  BrowserSession,
  openSession
};
