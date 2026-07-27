'use strict';

const path = require('path');
const U = require('./operations-utils');
const ToolReadiness = require('../readiness/tool-readiness');

const SCHEMA = 'axm.hub-lifecycle-state/v1';
const EVIDENCE_SCHEMA = 'axm.hub-lifecycle-evidence/v1';
const STATES = new Set(['CLAIMED', 'NEEDS VERIFY', 'WORKING', 'SAVED CHECKPOINT', 'TEST-HOLD']);
const RECONCILIATION_CONFIRMATION = 'MARK CURRENT VERIFIED TOOLS WORKING';

function create(options) {
  options = options || {};
  const root = path.resolve(options.root || path.dirname(options.stateRoot));
  const stateFile = path.join(options.stateRoot, 'hub-lifecycle', 'lifecycle.json');
  const toolsIndexFile = path.resolve(options.toolsIndexFile || path.join(root, 'tools-index.json'));
  const selftestResultsFile = path.resolve(options.selftestResultsFile || path.join(options.stateRoot, 'tool-readiness', 'latest-selftests.json'));
  const readiness = options.toolReadiness || ToolReadiness;

  function cleanId(value) {
    const id = String(value || '').trim();
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) throw new Error('valid module id is required');
    return id;
  }

  function cleanLifecycle(value) {
    const lifecycle = String(value || '').trim();
    if (!STATES.has(lifecycle)) throw new Error('lifecycle update refused: local convenience stops before CANON');
    return lifecycle;
  }

  function seed() {
    return { schema: SCHEMA, updatedAt: null, lifecycles: {} };
  }

  function cleanText(value, max) {
    return value == null ? null : String(value).slice(0, max);
  }

  function cleanEvidence(value) {
    if (!value || typeof value !== 'object' || value.schema !== EVIDENCE_SCHEMA) return null;
    return {
      schema: EVIDENCE_SCHEMA,
      basis: cleanText(value.basis, 120),
      manifestStatus: cleanText(value.manifestStatus, 30),
      readinessState: cleanText(value.readinessState, 60),
      toolsIndexSourceDigest: /^[a-f0-9]{64}$/.test(String(value.toolsIndexSourceDigest || '')) ? value.toolsIndexSourceDigest : null,
      toolsIndexGeneratedAt: cleanText(value.toolsIndexGeneratedAt, 40),
      selftestPath: cleanText(value.selftestPath, 300),
      selftestSha256: /^[a-f0-9]{64}$/.test(String(value.selftestSha256 || '')) ? value.selftestSha256 : null,
      selftestVerdict: cleanText(value.selftestVerdict, 30),
      selftestOutputSha256: /^[a-f0-9]{64}$/.test(String(value.selftestOutputSha256 || '')) ? value.selftestOutputSha256 : null,
      selftestResultGeneratedAt: cleanText(value.selftestResultGeneratedAt, 40),
      visualEvidenceState: cleanText(value.visualEvidenceState, 80),
      namedHolds: Array.isArray(value.namedHolds) ? value.namedHolds.slice(0, 30).map(item => String(item).slice(0, 300)) : [],
      priorSource: cleanText(value.priorSource, 80),
      canonGranted: false
    };
  }

  function read() {
    const loaded = U.loadJson(stateFile, null);
    if (!loaded || loaded.schema !== SCHEMA || !loaded.lifecycles || typeof loaded.lifecycles !== 'object') return seed();
    const state = seed();
    state.updatedAt = loaded.updatedAt || null;
    Object.keys(loaded.lifecycles).sort().forEach(id => {
      const row = loaded.lifecycles[id];
      if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id) || !row || !STATES.has(row.lifecycle)) return;
      state.lifecycles[id] = {
        lifecycle: row.lifecycle,
        updatedAt: row.updatedAt || null,
        actor: String(row.actor || 'local-user').slice(0, 120),
        source: String(row.source || 'hub').slice(0, 80),
        evidence: cleanEvidence(row.evidence)
      };
    });
    return state;
  }

  function prepare(input, stamp) {
    input = input || {};
    return {
      id: cleanId(input.id),
      record: {
        lifecycle: cleanLifecycle(input.lifecycle),
        updatedAt: stamp,
        actor: String(input.actor || 'local-user').slice(0, 120),
        source: String(input.source || 'hub-menu').slice(0, 80),
        evidence: cleanEvidence(input.evidence)
      }
    };
  }

  function loadCurrentReadiness() {
    const index = U.loadJson(toolsIndexFile, null);
    const validation = readiness.validateIndex(index);
    if (!validation.pass) throw new Error('tools index is invalid: ' + validation.errors.join('; '));
    const receipt = U.loadJson(selftestResultsFile, null);
    if (!receipt || receipt.schema !== 'axm.tool-selftest-results/v1' || !Array.isArray(receipt.results)) {
      throw new Error('current tool selftest receipt is unavailable or invalid');
    }
    const rebuilt = readiness.buildIndex(root, { verificationResults: receipt, now: index.generatedAt });
    if (rebuilt.sourceDigest !== index.sourceDigest) {
      throw new Error('tools index is stale for the current Workshop source; refresh verification before reconciliation');
    }
    return { index: rebuilt, receipt };
  }

  function recommendedLifecycle(tool, prior) {
    if (tool.promotion.state === 'READY_FOR_HUMAN_REVIEW' || tool.promotion.state === 'CURRENT') return 'WORKING';
    if (prior && (prior.lifecycle === 'WORKING' || prior.lifecycle === 'SAVED CHECKPOINT')) return prior.lifecycle;
    if (tool.status === 'TEST' || tool.status === 'SHELL' || tool.status === 'BROKEN') return 'TEST-HOLD';
    return 'NEEDS VERIFY';
  }

  function evidenceFor(tool, index, receipt, prior, lifecycle) {
    const result = tool.selftest && tool.selftest.result;
    const preserved = !!prior && lifecycle === prior.lifecycle && ['WORKING', 'SAVED CHECKPOINT'].includes(lifecycle)
      && !['READY_FOR_HUMAN_REVIEW', 'CURRENT'].includes(tool.promotion.state);
    return cleanEvidence({
      schema: EVIDENCE_SCHEMA,
      basis: preserved ? 'PRESERVED_EXPLICIT_LOCAL_JUDGMENT' :
        tool.promotion.state === 'READY_FOR_HUMAN_REVIEW' ? 'CURRENT_SELFTEST_AND_STRUCTURAL_REVIEW_READY' :
        tool.promotion.state === 'CURRENT' ? 'CURRENT_MANIFEST_CLAIM' :
        lifecycle === 'TEST-HOLD' ? 'DECLARED_TEST_WITH_NAMED_HOLDS' : 'NOT_YET_VERIFIED',
      manifestStatus: tool.status,
      readinessState: tool.promotion.state,
      toolsIndexSourceDigest: index.sourceDigest,
      toolsIndexGeneratedAt: index.generatedAt,
      selftestPath: tool.selftest && tool.selftest.promotionPath,
      selftestSha256: tool.selftest && tool.selftest.sha256,
      selftestVerdict: result && result.verdict,
      selftestOutputSha256: result && result.outputSha256,
      selftestResultGeneratedAt: result ? receipt.generatedAt : null,
      visualEvidenceState: prior && /^runtime-and-eye-verified/.test(prior.source || '')
        ? 'LEGACY_RUNTIME_AND_EYE_REFERENCE'
        : 'NOT_RECORDED',
      namedHolds: tool.promotion.blockers,
      priorSource: prior && prior.source,
      canonGranted: false
    });
  }

  function reconciliationPlan() {
    const current = loadCurrentReadiness();
    const existing = read();
    const entries = current.index.tools.slice().sort((a, b) => a.id.localeCompare(b.id)).map(tool => {
      const prior = existing.lifecycles[tool.id] || null;
      const lifecycle = recommendedLifecycle(tool, prior);
      return {
        id: tool.id,
        lifecycle,
        evidence: evidenceFor(tool, current.index, current.receipt, prior, lifecycle)
      };
    });
    const ids = new Set(entries.map(entry => entry.id));
    const staleIds = Object.keys(existing.lifecycles).filter(id => !ids.has(id)).sort();
    const counts = entries.reduce((out, entry) => {
      out[entry.lifecycle] = Number(out[entry.lifecycle] || 0) + 1;
      return out;
    }, {});
    const digestInput = { toolsIndexSourceDigest: current.index.sourceDigest, entries, staleIds };
    return {
      schema: 'axm.hub-lifecycle-reconciliation/v1',
      generatedAt: U.now(),
      planDigest: U.sha256(JSON.stringify(digestInput)),
      toolsIndexSourceDigest: current.index.sourceDigest,
      toolsIndexGeneratedAt: current.index.generatedAt,
      selftestResultGeneratedAt: current.receipt.generatedAt,
      counts,
      entries,
      staleIds,
      confirmation: RECONCILIATION_CONFIRMATION,
      truth: {
        localLifecycleOnly: true,
        automaticManifestPromotion: false,
        canonGranted: false,
        staleIndexRefused: true,
        preservedLocalWorkingNeedsNewProofForManifestPromotion: true
      }
    };
  }

  function applyReconciliation(input) {
    input = input || {};
    if (input.confirmation !== RECONCILIATION_CONFIRMATION) throw new Error('exact lifecycle reconciliation confirmation is required');
    const plan = reconciliationPlan();
    if (String(input.planDigest || '') !== plan.planDigest) throw new Error('lifecycle reconciliation plan changed; review the current plan digest');
    const stamp = U.now();
    const next = seed();
    next.updatedAt = stamp;
    plan.entries.forEach(entry => {
      next.lifecycles[entry.id] = {
        lifecycle: entry.lifecycle,
        updatedAt: stamp,
        actor: String(input.actor || 'local-steward').slice(0, 120),
        source: 'readiness-reconciliation',
        evidence: entry.evidence
      };
    });
    U.atomicJson(stateFile, next);
    return {
      updated: plan.entries.length,
      removedStaleIds: plan.staleIds,
      counts: plan.counts,
      planDigest: plan.planDigest,
      toolsIndexSourceDigest: plan.toolsIndexSourceDigest,
      stateUpdatedAt: stamp,
      canonGranted: false
    };
  }

  function status() {
    const state = read();
    return Object.assign({}, state, {
      count: Object.keys(state.lifecycles).length,
      allowedStates: Array.from(STATES),
      truth: { browserProfilesShareState: true, automaticCanon: false, quickMenuMaximum: 'WORKING', canonEndpoint: false, evidenceLinkedReconciliation: true }
    });
  }

  function set(input) {
    const stamp = U.now(), next = prepare(input, stamp), state = read();
    state.lifecycles[next.id] = next.record;
    state.updatedAt = stamp;
    U.atomicJson(stateFile, state);
    return { id: next.id, record: U.clone(next.record), stateUpdatedAt: stamp };
  }

  function batch(entries, actor, source) {
    entries = Array.isArray(entries) ? entries : [];
    if (!entries.length || entries.length > 220) throw new Error('lifecycle batch requires 1 to 220 entries');
    const stamp = U.now();
    const prepared = entries.map(entry => prepare(Object.assign({}, entry, { actor: entry.actor || actor, source: entry.source || source }), stamp));
    const ids = new Set();
    prepared.forEach(row => { if (ids.has(row.id)) throw new Error('duplicate module id in lifecycle batch'); ids.add(row.id); });
    const state = read();
    prepared.forEach(row => { state.lifecycles[row.id] = row.record; });
    state.updatedAt = stamp;
    U.atomicJson(stateFile, state);
    return { updated: prepared.length, ids: prepared.map(row => row.id), stateUpdatedAt: stamp };
  }

  return { status, set, batch, reconciliationPlan, applyReconciliation, stateFile, toolsIndexFile, selftestResultsFile };
}

module.exports = { SCHEMA, EVIDENCE_SCHEMA, STATES, RECONCILIATION_CONFIRMATION, create };
