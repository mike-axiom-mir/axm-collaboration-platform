'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('./axm-workshop-updater-core');

function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeError(error) { return String(error && error.message || error || 'unknown error').replace(/[\r\n]+/g, ' ').slice(0, 500); }
function commitApiUrl(repository, ref) { return 'https://api.github.com/repos/' + repository + '/commits/' + encodeURIComponent(ref); }
function manifestUrl(repository, commitSha) { return 'https://raw.githubusercontent.com/' + repository + '/' + commitSha + '/AXM_UPDATE_MANIFEST.json'; }

function create(options) {
  if (!options || typeof options.read !== 'function' || typeof options.write !== 'function') throw new Error('Workshop updater read/write adapters required');
  if (!options.bodyPulse || typeof options.bodyPulse.request !== 'function' || typeof options.bodyPulse.complete !== 'function') throw new Error('Workshop updater requires the shared Body Pulse gate');
  const root = path.resolve(options.root || process.cwd());
  const stateRoot = path.resolve(options.stateRoot || path.join(root, 'state'));
  const stagingRoot = path.resolve(options.stagingRoot || path.join(stateRoot, 'workshop-updater', 'staging'));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Workshop updater fetch adapter required');
  let inFlight = null;
  const pulseModuleId = 'workshop-updater';

  function read() {
    try { return Core.normalize(options.read(), now()); }
    catch (error) { return Core.createState(now()); }
  }
  function write(state) {
    const value = Core.normalize(state, now());
    options.write(value);
    return value;
  }
  function trustedKeys() {
    if (Array.isArray(options.trustedKeys)) return options.trustedKeys;
    try {
      const source = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'workshop-updater', 'trusted-release-keys.json'), 'utf8'));
      return Array.isArray(source.keys) ? source.keys : [];
    } catch (error) { return []; }
  }
  function installedRelease() {
    try {
      const source = JSON.parse(fs.readFileSync(path.join(root, 'AXM_RELEASE.json'), 'utf8'));
      if (source && source.schema === 'axm.workshop-installed-release/v1' && /^[a-f0-9]{40}$/i.test(String(source.commitSha || ''))) {
        return { releaseId: source.releaseId || null, version: source.version || null, commitSha: source.commitSha, installedAt: source.installedAt || null };
      }
    } catch (error) {}
    return null;
  }
  function receipt(state, entry) {
    state.receipts.push(Object.assign({ schema: 'axm.workshop-updater.check-receipt/v1', at: nowIso(now()) }, entry));
    state.receipts = state.receipts.slice(-100);
  }
  function syncPulseModule(enabled) {
    const pulseStatus = options.bodyPulse.status();
    const existing = pulseStatus.modules.find(module => module.moduleId === pulseModuleId);
    if (!existing || existing.enabled !== enabled) {
      return options.bodyPulse.register({
        moduleId: pulseModuleId,
        name: 'Workshop Update Gate',
        goalQueueId: 'workshop-update-goals',
        enabled,
        allowMaintenance: true,
        priority: 82,
        activeCadenceMs: 3600000,
        idleCadenceMs: 86400000,
        cost: { cpu: 2, memory: 4, gpu: 0 },
        authority: 'canonical-github-read-and-signed-staging-only',
        promotionGate: 'whole-workshop-install-review'
      });
    }
    return pulseStatus;
  }
  async function fetchJson(url, maxBytes) {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'AXM-Workshop-Updater/' + Core.VERSION },
      redirect: 'error'
    });
    if (!response || !response.ok) {
      const error = new Error('GitHub read failed with HTTP ' + (response && response.status || 0));
      error.status = response && response.status || 0;
      throw error;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error('GitHub JSON response exceeded the bounded size');
    try { return JSON.parse(bytes.toString('utf8')); }
    catch (error) { throw new Error('GitHub returned invalid JSON'); }
  }
  async function downloadArchive(url, expectedSha256, expectedBytes, limitBytes, commitSha) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'codeload.github.com') throw new Error('Archive host is not allowed');
    fs.mkdirSync(stagingRoot, { recursive: true });
    const finalPath = path.join(stagingRoot, commitSha + '.zip');
    const tempPath = finalPath + '.partial-' + process.pid + '-' + Date.now();
    const response = await fetchImpl(url, { method: 'GET', headers: { 'user-agent': 'AXM-Workshop-Updater/' + Core.VERSION }, redirect: 'error' });
    if (!response || !response.ok) throw new Error('Archive download failed with HTTP ' + (response && response.status || 0));
    const declared = Number(response.headers && response.headers.get && response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > limitBytes) throw new Error('Archive exceeds the updater byte limit');
    const handle = fs.openSync(tempPath, 'wx');
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    try {
      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          const chunk = Buffer.from(part.value);
          bytes += chunk.length;
          if (bytes > limitBytes) throw new Error('Archive exceeded the updater byte limit while streaming');
          hash.update(chunk);
          fs.writeSync(handle, chunk);
        }
      } else {
        const chunk = Buffer.from(await response.arrayBuffer());
        bytes = chunk.length;
        if (bytes > limitBytes) throw new Error('Archive exceeded the updater byte limit');
        hash.update(chunk);
        fs.writeSync(handle, chunk);
      }
    } catch (error) {
      fs.closeSync(handle);
      try { fs.unlinkSync(tempPath); } catch (cleanupError) {}
      throw error;
    }
    fs.closeSync(handle);
    const digest = hash.digest('hex');
    if (bytes !== expectedBytes) { try { fs.unlinkSync(tempPath); } catch (error) {} throw new Error('Archive byte length does not match the signed manifest'); }
    if (digest !== String(expectedSha256).toLowerCase()) { try { fs.unlinkSync(tempPath); } catch (error) {} throw new Error('Archive SHA-256 does not match the signed manifest'); }
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    fs.renameSync(tempPath, finalPath);
    return { path: path.relative(root, finalPath).replace(/\\/g, '/'), bytes, sha256: digest };
  }
  function writeStagingEvidence(commitSha, manifest, trust, archive) {
    fs.mkdirSync(stagingRoot, { recursive: true });
    const file = path.join(stagingRoot, commitSha + '.candidate.json');
    const temp = file + '.partial-' + process.pid + '-' + Date.now();
    const evidence = {
      schema: 'axm.workshop-update-staging-evidence/v1',
      commitSha,
      releaseId: manifest.releaseId,
      version: manifest.version,
      manifest: clone(manifest),
      manifestDigest: crypto.createHash('sha256').update(Core.canonicalManifest(manifest)).digest('hex'),
      trust: { trusted: trust.trusted, keyId: trust.keyId, algorithm: trust.algorithm },
      archive: clone(archive),
      applyAuthority: 'NONE',
      createdAt: nowIso(now())
    };
    fs.writeFileSync(temp, JSON.stringify(evidence, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.renameSync(temp, file);
    return path.relative(root, file).replace(/\\/g, '/');
  }
  function configure(input) {
    const state = write(Core.configure(read(), input || {}, input && input.actorId || 'local-user', now()));
    syncPulseModule(state.config.enabled);
    return status();
  }
  function status() {
    const state = read();
    state.installed = installedRelease();
    const result = Core.status(state, now());
    const pulse = options.bodyPulse.status();
    const module = pulse.modules.find(item => item.moduleId === pulseModuleId);
    result.pulseBridge = {
      required: true,
      pulseMode: pulse.mode,
      moduleEnabled: !!(module && module.enabled),
      moduleStatus: module && module.lastStatus || 'REGISTERED',
      authority: module && module.authority || 'canonical-github-read-and-signed-staging-only',
      grantedChecksPerDueBeat: 1
    };
    return result;
  }
  async function performCheck(reason) {
    let state = read();
    if (!state.config.enabled) throw new Error('Workshop updater is off; no network request was made');
    const stamp = now();
    state.checking = true;
    state.lastError = null;
    state.lastReason = 'checking-canonical-github';
    state.installed = installedRelease();
    write(state);
    let networkRequests = 0;
    try {
      networkRequests += 1;
      const commit = await fetchJson(commitApiUrl(state.config.repository, state.config.ref), 524288);
      const commitSha = String(commit && commit.sha || '').toLowerCase();
      if (!/^[a-f0-9]{40}$/.test(commitSha)) throw new Error('GitHub commit response did not contain a full commit SHA');
      networkRequests += 1;
      const manifest = await fetchJson(manifestUrl(state.config.repository, commitSha), 1048576);
      const validation = Core.validateManifest(manifest, { repository: state.config.repository, commitSha });
      if (!validation.ok) throw new Error('Release manifest refused: ' + validation.errors.join('; '));
      const trust = Core.verifyManifest(manifest, trustedKeys());
      state = read();
      state.installed = installedRelease();
      state.remote = {
        repository: state.config.repository,
        ref: state.config.ref,
        commitSha,
        commitUrl: typeof commit.html_url === 'string' ? commit.html_url : null,
        committedAt: commit.commit && commit.commit.committer && commit.commit.committer.date || null,
        releaseId: manifest.releaseId,
        version: manifest.version,
        manifestTrusted: trust.trusted,
        trustedKeyId: trust.keyId,
        checkedAt: nowIso(stamp)
      };
      state.lastCheckAt = nowIso(stamp);
      state.nextCheckAt = nowIso(stamp + state.config.intervalMs);
      state.checking = false;
      if (state.installed && state.installed.commitSha === commitSha) {
        state.lastReason = 'current-release';
        receipt(state, { reason, result: 'CURRENT', commitSha, releaseId: manifest.releaseId, networkRequests, archiveDownloaded: false });
      } else if (!trust.trusted) {
        state.lastReason = 'update-held-untrusted-release';
        state.candidate = null;
        receipt(state, { reason, result: 'HELD_UNTRUSTED', commitSha, releaseId: manifest.releaseId, networkRequests, archiveDownloaded: false });
      } else if (state.config.mode === 'CHECK_ONLY') {
        state.lastReason = 'trusted-update-available';
        state.candidate = { schema: 'axm.workshop-update-candidate/v1', state: 'AVAILABLE_NOT_DOWNLOADED', releaseId: manifest.releaseId, version: manifest.version, commitSha, manifestDigest: crypto.createHash('sha256').update(Core.canonicalManifest(manifest)).digest('hex'), trustedKeyId: trust.keyId, archive: null, applyAuthority: 'NONE' };
        receipt(state, { reason, result: 'UPDATE_AVAILABLE', commitSha, releaseId: manifest.releaseId, networkRequests, archiveDownloaded: false });
      } else {
        networkRequests += 1;
        const verifiedRemote = clone(state.remote);
        const archive = await downloadArchive(manifest.archive.url, manifest.archive.sha256, Number(manifest.archive.bytes), state.config.maxArchiveBytes, commitSha);
        const evidencePath = writeStagingEvidence(commitSha, manifest, trust, archive);
        state = read();
        state.installed = installedRelease();
        state.remote = Object.assign({}, verifiedRemote, { manifestTrusted: true, trustedKeyId: trust.keyId });
        state.lastCheckAt = nowIso(stamp);
        state.nextCheckAt = nowIso(stamp + state.config.intervalMs);
        state.checking = false;
        state.lastReason = 'verified-update-staged';
        state.candidate = { schema: 'axm.workshop-update-candidate/v1', state: 'STAGED_HELD_FOR_INSTALLER', releaseId: manifest.releaseId, version: manifest.version, commitSha, manifestDigest: crypto.createHash('sha256').update(Core.canonicalManifest(manifest)).digest('hex'), trustedKeyId: trust.keyId, archive, evidencePath, applyAuthority: 'NONE' };
        receipt(state, { reason, result: 'STAGED', commitSha, releaseId: manifest.releaseId, networkRequests, archiveDownloaded: true, archiveSha256: archive.sha256, archiveBytes: archive.bytes });
      }
      write(state);
      return status();
    } catch (error) {
      state = read();
      state.installed = installedRelease();
      state.checking = false;
      state.lastCheckAt = nowIso(stamp);
      state.nextCheckAt = nowIso(stamp + state.config.intervalMs);
      state.lastReason = 'check-failed';
      state.lastError = safeError(error);
      receipt(state, { reason, result: 'FAIL', networkRequests, archiveDownloaded: false, error: state.lastError });
      write(state);
      error.updaterStatus = Core.status(state, now());
      throw error;
    }
  }
  function check(input) {
    if (!read().config.enabled) return Promise.reject(new Error('Workshop updater is off; no network request was made'));
    if (inFlight) return inFlight;
    const reason = input && input.reason === 'HEARTBEAT' ? 'HEARTBEAT' : 'EXPLICIT';
    inFlight = (async () => {
      syncPulseModule(true);
      const decision = options.bodyPulse.request({ moduleId: pulseModuleId, force: true, leaseMs: 900000 });
      if (!decision.granted) {
        const state = read();
        state.lastReason = 'pulse-held-' + decision.reason;
        state.lastError = null;
        receipt(state, { reason, result: 'HELD_BY_PULSE', pulseReason: decision.reason, networkRequests: 0, archiveDownloaded: false });
        write(state);
        return status();
      }
      try {
        const result = await performCheck(reason);
        options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'COMPLETED', summary: 'Workshop update check: ' + result.lastReason, effect: 'canonical-github-read-or-signed-staging-only' });
        return status();
      } catch (error) {
        try { options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: 'FAILED', summary: 'Workshop update check failed: ' + safeError(error), effect: 'failure-receipt-only' }); } catch (completeError) {}
        throw error;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }
  function onBeat(beat) {
    const state = read();
    if (!state.config.enabled) return Promise.resolve({ started: false, reason: 'updater-off-zero-network' });
    if (!beat || beat.kind !== 'SCHEDULED') return Promise.resolve({ started: false, reason: 'scheduled-heartbeat-required' });
    if (state.nextCheckAt && Date.parse(state.nextCheckAt) > now()) return Promise.resolve({ started: false, reason: 'updater-not-due' });
    return check({ reason: 'HEARTBEAT' }).then(result => ({ started: true, reason: result.lastReason, status: result })).catch(error => ({ started: false, reason: 'updater-check-failed', error: safeError(error) }));
  }

  let initial = read();
  if (initial.checking) {
    initial.checking = false;
    initial.lastReason = 'interrupted-check-recovered-on-restart';
    initial.lastError = 'The previous process ended during an updater check. No automatic retry or apply occurred.';
    receipt(initial, { reason: 'RESTART_RECOVERY', result: 'HELD_INTERRUPTED', networkRequests: 0, archiveDownloaded: false });
  }
  write(initial);
  syncPulseModule(initial.config.enabled);
  return { VERSION: Core.VERSION, status, configure, check, onBeat, commitApiUrl, manifestUrl };
}

module.exports = { create, commitApiUrl, manifestUrl };
