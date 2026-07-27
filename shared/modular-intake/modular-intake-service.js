'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const U = require('../operations/operations-utils');
const Families = require('./family-registry');
const UniversalComponent = require('../asset-hands/universal-component');

const PACKAGE_SCHEMA = 'axm.modular-piece-package/v1';
const CANDIDATE_SCHEMA = 'axm.modular-piece-candidate/v1';
const MAX_FILES = 300;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value) { return U.sha256(canonical(value)); }
function listOfText(value, limit) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(item => String(item || '').trim()).filter(Boolean))).slice(0, limit || 200).sort();
}
function decode(file) {
  const encoding = String(file.encoding || 'utf8').toLowerCase();
  if (!['utf8', 'base64'].includes(encoding)) throw new Error('file encoding must be utf8 or base64');
  return encoding === 'base64' ? Buffer.from(String(file.content || ''), 'base64') : Buffer.from(String(file.content || ''), 'utf8');
}
function readJsonFile(files, relative) {
  const item = files.find(file => file.path === relative);
  if (!item) return null;
  try { return JSON.parse(item.buffer.toString('utf8').replace(/^\uFEFF/, '')); }
  catch (_) { throw new Error(relative + ' must contain valid JSON'); }
}

function create(options) {
  const root = options.root;
  const review = options.reviewService;
  const installer = options.installerService;
  const stateRoot = path.join(options.stateRoot, 'modular-intake');
  const stateFile = path.join(stateRoot, 'candidates.json');
  const familyFile = path.join(stateRoot, 'families.json');
  const auditFile = path.join(stateRoot, 'audit.jsonl');
  const promotedRoot = path.join(root, 'intakes', 'modular-pieces', 'promoted');
  const backupRequestRoot = path.join(stateRoot, 'backup-requests');

  function readState() { return U.loadJson(stateFile, { schema: 'axm.modular-intake-state/v1', candidates: [], promoted: [] }); }
  function writeState(state) { state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function readFamilies() { return U.loadJson(familyFile, { schema: 'axm.modular-family-registry-state/v1', custom: [], proposals: [] }); }
  function writeFamilies(state) { state.updatedAt = U.now(); U.atomicJson(familyFile, state); }
  function familyRegistry() { return Families.create(readFamilies().custom); }
  function audit(event) { U.appendJsonl(auditFile, Object.assign({ at: U.now() }, event)); }

  function normalizePackage(input) {
    const source = input || {}, piece = source.piece || {}, errors = [];
    if (source.schema !== PACKAGE_SCHEMA) errors.push('package schema must be ' + PACKAGE_SCHEMA);
    let id = '', family = '';
    try { id = U.cleanId(piece.id, 'piece id'); } catch (error) { errors.push(error.message); }
    try { family = U.cleanId(piece.family, 'piece family'); } catch (error) { errors.push(error.message); }
    const version = String(piece.version || '').trim().slice(0, 80);
    if (!version || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,79}$/.test(version)) errors.push('piece version must be portable text');
    if (!String(piece.title || '').trim()) errors.push('piece title is required');
    const rawFiles = Array.isArray(source.files) ? source.files : [];
    if (!rawFiles.length || rawFiles.length > MAX_FILES) errors.push('package needs 1-' + MAX_FILES + ' files');
    let totalBytes = 0; const seen = new Set(), files = [];
    rawFiles.forEach((file, index) => {
      try {
        const relative = U.safeRelative(file.path);
        if (seen.has(relative.toLowerCase())) throw new Error('duplicate path');
        seen.add(relative.toLowerCase());
        const buffer = decode(file);
        if (buffer.length > MAX_FILE_BYTES) throw new Error('file exceeds 10 MiB');
        totalBytes += buffer.length;
        const fileDigest = U.sha256(buffer);
        if (file.sha256 && String(file.sha256).toLowerCase() !== fileDigest) throw new Error('declared digest mismatch');
        files.push({ path: relative, encoding: 'base64', content: buffer.toString('base64'), sha256: fileDigest, bytes: buffer.length, buffer });
      } catch (error) { errors.push('file ' + index + ': ' + error.message); }
    });
    if (totalBytes > MAX_TOTAL_BYTES) errors.push('package exceeds 30 MiB total');
    const capabilities = piece.capabilities || {};
    const normalized = {
      schema: PACKAGE_SCHEMA,
      piece: {
        id, family, version, title: String(piece.title || '').trim().slice(0, 180),
        summary: String(piece.summary || '').trim().slice(0, 2000),
        capabilities: { provides: listOfText(capabilities.provides), requires: listOfText(capabilities.requires) },
        protocols: listOfText(piece.protocols),
        provenance: piece.provenance && typeof piece.provenance === 'object' ? U.clone(piece.provenance) : {},
        resourceProfile: piece.resourceProfile && typeof piece.resourceProfile === 'object' ? U.clone(piece.resourceProfile) : {},
        activation: 'manual'
      },
      files: files.map(file => ({ path: file.path, encoding: file.encoding, content: file.content, sha256: file.sha256 })),
      requiredSeats: source.requiredSeats === 'dual' ? 'dual' : Math.max(2, Math.min(10, Number(source.requiredSeats) || 2))
    };
    return { pass: errors.length === 0, errors: Array.from(new Set(errors)), normalized, files, totalBytes };
  }

  function compatibility(normalized, files) {
    const piece = normalized.piece, family = familyRegistry().get(piece.family);
    if (!family) return { pass: false, status: 'FAMILY_CONTRACT_REQUIRED', errors: ['No family contract claims authority over ' + piece.family + '. The piece remains quarantined.'], warnings: [], family: null };
    const errors = [], warnings = [];
    if (!files.some(file => file.path === family.descriptorFile)) errors.push('family descriptor is missing: ' + family.descriptorFile);
    let descriptor = null;
    if (!errors.length) descriptor = readJsonFile(files, family.descriptorFile);
    if (piece.family === 'universal-component' && descriptor) {
      const checked = UniversalComponent.validateComponent(descriptor);
      errors.push(...checked.errors); warnings.push(...checked.warnings);
    } else if (piece.family === 'module' && descriptor) {
      if (descriptor.id !== piece.id) errors.push('module manifest id does not match piece id');
      if (!files.some(file => file.path === 'module.contract.json')) errors.push('module.contract.json is required');
    } else if (descriptor) {
      if (descriptor.id && String(descriptor.id) !== piece.id) errors.push('descriptor id does not match piece id');
      if (!descriptor.schema) warnings.push('descriptor has no schema claim; review must treat assurance as contract-only');
    }
    const risky = files.filter(file => /\.(?:exe|dll|msi|bat|cmd|ps1|sh|js|mjs|cjs|py|wasm)$/i.test(file.path)).map(file => file.path);
    if (risky.length) warnings.push('Executable-capable files are inert in quarantine: ' + risky.slice(0, 12).join(', '));
    return { pass: errors.length === 0, status: errors.length ? 'INCOMPATIBLE' : 'COMPATIBLE_CONTRACT', errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)), family, descriptor };
  }

  function inspect(input) {
    const parsed = normalizePackage(input);
    if (!parsed.pass) return { pass: false, status: 'INVALID_PACKAGE', errors: parsed.errors, warnings: [] };
    const checked = compatibility(parsed.normalized, parsed.files);
    return Object.assign({ packageDigest: digest(parsed.normalized), piece: parsed.normalized.piece, files: parsed.files.length, bytes: parsed.totalBytes }, checked);
  }

  function openReview(candidateId, actor) {
    const state = readState(), candidate = state.candidates.find(item => item.id === candidateId);
    if (!candidate) throw new Error('candidate not found');
    const files = candidate.package.files.map(file => Object.assign({}, file, { buffer: decode(file) }));
    const checked = compatibility(candidate.package, files);
    candidate.compatibility = checked;
    if (!checked.pass) { candidate.state = checked.status === 'FAMILY_CONTRACT_REQUIRED' ? 'QUARANTINED_CATEGORY_PROPOSAL' : 'QUARANTINED_INCOMPATIBLE'; writeState(state); return candidate; }
    const item = review.submit({
      kind: 'modular-piece-promotion', title: 'Promote ' + candidate.piece.title,
      sourceRef: 'modular-intake:' + candidate.id, artifactDigest: candidate.packageDigest,
      summary: candidate.piece.family + ' · ' + candidate.piece.id + '@' + candidate.piece.version + ' · inert until separately consumed',
      requiredSeats: candidate.requiredSeats,
      action: { type: 'promote-modular-piece', candidateId: candidate.id, executionAuthority: 'none' }
    });
    candidate.reviewId = item.id; candidate.state = 'QUARANTINED_REVIEW'; candidate.reviewOpenedAt = U.now(); candidate.reviewOpenedBy = actor;
    writeState(state); audit({ type: 'review-opened', candidateId: candidate.id, reviewId: item.id, digest: candidate.packageDigest, actor });
    return candidate;
  }

  function stage(input, actor) {
    const parsed = normalizePackage(input);
    if (!parsed.pass) throw new Error(parsed.errors.join('; '));
    const checked = compatibility(parsed.normalized, parsed.files), state = readState();
    const existing = state.candidates.find(item => item.packageDigest === digest(parsed.normalized));
    if (existing) return existing;
    const candidate = {
      schema: CANDIDATE_SCHEMA, id: U.uid('piece'), packageDigest: digest(parsed.normalized), package: parsed.normalized,
      piece: parsed.normalized.piece, fileCount: parsed.files.length, bytes: parsed.totalBytes, requiredSeats: parsed.normalized.requiredSeats,
      compatibility: checked, state: checked.pass ? 'QUARANTINED_PENDING_REVIEW' : checked.status === 'FAMILY_CONTRACT_REQUIRED' ? 'QUARANTINED_CATEGORY_PROPOSAL' : 'QUARANTINED_INCOMPATIBLE',
      reviewId: null, createdAt: U.now(), createdBy: String(actor || 'local-user').slice(0, 120)
    };
    state.candidates.unshift(candidate); writeState(state);
    audit({ type: 'staged', candidateId: candidate.id, family: candidate.piece.family, state: candidate.state, digest: candidate.packageDigest, actor });
    return checked.pass ? openReview(candidate.id, actor) : candidate;
  }

  function writePackage(target, candidate) {
    const parent = path.dirname(target), temp = target + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
    fs.mkdirSync(parent, { recursive: true });
    if (fs.existsSync(target)) throw new Error('exact family/id/version already exists; publish a new version instead of overwriting history');
    fs.mkdirSync(temp, { recursive: false });
    try {
      candidate.package.files.forEach(file => {
        const absolute = U.resolveUnder(temp, file.path); fs.mkdirSync(path.dirname(absolute), { recursive: true }); fs.writeFileSync(absolute, decode(file));
      });
      U.atomicJson(path.join(temp, 'axm-piece-receipt.json'), {
        schema: 'axm.modular-piece-promotion-receipt/v1', candidateId: candidate.id, packageDigest: candidate.packageDigest,
        piece: candidate.piece, executionAuthority: 'none', promotedAt: U.now()
      });
      fs.renameSync(temp, target);
    } catch (error) { try { fs.rmSync(temp, { recursive: true, force: true }); } catch (_) {} throw error; }
  }

  function emitBackupRequest(candidate, targetRef) {
    const request = {
      schema: 'axm.component-backup-request/v1', id: U.uid('backup-request'), artifactDigest: candidate.packageDigest,
      sourceRef: targetRef, externalTarget: null, state: 'AWAITING_CONFIGURED_TARGET', requiredAuthority: 'explicit-copy', createdAt: U.now(),
      truth: 'Local promoted copy exists. External 5 TB storage is not claimed until a target is configured and verified.'
    };
    U.atomicJson(path.join(backupRequestRoot, request.id + '.json'), request); return request;
  }

  function promote(candidateId, input) {
    const command = input || {};
    if (command.confirmation !== 'PROMOTE REVIEWED PIECE') throw new Error('exact promotion confirmation is required');
    const state = readState(), candidate = state.candidates.find(item => item.id === candidateId);
    if (!candidate) throw new Error('candidate not found');
    if (!candidate.compatibility || !candidate.compatibility.pass) throw new Error('candidate compatibility has not passed');
    if (!candidate.reviewId || !review.approved(candidate.reviewId, candidate.packageDigest)) throw new Error('exact candidate digest is not approved');
    if (digest(candidate.package) !== candidate.packageDigest) throw new Error('candidate digest drift refused');
    if (candidate.state === 'PROMOTED' || candidate.state === 'ROUTED_TO_MODULE_INSTALLER') return candidate;
    let result, targetRef;
    if (candidate.piece.family === 'module') {
      result = installer.stage({ schema: 'axm.module-bundle/v1', files: candidate.package.files, requiredSeats: 'dual' }, String(command.actor || 'local-user'));
      candidate.state = 'ROUTED_TO_MODULE_INSTALLER'; candidate.installerCandidateId = result.id; targetRef = 'module-installer:' + result.id;
    } else {
      const relative = U.safeRelative(candidate.piece.family + '/' + candidate.piece.id + '/' + candidate.piece.version);
      const target = U.resolveUnder(promotedRoot, relative); writePackage(target, candidate);
      targetRef = path.relative(root, target).replace(/\\/g, '/'); candidate.state = 'PROMOTED'; candidate.libraryRef = targetRef;
    }
    candidate.promotedAt = U.now(); candidate.promotedBy = String(command.actor || 'local-user').slice(0, 120);
    candidate.backupRequest = emitBackupRequest(candidate, targetRef);
    state.promoted.unshift({ candidateId: candidate.id, packageDigest: candidate.packageDigest, piece: candidate.piece, targetRef, state: candidate.state, promotedAt: candidate.promotedAt });
    writeState(state); audit({ type: 'promoted', candidateId: candidate.id, family: candidate.piece.family, targetRef, digest: candidate.packageDigest, actor: candidate.promotedBy });
    return candidate;
  }

  function proposeFamily(input, actor) {
    const contract = U.clone(input && input.contract || input || {}), checked = Families.validate(contract, false);
    if (!checked.pass) throw new Error(checked.errors.join('; '));
    const state = readFamilies();
    if (familyRegistry().get(contract.id)) throw new Error('family id already exists');
    contract.origin = 'reviewed-custom';
    const contractDigest = digest(contract), existing = state.proposals.find(item => item.contractDigest === contractDigest);
    if (existing) return existing;
    const proposal = { schema: 'axm.modular-family-proposal/v1', id: U.uid('family'), contract, contractDigest, state: 'PENDING_REVIEW', createdAt: U.now(), createdBy: actor };
    const item = review.submit({ kind: 'modular-family-contract', title: 'Register neutral family: ' + contract.title, sourceRef: 'modular-family:' + proposal.id, artifactDigest: contractDigest, summary: 'Adds recognition and neutral storage only; grants no execution authority.', requiredSeats: 'dual', action: { type: 'register-neutral-family', proposalId: proposal.id } });
    proposal.reviewId = item.id; state.proposals.unshift(proposal); writeFamilies(state); audit({ type: 'family-proposed', proposalId: proposal.id, family: contract.id, digest: contractDigest, actor }); return proposal;
  }

  function applyFamily(proposalId, input) {
    if (!input || input.confirmation !== 'REGISTER REVIEWED FAMILY') throw new Error('exact family confirmation is required');
    const state = readFamilies(), proposal = state.proposals.find(item => item.id === proposalId);
    if (!proposal) throw new Error('family proposal not found');
    if (!review.approved(proposal.reviewId, proposal.contractDigest)) throw new Error('exact family contract digest is not approved');
    if (digest(proposal.contract) !== proposal.contractDigest) throw new Error('family contract digest drift refused');
    if (familyRegistry().get(proposal.contract.id)) throw new Error('family id already exists');
    state.custom.push(proposal.contract); proposal.state = 'REGISTERED'; proposal.registeredAt = U.now(); proposal.registeredBy = String(input.actor || 'local-user').slice(0, 120); writeFamilies(state); audit({ type: 'family-registered', family: proposal.contract.id, digest: proposal.contractDigest, actor: proposal.registeredBy }); return proposal;
  }

  function status() {
    const state = readState(), families = readFamilies();
    function publicCandidate(candidate) {
      const copy = U.clone(candidate); delete copy.package;
      if (copy.compatibility) delete copy.compatibility.descriptor;
      return copy;
    }
    return {
      schema: 'axm.modular-intake-status/v1', candidates: state.candidates.map(publicCandidate), promoted: state.promoted,
      families: familyRegistry().list(), familyProposals: families.proposals,
      backup: { configured: false, pendingRequests: fs.existsSync(backupRequestRoot) ? fs.readdirSync(backupRequestRoot).filter(name => name.endsWith('.json')).length : 0, truth: 'External storage adapter is intentionally unconfigured.' },
      boundaries: { autoExecute: false, arbitraryDestinations: false, unknownFamilyCoercion: false, moduleBypass: false }
    };
  }

  return { PACKAGE_SCHEMA, inspect, stage, openReview, promote, proposeFamily, applyFamily, status, familyRegistry, stateFile, familyFile, auditFile };
}

module.exports = { PACKAGE_SCHEMA, create, canonical, digest };
