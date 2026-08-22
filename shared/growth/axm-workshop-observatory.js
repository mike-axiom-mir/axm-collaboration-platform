'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Readiness = require('../readiness/tool-readiness');

const SCHEMA = 'axm.workshop-observatory/v1';
const STATUS_ORDER = ['CANON', 'WORKING', 'TEST', 'EXPERIMENTAL', 'SHELL', 'BROKEN', 'UNKNOWN'];
const COMPLETED_GATE_STATES = new Set(['PASS', 'WORKING', 'CURRENT', 'VERIFIED', 'COMPLETE', 'COMPLETED']);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

function cleanId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._/-]/g, '').slice(0, 120);
}

function samples(values, limit) {
  return Array.from(new Set((values || []).map(cleanId).filter(Boolean))).sort().slice(0, limit || 6);
}

function ageDays(value, nowMs) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? Math.max(0, Math.floor((nowMs - parsed) / 86400000)) : null;
}

function statusCounts(index) {
  const counts = {};
  STATUS_ORDER.forEach(status => { counts[status] = 0; });
  (index.tools || []).forEach(tool => {
    const status = STATUS_ORDER.includes(tool.status) ? tool.status : 'UNKNOWN';
    counts[status]++;
  });
  return counts;
}

function blockerCounts(index) {
  const counts = new Map();
  (index.tools || []).forEach(tool => {
    (tool.promotion && tool.promotion.blockers || []).forEach(reason => {
      const key = String(reason || 'unknown blocker').slice(0, 180);
      const row = counts.get(key) || { reason:key, count:0, tools:[] };
      row.count++;
      row.tools.push(tool.id);
      counts.set(key, row);
    });
  });
  return Array.from(counts.values()).map(row => ({ reason:row.reason, count:row.count, sampleTools:samples(row.tools) })).sort((a,b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function opportunity(id, severity, category, title, count, unit, detail, action, sampleIds, evidence) {
  return { id, severity, category, title, count:Number(count || 0), unit, detail, action, sampleIds:samples(sampleIds), evidence };
}

function buildOpportunities(index, evidence, connections) {
  const tools = index.tools || [], summary = index.summary || {}, queue = index.promotionQueue || {};
  const invalidManifests = tools.filter(tool => !tool.manifest || tool.manifest.valid !== true);
  const invalidContracts = tools.filter(tool => tool.contract && tool.contract.present && tool.contract.valid !== true);
  const missingContracts = tools.filter(tool => !tool.contract || !tool.contract.present);
  const missingTopSelftests = tools.filter(tool => !tool.selftest || !tool.selftest.promotionPath);
  const missingKinds = tools.filter(tool => tool.kind === 'UNDECLARED');
  const missingReadmes = tools.filter(tool => !tool.readme);
  const claimReverify = (queue.claimsNeedingReverification || []).map(row => row.id);
  const publicOpen = (evidence.publicGates || []).filter(gate => !COMPLETED_GATE_STATES.has(gate.state));
  const rows = [];

  if (invalidManifests.length) rows.push(opportunity('manifest-invalid', 'BLOCKING', 'structure', 'Repair invalid tool manifests', invalidManifests.length, 'tools', 'The readiness scanner could not validate these live manifests.', 'Repair the manifest fields before relying on routing or lifecycle claims.', invalidManifests.map(tool => tool.id), 'live manifest validation'));
  if (invalidContracts.length) rows.push(opportunity('contract-invalid', 'BLOCKING', 'structure', 'Repair invalid module contracts', invalidContracts.length, 'tools', 'A contract file exists but fails the deterministic contract check.', 'Repair the declared contract; do not infer capabilities from invalid data.', invalidContracts.map(tool => tool.id), 'live contract validation'));
  if (connections.consumerOnly) rows.push(opportunity('capability-consumer-only', 'ATTENTION', 'connections', 'Resolve exact consumer-only capability seams', connections.consumerOnly, 'capabilities', 'These exact contract identifiers are consumed but have no exact provider.', 'Add or connect a verified provider, or correct the identifier if it drifted.', connections.consumerOnlyIds, 'exact contract identifier comparison'));
  if (claimReverify.length) rows.push(opportunity('claims-reverify', 'ATTENTION', 'verification', 'Reverify WORKING or CANON claims', claimReverify.length, 'tools', 'Declared higher-lifecycle tools have missing or stale verification evidence.', 'Run the relevant verifier, record current evidence, and keep Mike as the merge gate.', claimReverify, 'live readiness promotion queue'));
  if (missingContracts.length) rows.push(opportunity('contract-missing', 'OPPORTUNITY', 'structure', 'Add bounded contracts where useful', missingContracts.length, 'tools', 'These registered tools do not have a present module contract.', 'Prioritize tools that exchange artifacts; a contract is not required merely to improve a percentage.', missingContracts.map(tool => tool.id), 'live tool and contract inventory'));
  if (missingTopSelftests.length) rows.push(opportunity('selftest-top-level-missing', 'OPPORTUNITY', 'verification', 'Add a top-level executable selftest seam', missingTopSelftests.length, 'tools', 'Nested tests may exist, but these tools lack the deterministic promotion selftest entrypoint.', 'Add a bounded selftest only where it proves a useful contract or behavior.', missingTopSelftests.map(tool => tool.id), 'live readiness selftest discovery'));
  if (missingKinds.length) rows.push(opportunity('kind-undeclared', 'OPPORTUNITY', 'documentation', 'Declare module kind', missingKinds.length, 'tools', 'The current readiness schema cannot classify these tools by body type.', 'Declare a supported kind when the module boundary is understood.', missingKinds.map(tool => tool.id), 'live manifest readiness index'));
  if (missingReadmes.length) rows.push(opportunity('readme-missing', 'OPPORTUNITY', 'documentation', 'Document tool purpose and boundaries', missingReadmes.length, 'tools', 'These tools have no top-level README detected.', 'Document purpose, inputs, outputs, limits, and the smallest verification path.', missingReadmes.map(tool => tool.id), 'live README presence check'));
  if (connections.providerOnly) rows.push(opportunity('capability-provider-only', 'CONTEXT', 'reuse', 'Review exact provider-only capabilities for reuse', connections.providerOnly, 'capabilities', 'These exact contract identifiers have providers but no declared consumers. Some are valid public outputs, not defects.', 'Review high-value candidates; connect only where a real consumer need exists.', connections.providerOnlyIds, 'exact contract identifier comparison'));
  if (evidence.registry.state !== 'CURRENT') rows.push(opportunity('registry-refresh', 'CONTEXT', 'evidence', 'Refresh the public evidence registry', 1, 'registry', evidence.registry.reason, 'Regenerate and verify the registry in its owned workflow; do not hand-edit generated files.', [], 'source digest and generated timestamp comparison'));
  if (publicOpen.length) rows.push(opportunity('public-gates-open', 'CONTEXT', 'release', 'Keep unresolved public gates visible', publicOpen.length, 'gates', 'These states are constraints or future checks, not silent failures.', 'Resolve only when publication scope requires it; preserve NOT_CLAIMED and NOT_INCLUDED as honest boundaries.', publicOpen.map(gate => gate.id), 'registry/public-status.json'));

  const rank = { BLOCKING:0, ATTENTION:1, OPPORTUNITY:2, CONTEXT:3 };
  return rows.sort((a,b) => rank[a.severity] - rank[b.severity] || b.count - a.count || a.id.localeCompare(b.id));
}

function scan(rootInput, options) {
  const root = path.resolve(rootInput), settings = options && typeof options === 'object' ? options : {};
  const now = new Date(settings.now || Date.now()), nowMs = now.getTime();
  const receipt = settings.verificationResults || readJson(settings.verificationReceiptFile || path.join(root, 'state', 'tool-readiness', 'latest-selftests.json'), null);
  const index = Readiness.buildIndex(root, { now:now.toISOString(), verificationResults:receipt });
  const publishedIndex = readJson(path.join(root, 'tools-index.json'), null);
  const publicStatus = readJson(path.join(root, 'registry', 'public-status.json'), {});
  const proofs = readJson(path.join(root, 'registry', 'proofs.json'), {});
  const statuses = statusCounts(index);
  const capabilities = index.capabilities || [];
  const connected = capabilities.filter(row => row.providers.length && row.consumers.length);
  const providerOnly = capabilities.filter(row => row.providers.length && !row.consumers.length);
  const consumerOnly = capabilities.filter(row => !row.providers.length && row.consumers.length);
  const resultRows = (index.tools || []).map(tool => tool.selftest && tool.selftest.result).filter(Boolean);
  const verdicts = { PASS:0, FAIL:0, TIMEOUT:0, ERROR:0, OTHER:0 };
  resultRows.forEach(row => { const verdict = Object.prototype.hasOwnProperty.call(verdicts, row.verdict) ? row.verdict : 'OTHER'; verdicts[verdict]++; });
  const publishedAge = ageDays(publishedIndex && publishedIndex.generatedAt, nowMs);
  const sourceMatches = !!(publishedIndex && publishedIndex.sourceDigest && publishedIndex.sourceDigest === index.sourceDigest);
  const registryState = !publishedIndex ? 'MISSING' : sourceMatches ? 'CURRENT' : 'SOURCE_DRIFT';
  const gates = Object.keys(publicStatus.gates || {}).sort().map(id => ({ id, state:String(publicStatus.gates[id] && publicStatus.gates[id].state || 'UNKNOWN'), evidencePresent:!!(publicStatus.gates[id] && publicStatus.gates[id].evidence) }));
  const connections = {
    exactContractCapabilities:capabilities.length,
    connected:connected.length,
    providerOnly:providerOnly.length,
    consumerOnly:consumerOnly.length,
    connectedIds:samples(connected.map(row => row.id), 10),
    providerOnlyIds:samples(providerOnly.map(row => row.id), 10),
    consumerOnlyIds:samples(consumerOnly.map(row => row.id), 10),
    exactIdentifierMatchOnly:true
  };
  const evidence = {
    currentVerification:{
      receiptAvailable:!!receipt,
      generatedAt:receipt && receipt.generatedAt || null,
      ageDays:ageDays(receipt && receipt.generatedAt, nowMs),
      currentResults:resultRows.length,
      verdicts
    },
    registry:{
      state:registryState,
      generatedAt:publishedIndex && publishedIndex.generatedAt || null,
      ageDays:publishedAge,
      sourceDigestMatches:sourceMatches,
      reason:registryState === 'CURRENT' ? 'The generated tools index matches the live readiness digest.' : registryState === 'MISSING' ? 'The generated tools index is unavailable.' : 'The generated tools index does not match the live readiness digest.'
    },
    documentedProofClaims:Array.isArray(proofs.claims) ? proofs.claims.length : 0,
    publicGates:gates,
    truth:{ documentedClaimIsCurrentRuntimeProof:false, selftestPassIsHumanApproval:false, testStatusIsCurrentPass:false }
  };
  const queue = index.promotionQueue || {};
  const structure = {
    tools:index.summary.tools,
    contracts:{ present:index.summary.contractsPresent, valid:index.summary.contractsValid, missing:index.summary.tools - index.summary.contractsPresent, invalid:index.summary.contractsPresent - index.summary.contractsValid },
    selftests:{ any:index.summary.anySelftests, topLevel:index.summary.topLevelSelftests, missingTopLevel:index.summary.tools - index.summary.topLevelSelftests },
    manifests:{ valid:index.tools.filter(tool => tool.manifest && tool.manifest.valid).length, invalid:index.tools.filter(tool => !tool.manifest || !tool.manifest.valid).length },
    permissionsDeclared:index.summary.permissionsDeclared,
    kindsDeclared:index.summary.kindsDeclared,
    readmes:index.summary.readmes
  };
  const lifecycle = {
    statuses,
    promotionQueue:{
      readyForHumanReview:(queue.readyForHumanReview || []).length,
      needsSelftestRun:(queue.needsSelftestRun || []).length,
      blocked:(queue.blocked || []).length,
      shellDecisionRequired:(queue.shellDecisionRequired || []).length,
      claimsNeedingReverification:(queue.claimsNeedingReverification || []).length
    },
    blockerReasons:blockerCounts(index).slice(0, 12),
    truth:{ statusIsDeclaration:true, canonRequiresMike:true, automaticPromotion:false }
  };
  const observatory = {
    schema:SCHEMA,
    version:1,
    measuredAt:now.toISOString(),
    scope:'live top-level tool manifests, contracts, selftest declarations, exact capability identifiers, local verification receipt metadata, and generated public evidence metadata',
    source:{ label:path.basename(root), digest:index.sourceDigest },
    lifecycle,
    structure,
    connections,
    evidence,
    opportunities:[],
    truth:{ qualityScoreProduced:false, growthEqualsSuccess:false, automaticRepair:false, automaticPromotion:false, canonChanged:false, humanMilestonesExplicitOnly:true, sourceContentsRetained:false, absolutePathsExposed:false }
  };
  observatory.opportunities = buildOpportunities(index, evidence, connections);
  return observatory;
}

function compact(value) {
  value = value && typeof value === 'object' ? value : {};
  const lifecycle = value.lifecycle || {}, structure = value.structure || {}, connections = value.connections || {}, evidence = value.evidence || {};
  return {
    schema:'axm.workshop-observatory-snapshot/v1',
    measuredAt:String(value.measuredAt || new Date().toISOString()).slice(0, 40),
    sourceDigest:cleanId(value.source && value.source.digest),
    lifecycle:{ statuses:Object.assign({}, lifecycle.statuses || {}), promotionQueue:Object.assign({}, lifecycle.promotionQueue || {}) },
    structure:{
      tools:Number(structure.tools || 0),
      contracts:Object.assign({}, structure.contracts || {}),
      selftests:Object.assign({}, structure.selftests || {}),
      manifests:Object.assign({}, structure.manifests || {}),
      permissionsDeclared:Number(structure.permissionsDeclared || 0),
      kindsDeclared:Number(structure.kindsDeclared || 0),
      readmes:Number(structure.readmes || 0)
    },
    connections:{ exactContractCapabilities:Number(connections.exactContractCapabilities || 0), connected:Number(connections.connected || 0), providerOnly:Number(connections.providerOnly || 0), consumerOnly:Number(connections.consumerOnly || 0) },
    evidence:{
      currentVerification:{ receiptAvailable:!!(evidence.currentVerification && evidence.currentVerification.receiptAvailable), currentResults:Number(evidence.currentVerification && evidence.currentVerification.currentResults || 0), verdicts:Object.assign({}, evidence.currentVerification && evidence.currentVerification.verdicts || {}) },
      registry:{ state:String(evidence.registry && evidence.registry.state || 'UNKNOWN') },
      documentedProofClaims:Number(evidence.documentedProofClaims || 0),
      publicGateCount:Array.isArray(evidence.publicGates) ? evidence.publicGates.length : 0
    },
    opportunityCounts:(value.opportunities || []).reduce((memo,row) => { memo[row.severity] = Number(memo[row.severity] || 0) + 1; return memo; }, { BLOCKING:0, ATTENTION:0, OPPORTUNITY:0, CONTEXT:0 })
  };
}

function milestoneState(value) {
  value = value && typeof value === 'object' ? value : {};
  return {
    schema:'axm.workshop-milestones/v1',
    version:1,
    retention:'all-compact-human-recorded-milestones',
    milestones:(Array.isArray(value.milestones) ? value.milestones : []).map(row => ({
      id:cleanId(row && row.id) || 'milestone-' + Date.now().toString(36),
      label:String(row && row.label || 'Workshop milestone').replace(/[<>\r\n]/g, ' ').trim().slice(0, 100) || 'Workshop milestone',
      note:String(row && row.note || '').replace(/[<>\r\n]/g, ' ').trim().slice(0, 280),
      actor:String(row && row.actor || 'local-human').replace(/[<>\r\n]/g, ' ').trim().slice(0, 80) || 'local-human',
      recordedAt:String(row && row.recordedAt || new Date().toISOString()).slice(0, 40),
      evidence:row && row.evidence && typeof row.evidence === 'object' ? {
        observatoryMeasuredAt:String(row.evidence.observatoryMeasuredAt || '').slice(0, 40) || null,
        sourceDigest:cleanId(row.evidence.sourceDigest) || null,
        tools:Number(row.evidence.tools || 0),
        validContracts:Number(row.evidence.validContracts || 0),
        connectedCapabilities:Number(row.evidence.connectedCapabilities || 0),
        currentVerificationPasses:Number(row.evidence.currentVerificationPasses || 0)
      } : null,
      truth:{ humanRecorded:true, automaticallyProven:false, canonChanged:false }
    })).sort((a,b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
  };
}

function recordMilestone(input, observatory, values) {
  if (!observatory || observatory.schema !== SCHEMA) throw new Error('A measured Workshop Observatory snapshot is required');
  values = values && typeof values === 'object' ? values : {};
  const state = milestoneState(input), label = String(values.label || '').replace(/[<>\r\n]/g, ' ').trim().slice(0, 100);
  if (!label) throw new Error('Milestone label is required');
  const note = String(values.note || '').replace(/[<>\r\n]/g, ' ').trim().slice(0, 280);
  const passes = Number(observatory.evidence && observatory.evidence.currentVerification && observatory.evidence.currentVerification.verdicts && observatory.evidence.currentVerification.verdicts.PASS || 0);
  const evidence = {
    observatoryMeasuredAt:String(observatory.measuredAt || '').slice(0, 40) || null,
    sourceDigest:cleanId(observatory.source && observatory.source.digest) || null,
    tools:Number(observatory.structure && observatory.structure.tools || 0),
    validContracts:Number(observatory.structure && observatory.structure.contracts && observatory.structure.contracts.valid || 0),
    connectedCapabilities:Number(observatory.connections && observatory.connections.connected || 0),
    currentVerificationPasses:passes
  };
  const prior = state.milestones[state.milestones.length - 1] || null;
  if (prior && prior.label === label && prior.evidence && prior.evidence.sourceDigest === evidence.sourceDigest) return { state, milestone:prior, duplicate:true };
  const recordedAt = new Date(values.recordedAt || Date.now()).toISOString();
  const id = 'milestone-' + crypto.createHash('sha256').update(label + '\n' + recordedAt + '\n' + (evidence.sourceDigest || '')).digest('hex').slice(0, 16);
  const milestone = milestoneState({ milestones:[{ id, label, note, actor:values.actor || 'local-human', recordedAt, evidence }] }).milestones[0];
  state.milestones.push(milestone);
  return { state, milestone, duplicate:false };
}

module.exports = { SCHEMA, STATUS_ORDER, scan, compact, buildOpportunities, milestoneState, recordMilestone };
