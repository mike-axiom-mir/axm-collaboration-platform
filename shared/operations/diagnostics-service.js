'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('./operations-utils');
const SeamAudit = require('../../hub/module-seam-audit');
const EvidenceRetention = require('../evidence-retention/evidence-retention-service');

function create(options) {
  const root = options.root, exportDir = path.join(options.exportRoot, 'diagnostics'), evidenceRetention = options.evidenceRetentionService || EvidenceRetention.forStateRoot(options.stateRoot);
  function disk() { try { const stat = fs.statfsSync(root); return { totalBytes: stat.blocks * stat.bsize, freeBytes: stat.bavail * stat.bsize }; } catch (_) { return { totalBytes: null, freeBytes: null }; } }
  function manifestStats() {
    const rows = [], tools = path.join(root, 'tools');
    for (const entry of fs.readdirSync(tools, { withFileTypes: true })) if (entry.isDirectory() && !entry.name.startsWith('_')) try { const m = JSON.parse(fs.readFileSync(path.join(tools, entry.name, 'manifest.json'), 'utf8')); rows.push(m); } catch (_) {}
    const statuses = {}; rows.forEach(m => { statuses[m.status || 'UNKNOWN'] = (statuses[m.status || 'UNKNOWN'] || 0) + 1; }); return { count: rows.length, statuses };
  }
  function baseSnapshot() {
    const seam = SeamAudit.auditModules(root), jobs = options.machineHost.list(), lastJobs = jobs.slice(0, 12), review = options.reviewService.summary(), recovery = options.recoveryService.status(), search = options.searchService.summary(), assets = options.assetService.summary(), permissions = options.permissionService.status(), secrets = options.secretsService.status(), handoff = options.deviceHandoffService.status(), memory = process.memoryUsage(), issues = [];
    if (seam.gapCount) issues.push({ severity: 'warning', area: 'module-contracts', message: seam.gapCount + ' lifecycle gap(s) remain across ' + seam.openModuleCount + ' module(s).' });
    if (lastJobs.some(job => ['FAIL','ERROR'].includes(job.state))) issues.push({ severity: 'warning', area: 'machine-host', message: 'One or more recent allowlisted jobs failed.' });
    if (!recovery.snapshots.length) issues.push({ severity: 'warning', area: 'recovery', message: 'No retained full recovery snapshot exists yet.' });
    if (!secrets.initialized) issues.push({ severity: 'info', area: 'secrets', message: 'Encrypted secret vault has not been initialized.' });
    if (!assets.watcherActive) issues.push({ severity: 'info', area: 'assets', message: 'Recursive asset watcher is unavailable; manual reindex remains functional.' });
    return { schema: 'axm.diagnostics-snapshot/v1', checkedAt: U.now(), process: { pid: process.pid, node: process.version, platform: process.platform, uptimeSeconds: Math.round(process.uptime()), rssBytes: memory.rss, heapUsedBytes: memory.heapUsed }, host: { hostname: os.hostname(), cpus: os.cpus().length, totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(), loadAverage: os.loadavg(), disk: disk() }, modules: Object.assign(manifestStats(), { lifecycleGaps: seam.gapCount, modulesWithGaps: seam.openModuleCount }), operations: { machineHost: { active: options.machineHost.activeCount(), recent: lastJobs.map(job => ({ id: job.id, action: job.action, state: job.state, startedAt: job.startedAt, endedAt: job.endedAt })) }, review, recovery: { snapshots: recovery.snapshots.length, schedule: recovery.config, packagerActive: recovery.packagerActive }, search, assets, permissions: { declaredModules: permissions.catalog.length, decisions: permissions.grants.length }, secrets: { initialized: secrets.initialized, unlocked: secrets.unlocked, records: secrets.records.length }, deviceHandoff: { running: handoff.running, activeSessions: handoff.activeSessions.length }, evidenceRetention: evidenceRetention.status() }, issues, truth: { secretsIncluded: false, arbitraryExecution: false, automaticRepair: false, evidenceCompactionDeletesExactEvents: false } };
  }
  function snapshot() {
    const report = baseSnapshot(), waveServices = [options.qaLabService, options.templateRuntimeService, options.sourceConnectorService, options.mediaRenderService, options.livingWorldStateService, options.multiplayerTransportService, options.rulesetPhysicsAdapterService, options.mirrorWorldAdapterService, options.noveltyDiversityService, options.publicReleaseService];
    if (waveServices.some(service => !service)) return report;
    const services = {
      qaLab: options.qaLabService.status(), templateRuntime: options.templateRuntimeService.status(), sourceConnectors: options.sourceConnectorService.status(), mediaRender: options.mediaRenderService.status(), livingWorld: options.livingWorldStateService.status(), multiplayerTransport: options.multiplayerTransportService.status(), worldAdapters: options.rulesetPhysicsAdapterService.status(), mirrorAdapter: options.mirrorWorldAdapterService.status(), noveltyDiversity: options.noveltyDiversityService.status(), publicRelease: options.publicReleaseService.status()
    };
    report.operations.foundationWave2 = {
      modules: 10,
      qaLab: { journeys: services.qaLab.journeys.length, evidence: services.qaLab.deviceEvidence.length },
      templates: { packs: services.templateRuntime.packCount },
      sources: { connectors: services.sourceConnectors.connectors.length, previews: services.sourceConnectors.previews.length, promoted: services.sourceConnectors.promoted.length },
      media: { jobs: services.mediaRender.jobs.length, active: services.mediaRender.active, ffmpeg: services.mediaRender.engines.ffmpeg.available },
      world: services.livingWorld.world,
      multiplayer: { running: services.multiplayerTransport.running, receipts: services.multiplayerTransport.receipts.length },
      adapters: { registered: services.worldAdapters.adapters.length, active: services.worldAdapters.attachments.filter(x => x.active).length },
      mirror: { mode: services.mirrorAdapter.mode, consents: services.mirrorAdapter.consents.length, receipts: services.mirrorAdapter.receipts.length },
      novelty: { experiments: services.noveltyDiversity.experiments.length },
      releases: { candidates: services.publicRelease.releases.length, deployments: services.publicRelease.deployments.length, signingReady: services.publicRelease.signing.configured }
    };
    report.truth.worldOwner = services.livingWorld.world.owner; report.truth.mirrorApplyAuthority = false; report.truth.automaticPublicDeploy = false; return report;
  }
  function exportReport(actor) { const report = snapshot(), name = 'axm-diagnostics-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', file = path.join(exportDir, name); fs.mkdirSync(exportDir, { recursive: true }); U.atomicJson(file, Object.assign({}, report, { exportedBy: String(actor || 'local-user').slice(0, 120) })); return { file: path.relative(root, file).replace(/\\/g, '/'), url: '/exports/diagnostics/' + encodeURIComponent(name), sha256: U.fileSha256(file), bytes: fs.statSync(file).size }; }
  function logs(kind, bytes) {
    const allowed = {
      workshop: path.join(options.logRoot, 'workshop.log'),
      'machine-jobs': options.machineHost.stateFile,
      reviews: options.reviewService.auditFile,
      installer: options.installerService.auditFile,
      recovery: options.recoveryService.auditFile,
      assets: options.assetService.auditFile,
      'device-handoff': options.deviceHandoffService.auditFile,
      'secret-access': options.secretsService.auditFile,
      permissions: options.permissionService.auditFile,
      'qa-lab': options.qaLabService.auditFile,
      templates: options.templateRuntimeService.auditFile,
      sources: options.sourceConnectorService.auditFile,
      'media-render': options.mediaRenderService.auditFile,
      'living-world': options.livingWorldStateService.auditFile,
      multiplayer: options.multiplayerTransportService.auditFile,
      'world-adapters': options.rulesetPhysicsAdapterService.auditFile,
      'mirror-world': options.mirrorWorldAdapterService.auditFile,
      novelty: options.noveltyDiversityService.auditFile,
      releases: options.publicReleaseService.auditFile
    };
    if (!allowed[kind]) throw new Error('diagnostic log is not allowlisted');
    const limit = Math.max(1024, Math.min(200000, Number(bytes) || 50000));
    const text = evidenceRetention.tailForSource(allowed[kind], limit);
    return { kind, text, bytesReturned: Buffer.byteLength(text), source: 'sealed-legacy + retained-session + telemetry-rollup', secretValuesIncluded: false };
  }
  return { snapshot, exportReport, logs };
}

module.exports = { create };
