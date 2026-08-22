'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ContractVerifier = require('../../hub/module-contract-verifier');

const INDEX_SCHEMA = 'axm.tools-index/v1';
const MANIFEST_SCHEMA = 'axm.tool-manifest/v1';
const STATUSES = new Set(['EXPERIMENTAL', 'TEST', 'WORKING', 'CANON', 'SHELL', 'BROKEN']);
const KINDS = new Set(['product', 'service', 'scaffold', 'adapter', 'machine-capability']);
const VERIFICATION_STATUSES = new Set(['TEST', 'WORKING', 'CANON']);
const SKIP_WALK = new Set(['node_modules', 'vendor', 'exports', 'state', 'logs', 'backups']);
const SELFTEST_DIGEST_SCOPE = 'all-discovered-selftests/v1';

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { return fallback; }
}

function portable(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function digestFile(file) {
  try { return sha256(fs.readFileSync(file)); }
  catch (error) { return null; }
}

function listSelftests(folder, root) {
  const found = [];
  function walk(current) {
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch (error) { return; }
    entries.forEach(entry => {
      if (entry.isDirectory()) {
        if (!SKIP_WALK.has(entry.name)) walk(path.join(current, entry.name));
        return;
      }
      if (/selftest.*\.(?:js|mjs|cjs)$/i.test(entry.name) || /(?:^|-)test\.js$/i.test(entry.name)) {
        found.push(portable(root, path.join(current, entry.name)));
      }
    });
  }
  walk(folder);
  return found.sort((a, b) => a.localeCompare(b));
}

function choosePromotionSelftest(folder, selftests) {
  const direct = 'tools/' + folder + '/selftest.js';
  if (selftests.includes(direct)) return direct;
  return null;
}

function digestSelftestSuite(root, selftests) {
  const hash = crypto.createHash('sha256');
  selftests.forEach(file => {
    const fileDigest = digestFile(path.join(root, file));
    hash.update(file + '\0' + (fileDigest || 'MISSING') + '\n');
  });
  return hash.digest('hex');
}

function freshness(value, nowMs, days) {
  if (value == null || value === '') return { state: 'MISSING', ageDays: null };
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return { state: 'INVALID', ageDays: null };
  const ageDays = Math.max(0, Math.floor((nowMs - parsed) / 86400000));
  return { state: ageDays > days ? 'STALE' : 'FRESH', ageDays };
}

function validateTargetManifest(manifest, folder) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is not an object'];
  ['id', 'name', 'version', 'status', 'entry'].forEach(field => {
    if (!String(manifest[field] || '').trim()) errors.push(field + ' is required');
  });
  if (manifest.id && manifest.id !== folder && manifest.folderAlias !== folder) errors.push('id must equal folder name unless an explicit legacy folderAlias preserves the route');
  if (!STATUSES.has(manifest.status)) errors.push('status is unsupported');
  if (!Array.isArray(manifest.uses)) errors.push('uses must be an array');
  if (!Array.isArray(manifest.permissions)) errors.push('permissions must be an array');
  if (manifest.schema === MANIFEST_SCHEMA && !KINDS.has(manifest.kind)) errors.push('kind is unsupported');
  return errors;
}

function normalizeVerificationResults(input) {
  const rows = input && Array.isArray(input.results) ? input.results : [];
  return new Map(rows.map(row => [row.id, row]));
}

function isVerificationTarget(tool) {
  return !!tool && VERIFICATION_STATUSES.has(tool.status) && !!(tool.selftest && tool.selftest.promotionPath);
}

