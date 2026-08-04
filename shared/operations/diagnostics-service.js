'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('./operations-utils');
const SeamAudit = require('../../hub/module-seam-audit');
const EvidenceRetention = require('../evidence-retention/evidence-retention-service');

const SNAPSHOT_SCHEMA = 'axm.diagnostics-snapshot/v2';
const LOG_CATALOG_SCHEMA = 'axm.diagnostics-log-source-catalog/v1';
const LOG_ENVELOPE_SCHEMA = 'axm.diagnostics-log-envelope/v1';
const EXPORT_LINEAGE_SCHEMA = 'axm.diagnostics-export-lineage/v1';
const EXPORT_RECEIPT_SCHEMA = 'axm.diagnostics-export-receipt/v1';
const PROBE_STATES = new Set(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'NOT_CONFIGURED']);
const SENSITIVE_KEY = /(?:pass(?:word|phrase)?|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential)/i;

function create(options) {
  const root = options.root;
  const exportDir = path.join(options.exportRoot, 'diagnostics');
  const lineageFile = path.join(options.stateRoot, 'diagnostics', 'export-lineage.json');
  const evidenceRetention = options.evidenceRetentionService || EvidenceRetention.forStateRoot(options.stateRoot);

  function safeMessage(error) {
    let text = String(error && error.message || error || 'unknown diagnostic probe failure');
    for (const privateRoot of [root, options.stateRoot, options.exportRoot, options.logRoot].filter(Boolean)) {
      text = text.split(String(privateRoot)).join('[WORKSHOP_PATH]');
      text = text.split(String(privateRoot).replace(/\\/g, '/')).join('[WORKSHOP_PATH]');
    }
    return redactPatterns(text, { patternMatches: 0 }).text.slice(0, 240);
  }

  function disk() {
    try {
      const stat = fs.statfsSync(root);
      return { totalBytes: stat.blocks * stat.bsize, freeBytes: stat.bavail * stat.bsize, measured: true };
    } catch (_) {
      return { totalBytes: null, freeBytes: null, measured: false };
    }
  }

  function manifestStats() {
    const rows = [], tools = path.join(root, 'tools');
    for (const entry of fs.readdirSync(tools, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      try { rows.push(JSON.parse(fs.readFileSync(path.join(tools, entry.name, 'manifest.json'), 'utf8'))); }
      catch (_) { rows.push({ status: 'UNREADABLE' }); }
    }
    const statuses = {};
    rows.forEach(manifest => { statuses[manifest.status || 'UNKNOWN'] = (statuses[manifest.status || 'UNKNOWN'] || 0) + 1; });
    const seam = SeamAudit.auditModules(root);
    return { count: rows.length, statuses, lifecycleGaps: seam.gapCount, modulesWithGaps: seam.openModuleCount };
  }

  function assessed(state, evidence, issue) {
    if (!PROBE_STATES.has(state)) throw new Error('unsupported diagnostic probe state');
    return { state, evidence, issue: issue || null };
  }

  function runProbe(spec) {
    const started = process.hrtime.bigint(), observedAt = U.now();
    if (spec.configured === false) return { id: spec.id, label: spec.label, required: !!spec.required, state: 'NOT_CONFIGURED', observedAt, durationMs: 0, evidence: null, issue: { code: 'SOURCE_NOT_CONFIGURED', message: spec.label + ' is not configured in this host.' } };
    try {
      const value = spec.read(), result = spec.assess ? spec.assess(value) : assessed('HEALTHY', value);
      return { id: spec.id, label: spec.label, required: !!spec.required, state: result.state, observedAt, durationMs: Number((process.hrtime.bigint() - started) / 1000000n), evidence: result.evidence, issue: result.issue };
    } catch (error) {
      return { id: spec.id, label: spec.label, required: !!spec.required, state: 'UNAVAILABLE', observedAt, durationMs: Number((process.hrtime.bigint() - started) / 1000000n), evidence: null, issue: { code: 'PROBE_FAILED', message: spec.label + ' probe is unavailable: ' + safeMessage(error) } };
    }
  }

  function serviceProbe(id, label, service, method, required, assess) {
    return { id, label, required, configured: !!service && typeof service[method] === 'function', read: () => service[method](), assess };
  }

  function readLineage() {
    if (!fs.existsSync(lineageFile)) return { schema: EXPORT_LINEAGE_SCHEMA, updatedAt: null, exports: [] };
    let value;
    try { value = JSON.parse(fs.readFileSync(lineageFile, 'utf8')); }
    catch (_) { throw new Error('diagnostics export lineage is unreadable'); }
    if (!value || value.schema !== EXPORT_LINEAGE_SCHEMA || !Array.isArray(value.exports)) throw new Error('diagnostics export lineage schema is invalid');
    return value;
  }

  function exportStatus() {
    const lineage = readLineage(), rows = lineage.exports.slice(-200).reverse();
    return { schema: EXPORT_LINEAGE_SCHEMA, updatedAt: lineage.updatedAt, count: rows.length, exports: U.clone(rows), automaticExport: false };
  }

  function probeSpecs() {
    const memory = () => process.memoryUsage();
    return [
      {
        id: 'runtime', label: 'Workshop runtime', required: true, read: () => {
          const value = memory();
          return { pid: process.pid, node: process.version, platform: process.platform, uptimeSeconds: Math.round(process.uptime()), rssBytes: value.rss, heapUsedBytes: value.heapUsed };
        }
      },
      {
        id: 'host', label: 'Local host', required: true, read: () => ({ hostname: os.hostname(), cpus: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), loadAverage: os.loadavg(), disk: disk() }),
        assess: value => assessed(value.disk.measured ? 'HEALTHY' : 'DEGRADED', value, value.disk.measured ? null : { code: 'DISK_CAPACITY_UNAVAILABLE', message: 'Disk capacity could not be measured on this host.' })
      },
      {
        id: 'module-contracts', label: 'Module contracts', required: true, read: manifestStats,
        assess: value => assessed(value.lifecycleGaps ? 'DEGRADED' : 'HEALTHY', value, value.lifecycleGaps ? { code: 'LIFECYCLE_GAPS', message: value.lifecycleGaps + ' lifecycle gap(s) remain across ' + value.modulesWithGaps + ' module(s).' } : null)
      },
      {
        id: 'machine-host', label: 'Machine Host', required: true, configured: !!options.machineHost && typeof options.machineHost.list === 'function', read: () => {
          const jobs = options.machineHost.list().slice(0, 12);
          return { active: options.machineHost.activeCount(), recent: jobs.map(job => ({ id: job.id, action: job.action, state: job.state, startedAt: job.startedAt, endedAt: job.endedAt })) };
        },
        assess: value => assessed(value.recent.some(job => ['FAIL', 'ERROR'].includes(job.state)) ? 'DEGRADED' : 'HEALTHY', value, value.recent.some(job => ['FAIL', 'ERROR'].includes(job.state)) ? { code: 'RECENT_JOB_FAILURE', message: 'One or more recent allowlisted jobs failed.' } : null)
      },
      serviceProbe('review-inbox', 'Review Inbox', options.reviewService, 'summary', true),
      serviceProbe('recovery', 'Recovery Center', options.recoveryService, 'status', true, value => {
        const evidence = { snapshots: value.snapshots.length, schedule: value.config, packagerActive: value.packagerActive, restoreReceipts: Array.isArray(value.restoreReceipts) ? value.restoreReceipts.length : 0, rollbackReceipts: Array.isArray(value.rollbackReceipts) ? value.rollbackReceipts.length : 0 };
        return assessed(evidence.snapshots ? 'HEALTHY' : 'DEGRADED', evidence, evidence.snapshots ? null : { code: 'NO_RECOVERY_SNAPSHOT', message: 'No retained full recovery snapshot exists yet.' });
      }),
      serviceProbe('search', 'Workshop Search', options.searchService, 'summary', true),
      serviceProbe('assets', 'Asset Filesystem', options.assetService, 'summary', true, value => assessed(value.watcherActive ? 'HEALTHY' : 'DEGRADED', value, value.watcherActive ? null : { code: 'ASSET_WATCHER_UNAVAILABLE', message: 'Recursive asset watcher is unavailable; explicit reindex remains functional.' })),
      serviceProbe('permissions', 'Permissions', options.permissionService, 'status', true, value => assessed('HEALTHY', { declaredModules: value.catalog.length, decisions: value.grants.length })),
      serviceProbe('secrets', 'Secret custody', options.secretsService, 'status', true, value => assessed(value.initialized ? 'HEALTHY' : 'DEGRADED', { initialized: value.initialized, unlocked: value.unlocked, records: value.records.length }, value.initialized ? null : { code: 'SECRET_VAULT_NOT_INITIALIZED', message: 'Encrypted secret vault has not been initialized.' })),
      serviceProbe('device-handoff', 'Device Handoff', options.deviceHandoffService, 'status', true, value => assessed('HEALTHY', { running: value.running, activeSessions: value.activeSessions.length })),
      { id: 'evidence-retention', label: 'Evidence Retention', required: true, read: () => evidenceRetention.status() },
      { id: 'diagnostic-exports', label: 'Diagnostic export lineage', required: true, read: exportStatus },
      serviceProbe('windows-offline-gate', 'Windows offline evidence gate', options.windowsOfflineGateService, 'status', false, value => {
        const evidence = { collectorAvailable: value.collectorAvailable, assessmentCount: value.assessmentCount, proofState: value.proofState, latest: value.latest };
        return assessed(value.proofState === 'HELD' ? 'DEGRADED' : 'HEALTHY', evidence, value.proofState === 'HELD' ? { code: 'WINDOWS_OFFLINE_GATE_HELD', message: 'The latest reviewed Windows offline assessment is held; inspect its named gate errors.' } : null);
      }),
      serviceProbe('qa-lab', 'Browser LAN Hardware QA Lab', options.qaLabService, 'status', false),
      serviceProbe('template-runtime', 'Template Runtime', options.templateRuntimeService, 'status', false),
      serviceProbe('source-connectors', 'Source Connector Hub', options.sourceConnectorService, 'status', false),
      serviceProbe('media-render', 'Media Render', options.mediaRenderService, 'status', false),
      serviceProbe('living-world', 'Living World', options.livingWorldStateService, 'status', false),
      serviceProbe('multiplayer-transport', 'Multiplayer Transport', options.multiplayerTransportService, 'status', false),
      serviceProbe('world-adapters', 'World Adapter Kit', options.rulesetPhysicsAdapterService, 'status', false),
      serviceProbe('mirror-world', 'Read-only Mirror World', options.mirrorWorldAdapterService, 'status', false),
      serviceProbe('novelty-diversity', 'Novelty Diversity', options.noveltyDiversityService, 'status', false),
      serviceProbe('public-release', 'Public Release', options.publicReleaseService, 'status', false)
    ];
  }

  function snapshot() {
    const probes = probeSpecs().map(runProbe), byId = new Map(probes.map(probe => [probe.id, probe]));
    const data = (id, fallback) => {
      const probe = byId.get(id);
      return probe && probe.evidence != null ? probe.evidence : fallback;
    };
    const counts = { HEALTHY: 0, DEGRADED: 0, UNAVAILABLE: 0, NOT_CONFIGURED: 0 };
    probes.forEach(probe => { counts[probe.state] += 1; });
    const requiredUnavailable = probes.filter(probe => probe.required && ['UNAVAILABLE', 'NOT_CONFIGURED'].includes(probe.state));
    const state = requiredUnavailable.length || counts.DEGRADED ? 'DEGRADED' : counts.NOT_CONFIGURED ? 'PARTIAL' : 'HEALTHY';
    const issues = probes.filter(probe => probe.issue).map(probe => ({ severity: probe.state === 'UNAVAILABLE' ? 'error' : probe.state === 'DEGRADED' ? 'warning' : 'info', area: probe.id, code: probe.issue.code, message: probe.issue.message, observedAt: probe.observedAt }));
    const operations = {
      machineHost: data('machine-host', { active: null, recent: [] }),
      review: data('review-inbox', null),
      recovery: data('recovery', { snapshots: null, schedule: null, packagerActive: null, restoreReceipts: null, rollbackReceipts: null }),
      search: data('search', null),
      assets: data('assets', null),
      permissions: data('permissions', { declaredModules: null, decisions: null }),
      secrets: data('secrets', { initialized: null, unlocked: null, records: null }),
      deviceHandoff: data('device-handoff', { running: null, activeSessions: null }),
      evidenceRetention: data('evidence-retention', null),
      diagnosticExports: data('diagnostic-exports', { count: null, exports: [] }),
      windowsOffline: data('windows-offline-gate', { collectorAvailable: null, assessmentCount: null, proofState: 'NOT_CONFIGURED', latest: null })
    };
    const waveIds = ['qa-lab', 'template-runtime', 'source-connectors', 'media-render', 'living-world', 'multiplayer-transport', 'world-adapters', 'mirror-world', 'novelty-diversity', 'public-release'];
    if (waveIds.every(id => byId.get(id).state !== 'NOT_CONFIGURED')) {
      const qa = data('qa-lab', {}), templates = data('template-runtime', {}), sources = data('source-connectors', {}), media = data('media-render', {}), world = data('living-world', {}), multiplayer = data('multiplayer-transport', {}), adapters = data('world-adapters', {}), mirror = data('mirror-world', {}), novelty = data('novelty-diversity', {}), releases = data('public-release', {});
      operations.foundationWave2 = {
        modules: 10,
        qaLab: { journeys: (qa.journeys || []).length, evidence: (qa.deviceEvidence || []).length },
        templates: { packs: templates.packCount || 0 },
        sources: { connectors: (sources.connectors || []).length, previews: (sources.previews || []).length, promoted: (sources.promoted || []).length },
        media: { jobs: (media.jobs || []).length, active: media.active || 0, ffmpeg: !!(media.engines && media.engines.ffmpeg && media.engines.ffmpeg.available) },
        world: world.world || null,
        multiplayer: { running: multiplayer.running || false, receipts: (multiplayer.receipts || []).length },
        adapters: { registered: (adapters.adapters || []).length, active: (adapters.attachments || []).filter(item => item.active).length },
        mirror: { mode: mirror.mode || null, consents: (mirror.consents || []).length, receipts: (mirror.receipts || []).length },
        novelty: { experiments: (novelty.experiments || []).length },
        releases: { candidates: (releases.releases || []).length, deployments: (releases.deployments || []).length, signingReady: !!(releases.signing && releases.signing.configured) }
      };
    }
    return {
      schema: SNAPSHOT_SCHEMA,
      checkedAt: U.now(),
      state,
      coverage: { total: probes.length, configured: probes.length - counts.NOT_CONFIGURED, required: probes.filter(probe => probe.required).length, requiredUnavailable: requiredUnavailable.map(probe => probe.id), counts },
      process: data('runtime', null),
      host: data('host', { hostname: null, cpus: null, totalMemoryBytes: null, freeMemoryBytes: null, loadAverage: null, disk: { totalBytes: null, freeBytes: null, measured: false } }),
      modules: data('module-contracts', { count: null, statuses: {}, lifecycleGaps: null, modulesWithGaps: null }),
      operations,
      probes,
      issues,
      truth: {
        probesIsolated: true,
        partialSnapshotOnProbeFailure: true,
        secretsIncluded: false,
        rawLogsIncluded: false,
        arbitraryExecution: false,
        automaticRepair: false,
        automaticRestart: false,
        automaticExport: false,
        healthIsCertification: false,
        evidenceCompactionDeletesExactEvents: false,
        mirrorApplyAuthority: false,
        automaticPublicDeploy: false,
        windowsOfflineFirstProven: operations.windowsOffline.proofState === 'PROVEN',
        windowsOfflineGateCanPublish: false
      }
    };
  }

  function redactPatterns(input, stats) {
    let text = String(input || '');
    function replace(pattern, replacement) {
      text = text.replace(pattern, function() { stats.patternMatches += 1; return typeof replacement === 'function' ? replacement.apply(null, arguments) : replacement; });
    }
    replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, '[REDACTED PRIVATE KEY]');
    replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [REDACTED]');
    replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED API KEY]');
    replace(/\b(password|passphrase|secret|token|authorization|cookie|credential|api[-_]?key|private[-_]?key)\b(\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]*)/gi, function(_, key, separator) { return key + separator + '[REDACTED]'; });
    return { text, stats };
  }

  function redactValue(value, stats) {
    if (Array.isArray(value)) return value.map(item => redactValue(item, stats));
    if (value && typeof value === 'object') {
      const output = {};
      Object.keys(value).forEach(key => {
        if (SENSITIVE_KEY.test(key)) { output[key] = '[REDACTED]'; stats.structuredFields += 1; }
        else output[key] = redactValue(value[key], stats);
      });
      return output;
    }
    if (typeof value === 'string') return redactPatterns(value, stats).text;
    return value;
  }

  function redactLog(input) {
    const stats = { structuredFields: 0, patternMatches: 0, parsedRecords: 0 };
    const lines = String(input || '').split(/\r?\n/).map(line => {
      if (!line.trim()) return '';
      try {
        const parsed = JSON.parse(line);
        stats.parsedRecords += 1;
        return JSON.stringify(redactValue(parsed, stats));
      } catch (_) { return redactPatterns(line, stats).text; }
    });
    return { text: lines.join('\n'), stats };
  }

  function sourceSpecs() {
    return [
      { id: 'workshop', label: 'Workshop process log', resolve: () => path.join(options.logRoot, 'workshop.log') },
      { id: 'machine-jobs', label: 'Machine jobs', resolve: () => options.machineHost && options.machineHost.stateFile },
      { id: 'reviews', label: 'Review Inbox', resolve: () => options.reviewService && options.reviewService.auditFile },
      { id: 'installer', label: 'Module Installer', resolve: () => options.installerService && options.installerService.auditFile },
      { id: 'recovery', label: 'Recovery Center', resolve: () => options.recoveryService && options.recoveryService.auditFile },
      { id: 'assets', label: 'Asset Filesystem', resolve: () => options.assetService && options.assetService.auditFile },
      { id: 'device-handoff', label: 'Device Handoff', resolve: () => options.deviceHandoffService && options.deviceHandoffService.auditFile },
      { id: 'secret-access', label: 'Secret access metadata', resolve: () => options.secretsService && options.secretsService.auditFile },
      { id: 'permissions', label: 'Permission decisions', resolve: () => options.permissionService && options.permissionService.auditFile },
      { id: 'windows-offline-gates', label: 'Windows offline gate assessments', resolve: () => options.windowsOfflineGateService && options.windowsOfflineGateService.stateFile },
      { id: 'qa-lab', label: 'Browser LAN Hardware QA Lab', resolve: () => options.qaLabService && options.qaLabService.auditFile },
      { id: 'templates', label: 'Template Runtime', resolve: () => options.templateRuntimeService && options.templateRuntimeService.auditFile },
      { id: 'sources', label: 'Source Connectors', resolve: () => options.sourceConnectorService && options.sourceConnectorService.auditFile },
      { id: 'media-render', label: 'Media Render', resolve: () => options.mediaRenderService && options.mediaRenderService.auditFile },
      { id: 'living-world', label: 'Living World', resolve: () => options.livingWorldStateService && options.livingWorldStateService.auditFile },
      { id: 'multiplayer', label: 'Multiplayer Transport', resolve: () => options.multiplayerTransportService && options.multiplayerTransportService.auditFile },
      { id: 'world-adapters', label: 'World Adapters', resolve: () => options.rulesetPhysicsAdapterService && options.rulesetPhysicsAdapterService.auditFile },
      { id: 'mirror-world', label: 'Mirror World', resolve: () => options.mirrorWorldAdapterService && options.mirrorWorldAdapterService.auditFile },
      { id: 'novelty', label: 'Novelty Diversity', resolve: () => options.noveltyDiversityService && options.noveltyDiversityService.auditFile },
      { id: 'releases', label: 'Public Release', resolve: () => options.publicReleaseService && options.publicReleaseService.auditFile }
    ];
  }

  function resolvedSources() {
    return sourceSpecs().map(spec => {
      let file = null, resolutionError = null;
      try { file = spec.resolve() || null; }
      catch (error) { resolutionError = safeMessage(error); }
      return { id: spec.id, label: spec.label, file, configured: !!file, recorded: !!file && fs.existsSync(file), state: resolutionError ? 'UNAVAILABLE' : file ? (fs.existsSync(file) ? 'RECORDED' : 'EMPTY_OR_RETAINED') : 'NOT_CONFIGURED', resolutionError };
    });
  }

  function logSources() {
    const sources = resolvedSources().map(source => ({ id: source.id, label: source.label, configured: source.configured, recorded: source.recorded, state: source.state, issue: source.resolutionError }));
    return { schema: LOG_CATALOG_SCHEMA, observedAt: U.now(), sources, truth: { fixedServerAllowlist: true, absolutePathsExposed: false, sourceAvailabilityObserved: true } };
  }

  function logs(kind, bytes) {
    const source = resolvedSources().find(item => item.id === kind);
    if (!source) throw new Error('diagnostic log is not allowlisted');
    if (!source.configured || source.state === 'UNAVAILABLE') throw new Error('diagnostic log source is unavailable: ' + kind);
    const limit = Math.max(1024, Math.min(200000, Number(bytes) || 50000));
    const raw = evidenceRetention.tailForSource(source.file, limit), redacted = redactLog(raw);
    let text = redacted.text, encoded = Buffer.from(text, 'utf8');
    if (encoded.length > limit) {
      encoded = encoded.subarray(encoded.length - limit);
      text = encoded.toString('utf8').replace(/^\uFFFD/, '');
      encoded = Buffer.from(text, 'utf8');
    }
    return {
      schema: LOG_ENVELOPE_SCHEMA,
      kind,
      observedAt: U.now(),
      text,
      bytesRequested: limit,
      bytesReturned: encoded.length,
      contentSha256: U.sha256(encoded),
      sourceState: source.state,
      source: 'sealed-legacy + retained-session + telemetry-rollup',
      safety: {
        rawLogReturned: false,
        mode: 'BEST_EFFORT_STRUCTURED_AND_PATTERN_REDACTION',
        parsedRecords: redacted.stats.parsedRecords,
        structuredFieldsRedacted: redacted.stats.structuredFields,
        patternMatchesRedacted: redacted.stats.patternMatches,
        secretFreeCertified: false,
        warning: 'Redaction reduces accidental exposure but does not certify arbitrary logs as secret-free.'
      }
    };
  }

  function exportReport(actor) {
    const report = Object.assign({}, snapshot(), { exportedBy: String(actor || 'local-user').slice(0, 120), exportedAt: U.now() });
    const id = U.uid('diagnostics-report'), name = id + '.json', file = path.join(exportDir, name), receiptFile = path.join(exportDir, id + '.receipt.json');
    fs.mkdirSync(exportDir, { recursive: true });
    U.atomicJson(file, report);
    const sha256 = U.fileSha256(file), bytes = fs.statSync(file).size;
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('diagnostic report verification failed');
    const receipt = { schema: EXPORT_RECEIPT_SCHEMA, id, createdAt: U.now(), actor: report.exportedBy, file: path.relative(root, file).replace(/\\/g, '/'), sha256, bytes, snapshotState: report.state, probeCounts: report.coverage.counts, automaticExport: false };
    try {
      U.atomicJson(receiptFile, receipt);
      const lineage = readLineage();
      lineage.updatedAt = receipt.createdAt;
      lineage.exports.push(receipt);
      lineage.exports = lineage.exports.slice(-200);
      U.atomicJson(lineageFile, lineage);
      return Object.assign({}, receipt, { url: '/exports/diagnostics/' + encodeURIComponent(name), receiptUrl: '/exports/diagnostics/' + encodeURIComponent(path.basename(receiptFile)), lineageSha256: U.fileSha256(lineageFile) });
    } catch (error) {
      try { fs.rmSync(file, { force: true }); } catch (_) {}
      try { fs.rmSync(receiptFile, { force: true }); } catch (_) {}
      throw error;
    }
  }

  return { snapshot, exportReport, exportStatus, logs, logSources, lineageFile };
}

module.exports = { SNAPSHOT_SCHEMA, LOG_CATALOG_SCHEMA, LOG_ENVELOPE_SCHEMA, EXPORT_LINEAGE_SCHEMA, EXPORT_RECEIPT_SCHEMA, create };
