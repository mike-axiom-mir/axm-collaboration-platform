'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core');
const ContractVerifier = require('../../hub/module-contract-verifier');
const SeamAudit = require('../../hub/module-seam-audit');

const SCHEMA = 'axm.research-workshop-snapshot/v1';
const STATUS_RANK = { unavailable: 0, unknown: 1, degraded: 2, available: 3 };

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function capabilityStatus(manifest, hasVerifiedContract) {
  if (manifest.status === 'BROKEN') return 'unavailable';
  if (manifest.status === 'SHELL') return 'degraded';
  return hasVerifiedContract ? 'available' : 'unknown';
}
function addCapability(map, id, status, provider, constraints) {
  id = Core.text(id, 240); if (!id) return;
  const current = map.get(id);
  if (!current || STATUS_RANK[status] > STATUS_RANK[current.status]) map.set(id, { id, status, providers: [provider], constraints: Core.list(constraints, 32) });
  else {
    current.providers = Core.list(current.providers.concat(provider), 100);
    current.constraints = Core.list(current.constraints.concat(constraints || []), 100);
  }
}
function parseVerifyReport(root) {
  const file = path.join(root, 'exports', 'verify-report.txt');
  if (!fs.existsSync(file)) return { present: false, failures: [], source: null };
  const body = fs.readFileSync(file, 'utf8');
  const failures = body.split(/\r?\n/).filter(line => /^\s*FAIL\s+/.test(line)).map(line => line.replace(/^\s*FAIL\s+/, '').trim());
  return { present: true, failures, source: path.relative(root, file).replace(/\\/g, '/'), digest: Core.digest(body), modifiedAt: fs.statSync(file).mtime.toISOString() };
}
function scan(root) {
  root = path.resolve(root);
  const toolsRoot = path.join(root, 'tools');
  Core.assert(fs.existsSync(toolsRoot), 'Workshop tools directory is missing');
  const verified = ContractVerifier.verifyDeclaredContracts(root);
  const verifiedById = new Map(verified.results.map(item => [item.id, item]));
  const capabilities = new Map(), modules = [];
  for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true }).filter(item => item.isDirectory() && !item.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name))) {
    const manifestFile = path.join(toolsRoot, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestFile)) continue;
    const manifest = readJson(manifestFile, null); if (!manifest) continue;
    const checked = verifiedById.get(manifest.id || entry.name);
    const contractFile = manifest.contract ? path.join(toolsRoot, entry.name, manifest.contract) : null;
    const contract = contractFile && fs.existsSync(contractFile) ? readJson(contractFile, null) : null;
    const status = capabilityStatus(manifest, !!(checked && checked.pass));
    const declared = Core.list([].concat(contract && contract.provides || [], manifest.produces || []), 1000);
    declared.forEach(capability => addCapability(capabilities, capability, status, manifest.id || entry.name, [
      'module-status:' + manifest.status,
      contract ? 'declared-module-contract' : 'manifest-declaration-without-module-contract'
    ]));
    addCapability(capabilities, 'module:' + (manifest.id || entry.name), status, manifest.id || entry.name, ['module-presence']);
    modules.push({
      id: manifest.id || entry.name,
      name: manifest.name || entry.name,
      status: manifest.status,
      contractStatus: checked ? (checked.pass ? 'VALID' : 'INVALID') : 'UNDECLARED',
      capabilities: declared,
      sourceDigest: Core.digest({ manifest, contract })
    });
  }
  addCapability(capabilities, 'capability.compare.requirements/v1', 'available', 'capability-gap-scout', ['direct-ai-native-hand', 'exact-identifiers-only']);
  addCapability(capabilities, 'evidence.route.claim/v1', 'available', 'evidence-router', ['direct-ai-native-hand', 'routes-proof-but-does-not-execute-it']);

  const gaps = [];
  verified.results.filter(item => !item.pass).forEach(item => item.errors.forEach((error, index) => gaps.push({
    id: Core.id('gap', { source: 'module-contract-verifier', module: item.id, error, index }),
    gapType: 'CONTRACT', status: 'OPEN', source: 'MODULE_CONTRACT_VERIFIER', sourceRef: item.path || ('tools/' + item.id),
    title: item.id + ': ' + error, capabilityId: 'module:' + item.id, required: true, priority: 95
  })));
  const seams = SeamAudit.auditModules(root);
  seams.modules.filter(item => item.gaps.length).forEach(item => item.gaps.forEach((gap, index) => gaps.push({
    id: Core.id('gap', { source: 'module-seam-audit', module: item.id, gap, index }),
    gapType: 'CONTRACT', status: 'OPEN', source: 'MODULE_SEAM_AUDIT', sourceRef: 'tools/' + item.id,
    title: item.id + ': ' + gap, capabilityId: 'module:' + item.id + ':lifecycle-contract', required: false, priority: 35
  })));
  const verifyReport = parseVerifyReport(root);
  verifyReport.failures.forEach((failure, index) => gaps.push({
    id: Core.id('gap', { source: verifyReport.digest, failure, index }), gapType: 'EVIDENCE', status: 'OPEN', source: 'WORKSHOP_VERIFY_REPORT',
    sourceRef: verifyReport.source, title: failure, capabilityId: 'workshop.verify.clean/v1', required: true, priority: 90
  }));

  const directionFile = path.join(root, 'state', 'workshop-direction', 'directions.json');
  const directionState = readJson(directionFile, { directions: {} });
  Object.values(directionState.directions || {}).filter(direction => direction && direction.status === 'OPEN').forEach(direction => {
    (direction.handRequests || []).filter(hand => hand.status !== 'CLOSED').forEach(hand => gaps.push({
      id: Core.id('gap', { source: 'direction', direction: direction.request.requestId, hand: hand.handRequestId || hand.id }),
      gapType: 'HAND', status: 'OPEN', source: 'WORKSHOP_DIRECTION', sourceRef: direction.request.requestId,
      title: hand.purpose || hand.desiredContract, capabilityId: hand.desiredContract, required: true,
      priority: Math.round(Core.clamp(direction.request.priority, 70, 0, 100))
    }));
  });
  const needsFile = path.join(root, 'state', 'workshop-needs-observatory', 'needs.json');
  const needsState = readJson(needsFile, { needs: [] });
  const capabilityIds = new Set(Array.from(capabilities.values()).filter(item => item.status === 'available').map(item => item.id));
  (needsState.needs || []).filter(need => !['SATISFIED', 'CANCELLED'].includes(need.state)).forEach(need => (need.requiredCapabilities || []).filter(id => !capabilityIds.has(id)).forEach(id => gaps.push({
    id: Core.id('gap', { source: 'need', need: need.id, capability: id }), gapType: 'HAND', status: 'OPEN', source: 'WORKSHOP_NEEDS', sourceRef: need.id,
    title: need.title + ': ' + id, capabilityId: id, required: true, priority: Math.round(Core.clamp(need.priority, 50, 0, 100))
  })));

  const inventory = Array.from(capabilities.values()).sort((a, b) => a.id.localeCompare(b.id));
  const snapshot = {
    schema: SCHEMA,
    root: root.replace(/\\/g, '/'),
    modules,
    capabilities: inventory,
    observedGaps: gaps.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
    evidence: {
      moduleContracts: { checked: verified.results.length, pass: verified.pass },
      lifecycleSeams: { modules: seams.moduleCount, openModules: seams.openModuleCount, gaps: seams.gapCount },
      verifyReport
    },
    summary: { modules: modules.length, exactCapabilities: inventory.length, observedGaps: gaps.length, openDirections: Object.values(directionState.directions || {}).filter(item => item.status === 'OPEN').length, openNeeds: (needsState.needs || []).filter(need => !['SATISFIED', 'CANCELLED'].includes(need.state)).length }
  };
  const digestSnapshot = Core.clone(snapshot);
  digestSnapshot.root = '<workshop-root>';
  if (digestSnapshot.evidence.verifyReport) delete digestSnapshot.evidence.verifyReport.modifiedAt;
  snapshot.snapshotDigest = Core.digest(digestSnapshot);
  return snapshot;
}

module.exports = { SCHEMA, scan };
