'use strict';

const path = require('path');
const ReviewService = require('./review-service');
const PermissionService = require('./permission-service');
const SecretsService = require('./secrets-service');
const MachineHost = require('./machine-host');
const RecoveryService = require('./recovery-service');
const InstallerService = require('./installer-service');
const WorkbenchService = require('./module-workbench-service');
const ModularIntakeService = require('../modular-intake/modular-intake-service');
const NeedsObservatoryService = require('../modular-intake/needs-observatory-service');
const ReadinessObserver = require('../readiness/readiness-observer');
const SearchService = require('./search-service');
const AssetService = require('./asset-filesystem-service');
const DeviceHandoffService = require('./device-handoff-service');
const DiagnosticsService = require('./diagnostics-service');
const QaLabService = require('./qa-lab-service');
const TemplateRuntimeService = require('./template-runtime-service');
const SourceConnectorService = require('./source-connector-service');
const MediaRenderService = require('./media-render-service');
const LivingWorldStateService = require('./living-world-state-service');
const MultiplayerTransportService = require('./multiplayer-transport-service');
const RulesetPhysicsAdapterService = require('./ruleset-physics-adapter-service');
const MirrorWorldAdapterService = require('./mirror-world-adapter-service');
const NoveltyDiversityService = require('./novelty-diversity-service');
const PublicReleaseService = require('./public-release-service');
const CognitiveResourceService = require('../cognitive-resource/cognitive-resource-service');
const CognitiveEvidenceLabsService = require('../cognitive-resource/cognitive-evidence-labs-service');
const EvidenceRetentionService = require('../evidence-retention/evidence-retention-service');
const HubLifecycleService = require('./hub-lifecycle-service');
const GitHubSyncService = require('./github-sync-service');