function buildIndex(root, options) {
  options = options || {};
  root = path.resolve(root);
  const now = new Date(options.now || Date.now());
  const ladderFile = path.resolve(options.promotionLadderFile || path.join(__dirname, 'promotion-ladder.json'));
  const ladder = readJson(ladderFile, { freshnessDays: 30 });
  const resultById = normalizeVerificationResults(options.verificationResults);
  const toolsRoot = path.join(root, 'tools');
  const sourceHash = crypto.createHash('sha256');
  sourceHash.update('promotion-ladder:' + (digestFile(ladderFile) || 'MISSING') + '\n');
  const tools = [];
  const capabilities = new Map();

  fs.readdirSync(toolsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(entry => {
      const folder = entry.name;
      const moduleRoot = path.join(toolsRoot, folder);
      const manifestFile = path.join(moduleRoot, 'manifest.json');
      const manifest = readJson(manifestFile, null);
      const manifestDigest = digestFile(manifestFile);
      sourceHash.update('manifest:' + folder + ':' + (manifestDigest || 'MISSING') + '\n');
      const manifestErrors = validateTargetManifest(manifest, folder);
      const entryFile = manifest && manifest.entry ? path.resolve(moduleRoot, manifest.entry) : null;
      const entryInside = !!entryFile && (entryFile === moduleRoot || entryFile.startsWith(moduleRoot + path.sep));
      const entryExists = entryInside && fs.existsSync(entryFile);
      const selftests = listSelftests(moduleRoot, root);
      const promotionSelftest = choosePromotionSelftest(folder, selftests);
      const selftestDigest = promotionSelftest ? digestSelftestSuite(root, selftests) : null;
      sourceHash.update('selftest:' + folder + ':' + (selftestDigest || 'MISSING') + '\n');
      const conventionalContract = path.join(moduleRoot, 'module.contract.json');
      const contractFile = manifest && manifest.contract
        ? path.resolve(moduleRoot, manifest.contract)
        : (fs.existsSync(conventionalContract) ? conventionalContract : null);
      const contractInside = !!contractFile && contractFile.startsWith(moduleRoot + path.sep);
      const contract = contractInside ? readJson(contractFile, null) : null;
      const contractDigest = contractFile ? digestFile(contractFile) : null;
      sourceHash.update('contract:' + folder + ':' + (contractDigest || 'MISSING') + '\n');
      const contractCheck = contract
        ? ContractVerifier.validateContract(contract, manifest)
        : { pass: false, errors: ['module contract missing'] };
      const verified = freshness(manifest && manifest.verifiedAt, now.getTime(), Number(ladder.freshnessDays || 30));
      const verification = resultById.get(manifest && manifest.id || folder) || null;
      const verificationCurrent = !!verification && verification.selftestSha256 === selftestDigest && verification.selftestDigestScope === SELFTEST_DIGEST_SCOPE;
      const blockers = [];
      if (manifestErrors.length) blockers.push.apply(blockers, manifestErrors);
      if (!entryExists) blockers.push('declared entry is missing or escapes the tool folder');
      if (!manifest || !Array.isArray(manifest.permissions)) blockers.push('permissions are undeclared');
      if (!manifest || !KINDS.has(manifest.kind)) blockers.push('kind is undeclared');
      if (!contractCheck.pass) blockers.push('valid module contract is missing');
      if (!promotionSelftest) blockers.push('top-level executable selftest is missing');
      if (manifest && ['WORKING', 'CANON'].includes(manifest.status) && promotionSelftest && !verification) blockers.push('current selftest PASS result is missing');
      if (verification && !verificationCurrent) blockers.push('selftest result is stale for the current selftest digest');
      if (verificationCurrent && verification.verdict !== 'PASS') blockers.push('current selftest did not pass');
      if (manifest && ['WORKING', 'CANON'].includes(manifest.status) && verified.state !== 'FRESH') blockers.push('verifiedAt is not fresh');
      let promotionState = 'NOT_APPLICABLE';
      if (manifest && manifest.status === 'TEST') {
        promotionState = blockers.length ? 'BLOCKED' : verificationCurrent && verification.verdict === 'PASS' ? 'READY_FOR_HUMAN_REVIEW' : 'NEEDS_SELFTEST_RUN';
      } else if (manifest && ['WORKING', 'CANON'].includes(manifest.status)) {
        promotionState = blockers.length ? 'CLAIM_NEEDS_REVERIFICATION' : 'CURRENT';
      } else if (manifest && manifest.status === 'SHELL') promotionState = 'SHELL_DECISION_REQUIRED';

      const provides = contract && Array.isArray(contract.provides) ? contract.provides.slice() : [];
      const consumes = contract && Array.isArray(contract.consumes) ? contract.consumes.slice() : [];
      provides.forEach(id => {
        if (!capabilities.has(id)) capabilities.set(id, { id, providers: [], consumers: [] });
        capabilities.get(id).providers.push(manifest && manifest.id || folder);
      });
      consumes.forEach(id => {
        if (!capabilities.has(id)) capabilities.set(id, { id, providers: [], consumers: [] });
        capabilities.get(id).consumers.push(manifest && manifest.id || folder);
      });

      tools.push({
        id: manifest && manifest.id || folder,
        folder,
        name: manifest && manifest.name || folder,
        version: manifest && manifest.version || null,
        status: manifest && manifest.status || 'BROKEN',
        schema: manifest && manifest.schema || 'LEGACY_UNVERSIONED',
        kind: manifest && manifest.kind || 'UNDECLARED',
        audience: manifest && manifest.audience || 'UNDECLARED',
        manifest: { path: portable(root, manifestFile), sha256: manifestDigest, valid: manifestErrors.length === 0, errors: manifestErrors },
        entry: { path: entryFile && entryInside ? portable(root, entryFile) : null, exists: entryExists },
        permissionsDeclared: !!manifest && Array.isArray(manifest.permissions),
        usesDeclared: !!manifest && Array.isArray(manifest.uses),
        contract: { path: contractFile && contractInside ? portable(root, contractFile) : null, declared: !!(manifest && manifest.contract), present: !!contract, valid: contractCheck.pass, errors: contractCheck.errors, provides, consumes },
        selftest: { paths: selftests, promotionPath: promotionSelftest, sha256: selftestDigest, digestScope: SELFTEST_DIGEST_SCOPE, result: verificationCurrent ? verification : null },
        readme: ['README.md', 'README.txt'].map(name => path.join(moduleRoot, name)).some(file => fs.existsSync(file)),
        discoveryReview: fs.existsSync(path.join(moduleRoot, 'discovery-seam-review.js')),
        verifiedAt: manifest && manifest.verifiedAt || null,
        freshness: verified,
        promotion: { state: promotionState, blockers: Array.from(new Set(blockers)) }
      });
    });

  const queue = { readyForHumanReview: [], needsSelftestRun: [], blocked: [], shellDecisionRequired: [], claimsNeedingReverification: [] };
  tools.forEach(tool => {
    if (tool.promotion.state === 'READY_FOR_HUMAN_REVIEW') queue.readyForHumanReview.push(tool.id);
    else if (tool.promotion.state === 'NEEDS_SELFTEST_RUN') queue.needsSelftestRun.push(tool.id);
    else if (tool.promotion.state === 'BLOCKED') queue.blocked.push({ id: tool.id, blockers: tool.promotion.blockers });
    else if (tool.promotion.state === 'SHELL_DECISION_REQUIRED') queue.shellDecisionRequired.push(tool.id);
    else if (tool.promotion.state === 'CLAIM_NEEDS_REVERIFICATION') queue.claimsNeedingReverification.push({ id: tool.id, blockers: tool.promotion.blockers });
  });
  const statusCounts = {};
  tools.forEach(tool => { statusCounts[tool.status] = Number(statusCounts[tool.status] || 0) + 1; });
  const capabilityRows = Array.from(capabilities.values()).map(row => ({ id: row.id, providers: row.providers.sort(), consumers: row.consumers.sort() })).sort((a, b) => a.id.localeCompare(b.id));

  return {
    schema: INDEX_SCHEMA,
    generatedAt: now.toISOString(),
    sourceDigest: sourceHash.digest('hex'),
    promotionLadder: 'shared/readiness/promotion-ladder.json',
    summary: {
      tools: tools.length,
      statuses: statusCounts,
      contractsPresent: tools.filter(tool => tool.contract.present).length,
      contractsValid: tools.filter(tool => tool.contract.valid).length,
      topLevelSelftests: tools.filter(tool => !!tool.selftest.promotionPath).length,
      anySelftests: tools.filter(tool => tool.selftest.paths.length > 0).length,
      permissionsDeclared: tools.filter(tool => tool.permissionsDeclared).length,
      kindsDeclared: tools.filter(tool => tool.kind !== 'UNDECLARED').length,
      readmes: tools.filter(tool => tool.readme).length,
      capabilities: capabilityRows.length
    },
    promotionQueue: queue,
    capabilities: capabilityRows,
    tools,
    truth: {
      automaticPromotion: false,
      structuralEligibilityIsRuntimeProof: false,
      selftestPassIsHumanApproval: false,
      selftestReceiptBindsDiscoveredSuite: true,
      capabilityCatalogGrantsAuthority: false,
      missingValuesRemainVisible: true
    }
  };
}

function validateIndex(index) {
  const errors = [];
  if (!index || typeof index !== 'object') return { pass: false, errors: ['index is not an object'] };
  if (index.schema !== INDEX_SCHEMA) errors.push('schema must be ' + INDEX_SCHEMA);
  if (!/^[a-f0-9]{64}$/.test(String(index.sourceDigest || ''))) errors.push('sourceDigest must be sha256');
  if (!Array.isArray(index.tools)) errors.push('tools must be an array');
  if (!Array.isArray(index.capabilities)) errors.push('capabilities must be an array');
  if (!index.promotionQueue || typeof index.promotionQueue !== 'object') errors.push('promotionQueue is required');
  if (!index.truth || index.truth.automaticPromotion !== false) errors.push('automaticPromotion must remain false');
  if (Array.isArray(index.tools)) {
    index.tools.forEach(tool => {
      if (!tool || !tool.promotion || !['READY_FOR_HUMAN_REVIEW', 'CURRENT'].includes(tool.promotion.state)) return;
      const selftest = tool.selftest || {};
      const result = selftest.result;
      const digestBoundPass = !!result && selftest.digestScope === SELFTEST_DIGEST_SCOPE && result.id === tool.id && result.verdict === 'PASS' && result.selftestSha256 === selftest.sha256 && result.selftestDigestScope === selftest.digestScope;
      if (!digestBoundPass) errors.push(String(tool.id || 'unknown tool') + ': ' + tool.promotion.state + ' requires a digest-bound PASS selftest result');
    });
  }
  return { pass: errors.length === 0, errors };
}

module.exports = { INDEX_SCHEMA, MANIFEST_SCHEMA, STATUSES, KINDS, SELFTEST_DIGEST_SCOPE, buildIndex, validateIndex, validateTargetManifest, digestFile, digestSelftestSuite, isVerificationTarget };
