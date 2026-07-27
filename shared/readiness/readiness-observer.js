'use strict';

const fs = require('fs');
const path = require('path');
const Readiness = require('./tool-readiness');

const VIEW_SCHEMA = 'axm.workshop-readiness-view/v1';

function textList(value, limit) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))).slice(0, limit || 200).sort();
}

function truthBoundary() {
  return {
    automaticPromotion: false,
    structuralEligibilityIsRuntimeProof: false,
    selftestPassIsHumanApproval: false,
    capabilityCatalogGrantsAuthority: false,
    missingValuesRemainVisible: true
  };
}

function create(options) {
  options = options || {};
  const root = path.resolve(options.root || path.join(__dirname, '..', '..'));
  const stateRoot = path.resolve(options.stateRoot || path.join(root, 'state'));
  const indexFile = path.resolve(options.indexFile || path.join(root, 'tools-index.json'));
  const receiptFile = path.resolve(options.receiptFile || path.join(stateRoot, 'tool-readiness', 'latest-selftests.json'));
  const humanGate = String(options.humanGate || 'Mike').trim().slice(0, 120) || 'explicit human steward';

  function sourcePath() {
    return path.relative(root, indexFile).split(path.sep).join('/') || path.basename(indexFile);
  }

  function authority() {
    return {
      humanPromotionRequired: true,
      humanGate,
      reviewCandidateMeans: 'Current structural and self-test evidence is ready for ' + humanGate + ' to inspect.',
      reviewCandidateDoesNotMean: ['approved', 'promoted', 'CANON', 'need-satisfied']
    };
  }

  function hold(state, reason, errors) {
    return {
      schema: VIEW_SCHEMA,
      state,
      source: sourcePath(),
      generatedAt: null,
      sourceDigest: null,
      summary: null,
      reviewCandidates: [],
      reason,
      errors: textList(errors, 20),
      truth: truthBoundary(),
      authority: authority()
    };
  }

  function snapshot() {
    if (!fs.existsSync(indexFile)) return hold('UNAVAILABLE', 'The deterministic tools index has not been generated.');
    let index;
    try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); }
    catch (error) { return hold('INVALID', 'The deterministic tools index is not valid JSON.', [error.message]); }

    const checked = Readiness.validateIndex(index);
    const queue = index && index.promotionQueue;
    const truth = index && index.truth;
    const structuralErrors = checked.errors.slice();
    if (!index.summary || typeof index.summary !== 'object') structuralErrors.push('summary is required');
    if (!queue || !Array.isArray(queue.readyForHumanReview) || !Array.isArray(queue.needsSelftestRun) || !Array.isArray(queue.blocked)) structuralErrors.push('promotion queue arrays are required');
    if (!Array.isArray(index.tools)) structuralErrors.push('tools array is required');
    if (!Number.isFinite(Date.parse(index.generatedAt))) structuralErrors.push('generatedAt must be a date-time');
    ['tools', 'capabilities', 'contractsValid', 'topLevelSelftests', 'kindsDeclared'].forEach(field => {
      if (!index.summary || !Number.isFinite(Number(index.summary[field]))) structuralErrors.push('summary.' + field + ' must be numeric');
    });
    if (!truth || truth.structuralEligibilityIsRuntimeProof !== false || truth.selftestPassIsHumanApproval !== false || truth.capabilityCatalogGrantsAuthority !== false || truth.missingValuesRemainVisible !== true) structuralErrors.push('readiness truth boundaries are incomplete');
    if (structuralErrors.length) return hold('INVALID', 'The deterministic tools index failed its truth contract.', structuralErrors);

    let verificationResults = null;
    if (fs.existsSync(receiptFile)) {
      try { verificationResults = JSON.parse(fs.readFileSync(receiptFile, 'utf8')); }
      catch (error) { return hold('INVALID', 'The latest self-test receipt is not valid JSON.', [error.message]); }
    }

    let current;
    try { current = Readiness.buildIndex(root, { verificationResults }); }
    catch (error) { return hold('UNAVAILABLE', 'Current readiness evidence could not be recomputed.', [error.message]); }
    const sourceChanged = current.sourceDigest !== index.sourceDigest;
    const queueChanged = JSON.stringify(current.promotionQueue) !== JSON.stringify(index.promotionQueue);
    const summaryChanged = JSON.stringify(current.summary) !== JSON.stringify(index.summary);
    if (sourceChanged || queueChanged || summaryChanged) {
      return hold('STALE', 'The Workshop changed after this tools index was generated. Refresh the index before using its review queue.', [
        sourceChanged ? 'source digest changed' : '',
        queueChanged ? 'review queue changed' : '',
        summaryChanged ? 'inventory summary changed' : ''
      ]);
    }

    const toolById = new Map(index.tools.map(tool => [tool.id, tool]));
    const reviewCandidates = queue.readyForHumanReview.map(id => {
      const tool = toolById.get(id) || {};
      return {
        id,
        name: tool.name || id,
        version: tool.version || null,
        moduleRoute: tool.entry && tool.entry.exists && tool.entry.path ? '/' + String(tool.entry.path).replace(/^\/+/, '') : null,
        evidencePaths: {
          manifest: tool.manifest && tool.manifest.path || null,
          contract: tool.contract && tool.contract.path || null,
          selftest: tool.selftest && tool.selftest.promotionPath || null
        },
        evidence: 'CURRENT_SELFTEST_AND_CONTRACT',
        humanDecisionRequired: true
      };
    });
    return {
      schema: VIEW_SCHEMA,
      state: 'CURRENT',
      source: sourcePath(),
      generatedAt: index.generatedAt,
      sourceDigest: index.sourceDigest,
      summary: {
        tools: Number(index.summary.tools),
        capabilities: Number(index.summary.capabilities),
        contractsValid: Number(index.summary.contractsValid),
        topLevelSelftests: Number(index.summary.topLevelSelftests),
        kindsDeclared: Number(index.summary.kindsDeclared),
        legacyKinds: Math.max(0, Number(index.summary.tools) - Number(index.summary.kindsDeclared)),
        reviewCandidates: reviewCandidates.length,
        needsSelftestRun: queue.needsSelftestRun.length,
        blocked: queue.blocked.length
      },
      reviewCandidates,
      reason: 'The checked-in index matches the current declarations, contracts, self-tests, and latest self-test receipt.',
      errors: [],
      truth: Object.assign({}, truth),
      authority: authority()
    };
  }

  return { snapshot, hold, indexFile, receiptFile };
}

module.exports = { VIEW_SCHEMA, create, truthBoundary };
