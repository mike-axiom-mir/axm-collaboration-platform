'use strict';

const fs = require('fs');
const path = require('path');
const U = require('../operations/operations-utils');
const ReadinessObserver = require('../readiness/readiness-observer');

const NEED_SCHEMA = 'axm.workshop-need/v1';
const READINESS_VIEW_SCHEMA = ReadinessObserver.VIEW_SCHEMA;
const STATES = ['OPEN', 'MATCHED', 'READY_TO_CLOSE', 'SATISFIED', 'PAUSED', 'CANCELLED'];

function textList(value, limit) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))).slice(0, limit || 200).sort();
}

function create(options) {
  const root = options.root, intake = options.modularIntakeService;
  const stateFile = path.join(options.stateRoot, 'workshop-needs-observatory', 'needs.json');
  const auditFile = path.join(options.stateRoot, 'workshop-needs-observatory', 'audit.jsonl');
  const readinessObserver = ReadinessObserver.create({
    root,
    stateRoot: options.stateRoot,
    indexFile: options.readinessIndexFile,
    receiptFile: options.readinessReceiptFile,
    humanGate: options.humanGate || 'Mike'
  });
  function read() { return U.loadJson(stateFile, { schema: 'axm.workshop-needs-state/v1', needs: [] }); }
  function write(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }

  function readinessSnapshot() { return readinessObserver.snapshot(); }

  function installedCapabilities() {
    const byCapability = new Map(), modules = [], toolsRoot = path.join(root, 'tools');
    if (fs.existsSync(toolsRoot)) for (const entry of fs.readdirSync(toolsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(toolsRoot, entry.name, 'manifest.json'), 'utf8'));
        const contractFile = manifest.contract && path.join(toolsRoot, entry.name, manifest.contract);
        const contract = contractFile && fs.existsSync(contractFile) ? JSON.parse(fs.readFileSync(contractFile, 'utf8')) : {};
        // Only machine-declared interface identifiers count as installed
        // capabilities. Human-facing action prose is useful documentation, but
        // it is not an exact contract and must never satisfy a need by accident.
        const capabilities = textList([].concat(contract.provides || [], manifest.produces || []), 1000);
        modules.push({ id: manifest.id, title: manifest.name, source: 'installed-module', capabilities });
        capabilities.forEach(capability => { if (!byCapability.has(capability)) byCapability.set(capability, []); byCapability.get(capability).push(manifest.id); });
      } catch (_) {}
    }
    const promoted = intake.status().promoted.map(record => ({ id: record.piece.id, title: record.piece.title, source: 'promoted-piece', capabilities: textList(record.piece.capabilities && record.piece.capabilities.provides) }));
    promoted.forEach(item => item.capabilities.forEach(capability => { if (!byCapability.has(capability)) byCapability.set(capability, []); byCapability.get(capability).push(item.id); }));
    return { modules, promoted, capabilities: Array.from(byCapability.entries()).map(([id, providers]) => ({ id, providers: Array.from(new Set(providers)).sort() })).sort((a, b) => a.id.localeCompare(b.id)) };
  }

  function declarationAudit() {
    const toolsRoot = path.join(root, 'tools'), findings = [];
    if (!fs.existsSync(toolsRoot)) return { scanned: 0, findings, summary: { blocking: 0, review: 0, legacy: 0 } };
    const folders = fs.readdirSync(toolsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('_')).sort((a, b) => a.name.localeCompare(b.name));
    folders.forEach(entry => {
      const folder = entry.name, moduleRoot = path.join(toolsRoot, folder), manifestFile = path.join(moduleRoot, 'manifest.json');
      if (!fs.existsSync(manifestFile)) { findings.push({ folder, code: 'MISSING_MANIFEST', severity: 'BLOCKING', truth: 'Tool folder has no manifest.json.' }); return; }
      let manifest;
      try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); }
      catch (error) { findings.push({ folder, code: 'INVALID_MANIFEST', severity: 'BLOCKING', truth: 'manifest.json is not valid JSON: ' + error.message }); return; }
      if (!String(manifest.id || '').trim()) findings.push({ folder, code: 'MISSING_MANIFEST_ID', severity: 'BLOCKING', truth: 'Manifest does not declare an id.' });
      else if (manifest.id !== folder && manifest.folderAlias !== folder) findings.push({ folder, declaredId: manifest.id, code: 'ID_FOLDER_MISMATCH', severity: 'REVIEW', truth: 'Declared id differs from the folder name; confirm an intentional legacy alias.' });
      if (!String(manifest.entry || '').trim()) findings.push({ folder, code: 'MISSING_ENTRY_DECLARATION', severity: 'BLOCKING', truth: 'Manifest does not declare its entry file.' });
      else {
        try { if (!fs.existsSync(path.join(moduleRoot, U.safeRelative(manifest.entry)))) findings.push({ folder, code: 'DECLARED_ENTRY_MISSING', severity: 'BLOCKING', truth: 'The declared entry file does not exist.' }); }
        catch (error) { findings.push({ folder, code: 'UNSAFE_ENTRY_DECLARATION', severity: 'BLOCKING', truth: error.message }); }
      }
      if (!String(manifest.contract || '').trim()) findings.push({ folder, code: 'MODULE_CONTRACT_NOT_DECLARED', severity: 'LEGACY', truth: 'Module is discoverable, but has no typed module-contract declaration yet.' });
      else {
        try { if (!fs.existsSync(path.join(moduleRoot, U.safeRelative(manifest.contract)))) findings.push({ folder, code: 'DECLARED_CONTRACT_MISSING', severity: 'BLOCKING', truth: 'The declared module contract file does not exist.' }); }
        catch (error) { findings.push({ folder, code: 'UNSAFE_CONTRACT_DECLARATION', severity: 'BLOCKING', truth: error.message }); }
      }
    });
    return { schema: 'axm.declaration-drift-audit/v1', scanned: folders.length, findings, summary: {
      blocking: findings.filter(item => item.severity === 'BLOCKING').length,
      review: findings.filter(item => item.severity === 'REVIEW').length,
      legacy: findings.filter(item => item.severity === 'LEGACY').length
    } };
  }

  function createNeed(input, actor) {
    const body = input || {}, capabilities = textList(body.requiredCapabilities || body.capabilities);
    if (!String(body.title || '').trim()) throw new Error('need title is required');
    if (!capabilities.length) throw new Error('at least one exact required capability is required');
    const state = read(), need = {
      schema: NEED_SCHEMA, id: U.uid('need'), title: String(body.title).trim().slice(0, 180),
      description: String(body.description || '').trim().slice(0, 3000), requiredCapabilities: capabilities,
      priority: Math.max(0, Math.min(100, Math.round(Number(body.priority) || 50))), state: 'OPEN',
      candidateId: null, history: [{ state: 'OPEN', actor: String(actor || 'local-user').slice(0, 120), at: U.now(), reason: 'need-created' }],
      createdAt: U.now(), createdBy: String(actor || 'local-user').slice(0, 120)
    };
    state.needs.unshift(need); write(state); audit({ type: 'need-created', id: need.id, capabilities, actor }); return need;
  }

  function getNeed(state, id) { const need = state.needs.find(item => item.id === id); if (!need) throw new Error('need not found'); return need; }
  function candidate(candidateId) { const found = intake.status().candidates.find(item => item.id === candidateId); if (!found) throw new Error('candidate not found'); return found; }
  function coverage(need, item) {
    const provided = textList(item && item.piece && item.piece.capabilities && item.piece.capabilities.provides);
    const missing = need.requiredCapabilities.filter(capability => !provided.includes(capability));
    return { pass: missing.length === 0, provided, missing };
  }
  function match(needId, candidateId, actor) {
    const state = read(), need = getNeed(state, needId), item = candidate(candidateId), checked = coverage(need, item);
    if (!checked.pass) throw new Error('candidate misses required capabilities: ' + checked.missing.join(', '));
    if (['SATISFIED', 'CANCELLED'].includes(need.state)) throw new Error('closed need cannot be matched');
    need.candidateId = candidateId; need.state = ['PROMOTED', 'ROUTED_TO_MODULE_INSTALLER'].includes(item.state) ? 'READY_TO_CLOSE' : 'MATCHED';
    need.history.push({ state: need.state, actor: String(actor || 'local-user').slice(0, 120), at: U.now(), reason: 'exact-capability-match', candidateId });
    write(state); audit({ type: 'need-matched', id: need.id, candidateId, state: need.state, actor }); return Object.assign({}, need, { coverage: checked });
  }
  function transition(needId, input) {
    const body = input || {}, target = String(body.state || '').toUpperCase();
    if (!STATES.includes(target)) throw new Error('invalid need state');
    const state = read(), need = getNeed(state, needId), actor = String(body.actor || 'local-user').slice(0, 120);
    if (target === 'SATISFIED') {
      if (body.confirmation !== 'ACCEPT BUILT CAPABILITY') throw new Error('exact satisfaction confirmation is required');
      const item = candidate(need.candidateId), checked = coverage(need, item);
      if (!checked.pass || !['PROMOTED', 'ROUTED_TO_MODULE_INSTALLER'].includes(item.state)) throw new Error('matched piece is not promoted with the exact required capabilities');
    }
    need.state = target; need.history.push({ state: target, actor, at: U.now(), reason: String(body.reason || 'explicit-transition').slice(0, 500) }); write(state); audit({ type: 'need-transition', id: need.id, state: target, actor }); return need;
  }

  function status() {
    const state = read(), inventory = installedCapabilities(), declarationDrift = declarationAudit(), readiness = readinessSnapshot(), intakeStatus = intake.status(), available = new Set(inventory.capabilities.map(item => item.id));
    const needs = state.needs.map(need => {
      const copy = U.clone(need), item = need.candidateId && intakeStatus.candidates.find(candidate => candidate.id === need.candidateId);
      if (item) { copy.coverage = coverage(need, item); if (copy.state === 'MATCHED' && ['PROMOTED', 'ROUTED_TO_MODULE_INSTALLER'].includes(item.state)) copy.computedState = 'READY_TO_CLOSE'; }
      copy.currentlyAvailable = need.requiredCapabilities.filter(capability => available.has(capability));
      copy.currentlyMissing = need.requiredCapabilities.filter(capability => !available.has(capability));
      return copy;
    });
    const unknownFamilies = intakeStatus.candidates.filter(item => item.state === 'QUARANTINED_CATEGORY_PROPOSAL').map(item => item.piece.family);
    const derived = [];
    if (readiness.state !== 'CURRENT') derived.push({ id: 'readiness-index-evidence', gapType: 'READINESS_EVIDENCE', title: 'Refresh deterministic module-readiness evidence', status: readiness.state, truth: readiness.reason });
    if (!intakeStatus.backup.configured) derived.push({ id: 'external-component-backup', gapType: 'SUBSTRATE', title: 'Configure external modular-library backup target', status: 'MISSING_SUBSTRATE', truth: intakeStatus.backup.truth });
    declarationDrift.findings.forEach(item => derived.push({ id: 'declaration-' + item.folder + '-' + item.code.toLowerCase(), gapType: 'DECLARATION_' + item.severity, title: item.folder + ': ' + item.code, status: item.code, truth: item.truth }));
    Array.from(new Set(unknownFamilies)).sort().forEach(family => derived.push({ id: 'family-contract-' + family, gapType: 'CONTRACT', title: 'Decide a neutral contract for family: ' + family, status: 'FAMILY_CONTRACT_REQUIRED', truth: 'The intake refuses to guess this category direction.' }));
    needs.filter(need => !['SATISFIED', 'CANCELLED'].includes(need.state)).forEach(need => need.currentlyMissing.forEach(capability => derived.push({ id: 'capability-' + U.sha256(capability).slice(0, 12), gapType: 'HAND_OR_COMPONENT', title: capability, status: 'MISSING_CAPABILITY', needId: need.id })));
    return { schema: 'axm.workshop-needs-observatory/v1', needs, inventory, declarationDrift, readiness, derived, candidates: intakeStatus.candidates, summary: { open: needs.filter(item => !['SATISFIED', 'CANCELLED'].includes(item.state)).length, satisfied: needs.filter(item => item.state === 'SATISFIED').length, installedModules: inventory.modules.length, promotedPieces: inventory.promoted.length, exactCapabilities: inventory.capabilities.length, reviewCandidates: readiness.reviewCandidates.length, readinessState: readiness.state, declarationFindings: declarationDrift.findings.length, derivedGaps: derived.length } };
  }

  return { NEED_SCHEMA, READINESS_VIEW_SCHEMA, createNeed, match, transition, status, installedCapabilities, declarationAudit, readinessSnapshot, stateFile, auditFile };
}

module.exports = { NEED_SCHEMA, READINESS_VIEW_SCHEMA, create };
