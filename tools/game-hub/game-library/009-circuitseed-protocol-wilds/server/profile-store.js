'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { atomicWriteJson, ensureDir, hashObject, listJson, readJson, safeId } = require('./storage');

function iso() { return new Date().toISOString(); }
function profileId() { return 'cs-' + crypto.randomBytes(10).toString('hex'); }

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('profile-object-required');
  if (profile.schema !== 'axm.circuitseed-router-profile/v1' || profile.schemaVersion !== 1) throw new Error('profile-schema-incompatible');
  if (!profile.profileId || safeId(profile.profileId) !== profile.profileId) throw new Error('profile-id-invalid');
  if (!Number.isInteger(profile.version) || profile.version < 1) throw new Error('profile-version-invalid');
  if (typeof profile.displayName !== 'string' || !profile.displayName.trim() || profile.displayName.length > 48) throw new Error('profile-display-name-invalid');
  if (!['human','ai','adapter'].includes(profile.identityType)) throw new Error('profile-identity-type-invalid');
  if (!Array.isArray(profile.evolutionHistory)) profile.evolutionHistory = [];
  if (profile.activeCircuitkinId === undefined) profile.activeCircuitkinId = profile.circuitkinRoster?.[0]?.designId || null;
  if (profile.activeCircuitkinId !== null && typeof profile.activeCircuitkinId !== 'string') throw new Error('profile-active-circuitkin-invalid');
  for (const field of ['circuitkinRoster','trainingHistory','specializationHistory','evolutionHistory','discoveries','achievements','recipes','engineHistory','receipts','history']) {
    if (!Array.isArray(profile[field])) throw new Error('profile-field-invalid-' + field);
  }
  for (const field of ['appearance','inventory','relationships','business','permissions','lastSafeCheckpoint']) {
    if (!profile[field] || typeof profile[field] !== 'object' || Array.isArray(profile[field])) throw new Error('profile-field-invalid-' + field);
  }
  return profile;
}

function defaultProfile(input = {}) {
  const identityType = ['human','ai','adapter'].includes(input.identityType) ? input.identityType : 'human';
  const id = safeId(input.profileId) || profileId();
  const createdAt = iso();
  const engineHistory = [];
  if (identityType !== 'human' && input.operatingEngine) {
    engineHistory.push({ engine: String(input.operatingEngine).slice(0, 120), recordedAt: createdAt, claim: 'declared operating engine; no model-memory claim' });
  }
  return {
    schema: 'axm.circuitseed-router-profile/v1', schemaVersion: 1, profileId: id, version: 1,
    displayName: String(input.displayName || 'Local Pathfinder').slice(0, 48), identityType,
    createdAt, updatedAt: createdAt,
    appearance: { hue: Number.isFinite(input.hue) ? Math.max(0, Math.min(360, input.hue)) : 174, mark: String(input.mark || 'seed-ring').slice(0, 40) },
    circuitkinRoster: [], activeCircuitkinId: null, trainingHistory: [], specializationHistory: [], evolutionHistory: [],
    inventory: { materials: {}, items: {}, capacity: 32 }, currency: 100,
    discoveries: [], achievements: [], recipes: ['service-kit'], relationships: {},
    business: { name: String(input.businessName || 'Unfinished Signal').slice(0, 48), path: null, reputation: 0, open: false, completedOrders: [] },
    permissions: { safeExtraction: true, autoTransferControl: false, workshopAuthority: false },
    lastSafeCheckpoint: { regionId: 'lumen-yard', x: 330, y: 360, storyStage: 0, recordedAt: createdAt },
    engineHistory,
    receipts: [],
    history: [{ type: 'profile-created', at: createdAt }]
  };
}

class ProfileStore {
  constructor(root) {
    this.root = ensureDir(root);
    this.recoveryRoot = ensureDir(path.join(root, 'recovery'));
  }
  file(id) { const safe = safeId(id); if (!safe) throw new Error('invalid-profile-id'); return path.join(this.root, safe + '.json'); }
  list() { return listJson(this.root).map(validateProfile).map(profile => ({
    profileId: profile.profileId,
    version: profile.version,
    displayName: profile.displayName,
    identityType: profile.identityType,
    circuitkinCount: profile.circuitkinRoster.length,
    individualCount: profile.circuitkinRoster.filter(kin => (kin.tier || 'individual') !== 'confluence').length,
    specialistCount: profile.circuitkinRoster.filter(kin => kin.tier === 'confluence').length,
    activeCircuitkinId: profile.activeCircuitkinId || null,
    updatedAt: profile.updatedAt
  })); }
  get(id) { const profile = readJson(this.file(id)); return profile ? validateProfile(profile) : null; }
  create(input) { const profile = defaultProfile(input); if (this.get(profile.profileId)) throw new Error('profile-already-exists'); atomicWriteJson(this.file(profile.profileId), profile, { backup: false }); return profile; }
  save(profile, expectedVersion) {
    const current = this.get(profile.profileId);
    if (!current) throw new Error('profile-not-found');
    if (Number.isInteger(expectedVersion) && current.version !== expectedVersion) {
      const error = new Error('profile-version-conflict'); error.code = 'PROFILE_CONFLICT'; error.current = current; throw error;
    }
    const next = JSON.parse(JSON.stringify(profile));
    next.schema = 'axm.circuitseed-router-profile/v1'; next.schemaVersion = 1;
    next.version = current.version + 1; next.updatedAt = iso();
    atomicWriteJson(this.file(next.profileId), next);
    return next;
  }
  mutate(id, mutator) {
    const current = this.get(id); if (!current) throw new Error('profile-not-found');
    const draft = JSON.parse(JSON.stringify(current));
    mutator(draft); return this.save(draft, current.version);
  }
  export(id) { const profile = this.get(id); if (!profile) throw new Error('profile-not-found'); return { exportedAt: iso(), schema: profile.schema, profile }; }
  import(packet) {
    const incoming = packet && packet.profile ? packet.profile : packet;
    validateProfile(incoming);
    const current = this.get(incoming.profileId);
    if (!current) { atomicWriteJson(this.file(incoming.profileId), incoming, { backup: false }); return { ok: true, status: 'imported', profile: incoming }; }
    if (hashObject(current) === hashObject(incoming)) return { ok: true, status: 'already-current', profile: current };
    const recovery = path.join(this.recoveryRoot, safeId(incoming.profileId) + '-' + Date.now() + '.recovery.json');
    atomicWriteJson(recovery, incoming, { backup: false });
    return { ok: false, status: 'conflict', currentVersion: current.version, incomingVersion: incoming.version, recoveryCopy: path.basename(recovery), report: 'Divergent profile preserved as recovery copy; current profile not overwritten.' };
  }
  recordEngineChange(id, engine) {
    return this.mutate(id, profile => {
      if (profile.identityType === 'human') throw new Error('engine-history-only-for-machine-identity');
      profile.engineHistory.push({ engine: String(engine).slice(0, 120), recordedAt: iso(), claim: 'declared operating engine; no model-memory claim' });
    });
  }
}

module.exports = { ProfileStore, defaultProfile, validateProfile };