function create(options) {
  const evidenceRetention = EvidenceRetentionService.forStateRoot(options.stateRoot);
  const hubLifecycle = HubLifecycleService.create(options);
  const githubSync = GitHubSyncService.create(options);
  const review = ReviewService.create(options);
  const permissions = PermissionService.create(options);
  const secrets = SecretsService.create(options);
  const machine = MachineHost.create(options);
  const recovery = RecoveryService.create(Object.assign({}, options, { packager: options.packager }));
  const search = SearchService.create(options);
  const assets = AssetService.create(options);
  const handoff = DeviceHandoffService.create(options);
  const installer = InstallerService.create(Object.assign({}, options, { reviewService: review, machineHost: machine }));
  const workbench = WorkbenchService.create(Object.assign({}, options, { installerService: installer }));
  const modularIntake = ModularIntakeService.create(Object.assign({}, options, { reviewService: review, installerService: installer }));
  const needsObservatory = NeedsObservatoryService.create(Object.assign({}, options, { modularIntakeService: modularIntake }));
  const readinessObserver = ReadinessObserver.create({ root: options.root, stateRoot: options.stateRoot, humanGate: 'Mike' });
  const qa = QaLabService.create(options);
  const templates = TemplateRuntimeService.create(options);
  const sources = SourceConnectorService.create(Object.assign({}, options, { reviewService: review }));
  const media = MediaRenderService.create(Object.assign({}, options, { reviewService: review }));
  const world = LivingWorldStateService.create(options);
  const multiplayer = MultiplayerTransportService.create(options);
  const adapters = RulesetPhysicsAdapterService.create(Object.assign({}, options, { worldStateService: world }));
  const mirror = MirrorWorldAdapterService.create(Object.assign({}, options, { worldStateService: world }));
  const novelty = NoveltyDiversityService.create(options);
  const releases = PublicReleaseService.create(Object.assign({}, options, { reviewService: review, secretsService: secrets }));
  const cognitiveResources = CognitiveResourceService.create(options);
  const cognitiveLabs = CognitiveEvidenceLabsService.create(Object.assign({}, options, { meterService:cognitiveResources }));
  const diagnostics = DiagnosticsService.create(Object.assign({}, options, { reviewService: review, permissionService: permissions, secretsService: secrets, machineHost: machine, recoveryService: recovery, searchService: search, assetService: assets, deviceHandoffService: handoff, installerService: installer, qaLabService: qa, templateRuntimeService: templates, sourceConnectorService: sources, mediaRenderService: media, livingWorldStateService: world, multiplayerTransportService: multiplayer, rulesetPhysicsAdapterService: adapters, mirrorWorldAdapterService: mirror, noveltyDiversityService: novelty, publicReleaseService: releases, evidenceRetentionService: evidenceRetention }));
  recovery.startSchedule(); assets.startWatcher();

  function body(req, max) { return new Promise((resolve, reject) => options.readJsonBody(req, max, (error, parsed) => error ? reject(error) : resolve(parsed || {}))); }
  function query(req) { try { return new URL(req.url, 'http://127.0.0.1').searchParams; } catch (_) { return new URLSearchParams(); } }
  function explicit(req, name, value) { if (String(req.headers[name] || '') !== value) throw new Error(name + ': ' + value + ' header required'); }
  function actor(req, parsed) { return String(parsed && parsed.actor || req.headers['x-axm-actor'] || 'local-user').slice(0, 120); }
  function mutationAllowed() { if (options.isProductionSession) throw new Error('operations mutations are unavailable inside a temporary production session'); }
  function reply(res, promise, successCode) { Promise.resolve(promise).then(result => options.send(res, successCode || 200, { ok: true, result })).catch(error => options.send(res, /required|refused|locked|approved|confirmation|declared|not found|unavailable|expired|invalid|unsafe|limit/i.test(error.message) ? 400 : 500, { ok: false, error: String(error.message || error).slice(0, 2000) })); }
  function requirePermission(moduleId, permission) { if (!permissions.allowed(moduleId, permission)) throw new Error(moduleId + ' requires an explicit ' + permission + ' grant in Secrets & Permissions Console'); }
  function mime(ext) { return ({ '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8' })[ext] || 'application/octet-stream'; }

  function handle(req, res, context) {
    const url = context.url;
    if (!url.startsWith('/api/')) return false;

    if (url === '/api/operations/status' && req.method === 'GET') { reply(res, diagnostics.snapshot()); return true; }
    if (url === '/api/hub/lifecycle' && req.method === 'GET') { reply(res, hubLifecycle.status()); return true; }
    if (url === '/api/hub/lifecycle' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-hub-lifecycle', 'explicit-local-label'); return hubLifecycle.set(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/hub/lifecycle/batch' && req.method === 'POST') { reply(res, body(req, 200000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-hub-lifecycle', 'explicit-verified-batch'); return hubLifecycle.batch(parsed.entries, actor(req, parsed), String(parsed.source || 'verified-batch').slice(0, 80)); })); return true; }
    if (url === '/api/hub/lifecycle/reconciliation' && req.method === 'GET') { reply(res, hubLifecycle.reconciliationPlan()); return true; }
    if (url === '/api/hub/lifecycle/reconciliation' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-hub-lifecycle', 'explicit-verified-reconciliation'); return hubLifecycle.applyReconciliation(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/github-sync' && req.method === 'GET') { reply(res, githubSync.status()); return true; }
    if (url === '/api/github-sync/plan' && req.method === 'GET') { reply(res, githubSync.buildPlanSummary()); return true; }
    if (url === '/api/github-sync/plan/full' && req.method === 'POST') { reply(res, body(req, 10000).then(parsed => { explicit(req, 'x-axm-github-sync', 'export-exact-plan'); return githubSync.buildExactPlan(parsed.planDigest); })); return true; }
    if (url === '/api/github-sync/verify' && req.method === 'POST') { reply(res, body(req, 10000).then(parsed => { explicit(req, 'x-axm-github-sync', 'verify-exact-plan'); return githubSync.verifyPlan(parsed.planDigest); })); return true; }
    if (url === '/api/github-sync/configure' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-github-sync', 'explicit-configuration'); return githubSync.configure(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/github-sync/manual-push' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-github-sync', 'manual-reviewed-push'); return machine.run('github-sync-manual-reviewed', Object.assign({}, parsed, { actor: actor(req, parsed) })); }), 202); return true; }
    if (url === '/api/evidence-retention' && req.method === 'GET') { reply(res, evidenceRetention.status()); return true; }
    if (url === '/api/evidence-retention/seal' && req.method === 'POST') { reply(res, body(req, 10000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-evidence', 'explicit-seal'); return evidenceRetention.seal(String(parsed.reason || 'explicit-session-close').slice(0, 200)); })); return true; }

    if (url === '/api/recovery' && req.method === 'GET') { reply(res, recovery.status()); return true; }
    if (url === '/api/recovery/snapshot' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'explicit-snapshot'); return recovery.snapshot(actor(req, parsed), parsed.reason); })); return true; }
    if (url === '/api/recovery/configure' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'explicit-configure'); return recovery.configure(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/recovery/restore/preview' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'explicit-preview'); return recovery.preview(parsed.snapshotId, parsed.paths, actor(req, parsed)); })); return true; }
    if (url === '/api/recovery/restore/apply' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'apply-preview'); requirePermission('recovery-center','recovery.apply'); return recovery.apply(parsed.previewId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/recovery/rollback/preview' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'explicit-rollback-preview'); return recovery.previewRollback(parsed.restoreId, actor(req, parsed)); })); return true; }
    if (url === '/api/recovery/rollback/apply' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-recovery', 'apply-rollback-preview'); requirePermission('recovery-center','recovery.apply'); return recovery.applyRollback(parsed.previewId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }

    if (url === '/api/machine-host/actions' && req.method === 'GET') { reply(res, { actions: machine.actions(), arbitraryCommands: false }); return true; }
    if (url === '/api/machine-host/jobs' && req.method === 'GET') { const id = query(req).get('id'); reply(res, id ? machine.get(id) : machine.list()); return true; }
    if (url === '/api/machine-host/run' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-machine-host', 'explicit-run'); requirePermission('machine-host','machine.execute'); return machine.run(String(parsed.action || ''), parsed); }), 202); return true; }
    if (url === '/api/machine-host/stop' && req.method === 'POST') { reply(res, body(req, 10000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-machine-host', 'explicit-stop'); requirePermission('machine-host','machine.execute'); return machine.stop(parsed.id); })); return true; }

    if (url === '/api/reviews' && req.method === 'GET') { reply(res, { items: review.list({ state: query(req).get('state') || '' }), summary: review.summary(), structuralReview: readinessObserver.snapshot() }); return true; }
    if (url === '/api/reviews' && req.method === 'POST') { reply(res, body(req, 200000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-review', 'explicit-submit'); return review.submit(parsed); })); return true; }
    if (url === '/api/reviews/vote' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-review', 'exact-digest-vote'); if (parsed.confirmation !== 'REVIEW EXACT DIGEST') throw new Error('exact review confirmation is required'); return review.vote(parsed.id, parsed); })); return true; }
    if (url === '/api/reviews/discuss' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-review', 'explicit-discussion'); return review.discuss(parsed.id, parsed); })); return true; }
    if (url === '/api/reviews/route' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-review', 'explicit-decision-pool-route'); if (parsed.confirmation !== 'ROUTE REVIEW ITEM') throw new Error('exact decision-pool confirmation is required'); return review.route(parsed.id, parsed); })); return true; }

    if (url === '/api/installer' && req.method === 'GET') { const moduleId = query(req).get('moduleId'); reply(res, { candidates: installer.list(), backups: moduleId ? installer.backups(moduleId) : [] }); return true; }
    if (url === '/api/installer/stage' && req.method === 'POST') { reply(res, body(req, 45 * 1024 * 1024).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-installer', 'explicit-stage'); return installer.stage(parsed.bundle || parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/installer/stage-return' && req.method === 'POST') { reply(res, body(req, 43 * 1024 * 1024).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-installer', 'explicit-return-stage'); return installer.stageReturnedZip(parsed.return || parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/installer/apply' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-installer', 'apply-approved-digest'); requirePermission('module-installer','module.install'); return installer.apply(parsed.candidateId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/installer/rollback' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-installer', 'explicit-rollback'); requirePermission('module-installer','module.install'); return installer.rollback(parsed.moduleId, parsed.backupId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }

    if (url === '/api/module-workbench' && req.method === 'GET') { const id = query(req).get('id'); reply(res, id ? workbench.readModule(id) : workbench.modules()); return true; }
    if (url === '/api/module-workbench/validate' && req.method === 'POST') { reply(res, body(req, 1000000).then(parsed => workbench.validate(parsed))); return true; }
    if (url === '/api/module-workbench/stage' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-module-workbench', 'explicit-stage-review'); return workbench.stage(parsed, actor(req, parsed)); })); return true; }

    if (url === '/api/modular-intake' && req.method === 'GET') { reply(res, modularIntake.status()); return true; }
    if (url === '/api/modular-intake/inspect' && req.method === 'POST') { reply(res, body(req, 45 * 1024 * 1024).then(parsed => modularIntake.inspect(parsed.package || parsed))); return true; }
    if (url === '/api/modular-intake/stage' && req.method === 'POST') { reply(res, body(req, 45 * 1024 * 1024).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-modular-intake', 'explicit-quarantine'); return modularIntake.stage(parsed.package || parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/modular-intake/review' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-modular-intake', 'open-exact-review'); return modularIntake.openReview(parsed.candidateId, actor(req, parsed)); })); return true; }
    if (url === '/api/modular-intake/promote' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-modular-intake', 'promote-approved-digest'); requirePermission('modular-intake-gate','component.promote'); return modularIntake.promote(parsed.candidateId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/modular-intake/family/propose' && req.method === 'POST') { reply(res, body(req, 200000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-modular-intake', 'propose-neutral-family'); return modularIntake.proposeFamily(parsed.contract || parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/modular-intake/family/apply' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-modular-intake', 'register-approved-family'); requirePermission('modular-intake-gate','component.family.register'); return modularIntake.applyFamily(parsed.proposalId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }

    if (url === '/api/workshop-needs' && req.method === 'GET') { reply(res, needsObservatory.status()); return true; }
    if (url === '/api/workshop-needs/create' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-needs', 'explicit-create'); return needsObservatory.createNeed(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/workshop-needs/match' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-needs', 'exact-capability-match'); return needsObservatory.match(parsed.needId, parsed.candidateId, actor(req, parsed)); })); return true; }
    if (url === '/api/workshop-needs/transition' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-needs', 'explicit-transition'); return needsObservatory.transition(parsed.needId, Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }

    if (url === '/api/permissions' && req.method === 'GET') { reply(res, permissions.status()); return true; }
    if (url === '/api/permissions/decision' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-permission', 'explicit-decision'); if (parsed.confirmation !== 'SET MODULE PERMISSION') throw new Error('exact permission confirmation is required'); return permissions.setGrant(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/secrets' && req.method === 'GET') { reply(res, secrets.status()); return true; }
    if (url === '/api/secrets/initialize' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-secrets', 'explicit-initialize'); return secrets.initialize(parsed.passphrase, actor(req, parsed)); })); return true; }
    if (url === '/api/secrets/unlock' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-secrets', 'explicit-unlock'); return secrets.unlock(parsed.passphrase, actor(req, parsed)); })); return true; }
    if (url === '/api/secrets/lock' && req.method === 'POST') { reply(res, Promise.resolve().then(() => { mutationAllowed(); explicit(req, 'x-axm-secrets', 'explicit-lock'); return secrets.lock(); })); return true; }
    if (url === '/api/secrets/upsert' && req.method === 'POST') { reply(res, body(req, 200000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-secrets', 'explicit-store'); return secrets.upsert(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/secrets/revoke' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-secrets', 'explicit-revoke'); if (parsed.confirmation !== 'REVOKE SECRET') throw new Error('exact secret revocation confirmation is required'); return secrets.revoke(parsed.id, actor(req, parsed)); })); return true; }

    if (url === '/api/diagnostics' && req.method === 'GET') { reply(res, diagnostics.snapshot()); return true; }
    if (url === '/api/diagnostics/log-sources' && req.method === 'GET') { reply(res, diagnostics.logSources()); return true; }
    if (url === '/api/diagnostics/logs' && req.method === 'GET') { reply(res, diagnostics.logs(query(req).get('kind') || 'workshop', query(req).get('bytes'))); return true; }
    if (url === '/api/diagnostics/exports' && req.method === 'GET') { reply(res, diagnostics.exportStatus()); return true; }
    if (url === '/api/diagnostics/export' && req.method === 'POST') { reply(res, body(req, 10000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-diagnostics', 'explicit-export'); return diagnostics.exportReport(actor(req, parsed)); })); return true; }

    if (url === '/api/search' && req.method === 'GET') { const params = query(req), q = params.get('q'); reply(res, q ? search.search(q, { limit: params.get('limit'), prefix: params.get('prefix') }) : search.summary()); return true; }
    if (url === '/api/search/reindex' && req.method === 'POST') { reply(res, Promise.resolve().then(() => { mutationAllowed(); explicit(req, 'x-axm-search', 'explicit-reindex'); return search.build(); })); return true; }

    if (url === '/api/assets/filesystem' && req.method === 'GET') { const params = query(req); reply(res, params.has('q') || params.has('kind') ? { assets: assets.list({ q: params.get('q'), kind: params.get('kind'), limit: params.get('limit') }), summary: assets.summary() } : assets.summary()); return true; }
    if (url === '/api/assets/filesystem/file' && req.method === 'GET') {
      try { const found = assets.file(query(req).get('id')); res.writeHead(200, { 'content-type': mime(found.item.extension), 'content-length': found.item.bytes, 'content-disposition': 'attachment; filename="' + found.item.name.replace(/["\r\n]/g, '_') + '"', 'x-content-type-options': 'nosniff' }); require('fs').createReadStream(found.absolute).pipe(res); } catch (error) { options.send(res, 404, { ok: false, error: error.message }); } return true;
    }
    if (url === '/api/assets/filesystem/reindex' && req.method === 'POST') { reply(res, Promise.resolve().then(() => { mutationAllowed(); explicit(req, 'x-axm-assets', 'explicit-reindex'); return assets.build(); })); return true; }
    if (url === '/api/assets/filesystem/pack' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-assets', 'explicit-pack'); return assets.createPack(parsed); })); return true; }

    if (url === '/api/device-handoff' && req.method === 'GET') { reply(res, handoff.status()); return true; }
    if (url === '/api/device-handoff/session' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-device-handoff', 'explicit-session'); requirePermission('device-handoff','device.listen'); return handoff.createSession(Object.assign({}, parsed, { actor: actor(req, parsed) })); })); return true; }
    if (url === '/api/device-handoff/stop' && req.method === 'POST') { reply(res, Promise.resolve().then(() => { mutationAllowed(); explicit(req, 'x-axm-device-handoff', 'explicit-stop'); return handoff.stop(); })); return true; }

    if (url === '/api/qa-lab' && req.method === 'GET') { reply(res, qa.status()); return true; }
    if (url === '/api/qa-lab/run' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-qa', 'explicit-run'); requirePermission('browser-lan-hardware-qa-lab','qa.run'); return qa.run(Object.assign({}, parsed, { originPort: typeof options.getPort === 'function' ? options.getPort() : options.port })); }), 202); return true; }
    if (url === '/api/qa-lab/evidence' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-qa', 'device-evidence'); return qa.recordDeviceEvidence(parsed); })); return true; }

    if (url === '/api/template-runtime' && req.method === 'GET') { reply(res, templates.status()); return true; }
    if (url === '/api/template-runtime/pack' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-template', 'explicit-save'); return templates.savePack(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/template-runtime/render' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => templates.render(parsed))); return true; }
    if (url === '/api/template-runtime/export' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-template', 'explicit-export'); return templates.exportPack(parsed.id, actor(req, parsed)); })); return true; }

    if (url === '/api/source-connectors' && req.method === 'GET') { reply(res, sources.status()); return true; }
    if (url === '/api/source-connectors/preview' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-source', 'explicit-preview'); requirePermission('source-connector-hub','network.fetch'); return sources.preview(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/source-connectors/promote' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-source', 'promote-approved-digest'); return sources.promote(parsed.previewId, parsed.reviewId, actor(req, parsed)); })); return true; }

    if (url === '/api/media-render' && req.method === 'GET') { reply(res, media.status()); return true; }
    if (url === '/api/media-render/start' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-media', 'explicit-render'); requirePermission('media-render-transcode-service','media.render'); return media.start(parsed, actor(req, parsed)); }), 202); return true; }
    if (url === '/api/media-render/cancel' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-media', 'explicit-cancel'); return media.cancel(parsed.id, actor(req, parsed)); })); return true; }

    if (url === '/api/living-worlds' && req.method === 'GET') { reply(res, { schema: 'axm.living-world-catalog/v1', worlds: world.listWorlds() }); return true; }
    if (url === '/api/living-world' && req.method === 'GET') { reply(res, world.get(query(req).get('worldId'))); return true; }
    if (url === '/api/living-world/changes' && req.method === 'GET') { const params = query(req); reply(res, world.changes(params.get('since'), params.get('worldId'))); return true; }
    if (url === '/api/living-world/create' && req.method === 'POST') { reply(res, body(req, 150000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-world', 'explicit-create-world'); requirePermission('living-world-state-server','world.mutate'); return world.createWorld(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/living-world/patch' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-world', 'expected-revision-patch'); requirePermission('living-world-state-server','world.mutate'); return world.apply(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/living-world/snapshot' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-world', 'explicit-snapshot'); return world.snapshot(actor(req, parsed), parsed.reason, parsed.worldId); })); return true; }
    if (url === '/api/living-world/restore/preview' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-world', 'explicit-restore-preview'); return world.previewRestore(parsed.snapshotId, actor(req, parsed), parsed.worldId); })); return true; }
    if (url === '/api/living-world/restore/apply' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-world', 'apply-restore-preview'); requirePermission('living-world-state-server','world.restore'); return world.restore(parsed.previewId, parsed.confirmation, actor(req, parsed), parsed.worldId); })); return true; }

    if (url === '/api/multiplayer-transport' && req.method === 'GET') { reply(res, multiplayer.status()); return true; }
    if (url === '/api/multiplayer-transport/start' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-multiplayer', 'explicit-listen'); requirePermission('multiplayer-controller-transport','network.listen'); return multiplayer.start(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/multiplayer-transport/stop' && req.method === 'POST') { reply(res, Promise.resolve().then(() => { mutationAllowed(); explicit(req, 'x-axm-multiplayer', 'explicit-stop'); return multiplayer.stop(actor(req)); })); return true; }

    if (url === '/api/world-adapters' && req.method === 'GET') { reply(res, adapters.status()); return true; }
    if (url === '/api/world-adapters/register' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-adapter', 'explicit-register'); requirePermission('living-world-ruleset-physics-adapter-kit','adapter.register'); return adapters.register(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/world-adapters/attach' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-adapter', 'expected-revision-attach'); return adapters.attach(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/world-adapters/evaluate' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => adapters.evaluate(parsed, actor(req, parsed)))); return true; }
    if (url === '/api/world-adapters/detach' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-adapter', 'explicit-detach'); return adapters.detach(parsed.id, actor(req, parsed)); })); return true; }

    if (url === '/api/mirror-world' && req.method === 'GET') { reply(res, mirror.status()); return true; }
    if (url === '/api/mirror-world/consent' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-mirror', 'explicit-consent'); return mirror.createConsent(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/mirror-world/revoke' && req.method === 'POST') { reply(res, body(req, 20000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-mirror', 'explicit-revoke'); return mirror.revoke(parsed.id, actor(req, parsed)); })); return true; }
    if (url === '/api/mirror-world/observe' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { requirePermission('read-only-mirror-world-adapter','mirror.observe'); return mirror.observe(parsed, actor(req, parsed)); })); return true; }

    if (url === '/api/novelty-diversity' && req.method === 'GET') { reply(res, novelty.status()); return true; }
    if (url === '/api/novelty-diversity/run' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-novelty', 'explicit-experiment'); return novelty.run(parsed, actor(req, parsed)); })); return true; }

    if (url === '/api/public-release' && req.method === 'GET') { reply(res, releases.status()); return true; }
    if (url === '/api/public-release/channel' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-release', 'explicit-channel'); return releases.configure(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/public-release/stage' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-release', 'explicit-stage'); return releases.stage(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/public-release/deploy' && req.method === 'POST') { reply(res, body(req, 50000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-release', 'deploy-approved-digest'); requirePermission('public-release-deployment-adapter','release.deploy'); return releases.deploy(parsed, actor(req, parsed)); })); return true; }
    if (url === '/api/public-release/rollback' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-release', 'explicit-rollback'); requirePermission('public-release-deployment-adapter','release.deploy'); return releases.rollback(parsed, actor(req, parsed)); })); return true; }

    if (url === '/api/cognitive-resource-meter' && req.method === 'GET') { reply(res, cognitiveResources.status()); return true; }
    if (url === '/api/cognitive-resource-meter/command-center-controls' && req.method === 'GET') { reply(res, cognitiveResources.status().commandCenterControls); return true; }
    if (url === '/api/cognitive-resource-meter/record' && req.method === 'GET') { reply(res, cognitiveResources.get(query(req).get('id'))); return true; }
    if (url === '/api/cognitive-resource-meter/records' && req.method === 'GET') { const q=query(req); reply(res, cognitiveResources.records({kind:q.get('kind')||null,state:q.get('state')||null,limit:Number(q.get('limit')||500)})); return true; }
    if (url === '/api/cognitive-resource-meter/vaults' && req.method === 'GET') { reply(res, cognitiveResources.vaults()); return true; }
    if (url === '/api/cognitive-resource-meter/timeline' && req.method === 'GET') { reply(res, cognitiveResources.resourceTimeline()); return true; }
    if (url === '/api/cognitive-resource-meter/preview-observation' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => cognitiveResources.previewObservation(parsed.draft))); return true; }
    if (url === '/api/cognitive-resource-meter/preview-goal-receipt' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => cognitiveResources.previewGoalReceipt(parsed.receipt))); return true; }
    if (url === '/api/cognitive-resource-meter/preview-economics' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => cognitiveResources.previewEconomics(parsed.draft))); return true; }
    if (url === '/api/cognitive-resource-meter/goal-receipt/import' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-goal-import'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.importGoalReceipt(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/local-meter/start' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-meter-start'); requirePermission('cognitive-resource-meter','cognitive.measure.local'); return cognitiveResources.startLocalProcessMeter(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/local-meter/stop' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-meter-stop'); requirePermission('cognitive-resource-meter','cognitive.measure.local'); return cognitiveResources.stopLocalProcessMeter(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/local-meter/cancel' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-meter-cancel'); requirePermission('cognitive-resource-meter','cognitive.measure.local'); return cognitiveResources.cancelLocalProcessMeter(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/provider-run' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-capture'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.captureProviderRun(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/observation' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-capture'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.captureObservation(parsed.draft, { supersedesId:parsed.supersedesId || null }); })); return true; }
    if (url === '/api/cognitive-resource-meter/compute-telemetry' && req.method === 'POST') { reply(res, body(req, 1000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-capture'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.captureComputeTelemetry(parsed); })); return true; }
    if (url === '/api/cognitive-resource-meter/economics-profile' && req.method === 'POST') { reply(res, body(req, 2000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-capture'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.captureEconomicsProfile(parsed.draft, { supersedesId:parsed.supersedesId || null }); })); return true; }
    if (url === '/api/cognitive-resource-meter/profile-seal' && req.method === 'POST') { reply(res, body(req, 1000000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-seal'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.sealProfile(parsed.profile); })); return true; }
    if (url === '/api/cognitive-resource-meter/compatibility' && req.method === 'POST') { reply(res, body(req, 3000000).then(parsed => cognitiveResources.compatibility(parsed.observationDraft, parsed.economicsDraft))); return true; }
    if (url === '/api/cognitive-resource-meter/archive' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-archive'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.archive(parsed.id, parsed.confirmation); })); return true; }
    if (url === '/api/cognitive-resource-meter/restore' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-restore'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.restore(parsed.id, parsed.confirmation); })); return true; }
    if (url === '/api/cognitive-resource-meter/export' && req.method === 'POST') { reply(res, body(req, 30000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-export'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.exportRecord(parsed.id, parsed.confirmation); })); return true; }
    if (url === '/api/cognitive-resource-meter/bundle' && req.method === 'POST') { reply(res, body(req, 200000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-resource', 'explicit-bundle'); requirePermission('cognitive-resource-meter','cognitive.evidence.write'); return cognitiveResources.exportBundle(parsed); })); return true; }
    if (url === '/api/cognitive-evidence-labs' && req.method === 'GET') { reply(res, cognitiveLabs.status()); return true; }
    if (url === '/api/cognitive-evidence-labs/records' && req.method === 'GET') { const q=query(req); reply(res, cognitiveLabs.list({kind:q.get('kind')||null,state:q.get('state')||null,limit:Number(q.get('limit')||500)})); return true; }
    if (url === '/api/cognitive-evidence-labs/record' && req.method === 'GET') { reply(res, cognitiveLabs.get(query(req).get('id'))); return true; }
    if (url === '/api/cognitive-evidence-labs/calibration' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-lab', 'explicit-calibration'); requirePermission('cognitive-calibration-lab','cognitive.calibration.write'); return cognitiveLabs.captureCalibration(parsed.record); })); return true; }
    if (url === '/api/cognitive-evidence-labs/attention' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-lab', 'explicit-attention'); requirePermission('human-attention-ledger','human.attention.write'); return cognitiveLabs.captureAttention(parsed.record); })); return true; }
    if (url === '/api/cognitive-evidence-labs/attention/withdraw' && req.method === 'POST') { reply(res, body(req, 100000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-lab', 'explicit-attention-withdrawal'); requirePermission('human-attention-ledger','human.attention.write'); return cognitiveLabs.withdrawAttention(parsed); })); return true; }
    if (url === '/api/cognitive-evidence-labs/sustainability' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-lab', 'explicit-sustainability'); requirePermission('sustainability-metrology-lab','sustainability.evidence.write'); return cognitiveLabs.captureSustainability(parsed.record); })); return true; }
    if (url === '/api/cognitive-evidence-labs/mirror-intake' && req.method === 'POST') { reply(res, body(req, 500000).then(parsed => { mutationAllowed(); explicit(req, 'x-axm-cognitive-lab', 'explicit-mirror-intake'); requirePermission('mirror-intake-monitor','mirror.intake-receipt.import'); return cognitiveLabs.captureMirrorIntake(parsed.record); })); return true; }
    return false;
  }

  function stop() { recovery.stopSchedule(); assets.stopWatcher(); multiplayer.stop('server-shutdown'); handoff.stop(); cognitiveResources.stop(); const evidence = evidenceRetention.seal('server-shutdown'); return { stopped: true, evidence }; }
  return { handle, stop, services: { review, permissions, secrets, machine, recovery, installer, workbench, modularIntake, needsObservatory, search, assets, handoff, diagnostics, qa, templates, sources, media, world, multiplayer, adapters, mirror, novelty, releases, cognitiveResources, cognitiveLabs, evidenceRetention } };
}

module.exports = { create };
