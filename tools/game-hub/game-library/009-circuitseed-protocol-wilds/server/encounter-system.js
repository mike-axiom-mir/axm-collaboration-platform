'use strict';

const { TACTICAL_ACTIONS } = require('../shared/constants');
const { createRng, seedFromText } = require('../shared/rng');

const DEFINITIONS = {
  'corewild-breach': { name: 'Corewild Boundary Failure', stabilityGoal: 85, threat: 72, integrity: 100, stages: 2 },
  'rootsignal-fracture': { name: 'Rootsignal Fracture', stabilityGoal: 140, threat: 120, integrity: 120, stages: 3 },
  'friendly-1v1': { name: 'Friendly Signal Simulation · 1v1', stabilityGoal: 55, threat: 45, integrity: 80, stages: 1, friendly: true },
  'friendly-2v2': { name: 'Friendly Signal Simulation · 2v2', stabilityGoal: 80, threat: 65, integrity: 100, stages: 2, friendly: true }
};

function recommendations(encounter) {
  const list = [];
  if (!encounter.scanDepth) list.push('Scan');
  if (encounter.partyIntegrity < 45) list.push('Patch');
  if (encounter.threat > encounter.stability) list.push('Shield');
  if (encounter.conflict > 25) list.push('Challenge');
  return list.length ? list.slice(0, 2) : ['Synchronize'];
}

class EncounterSystem {
  constructor(circuitkinSystem = null, profileStore = null) { this.circuitkinSystem = circuitkinSystem; this.profileStore = profileStore; }
  start(session, id) {
    const definition = DEFINITIONS[id]; if (!definition) throw new Error('unknown-encounter');
    const active = Object.values(session.actors).filter(actor => actor.active && actor.controllerType !== 'spectator');
    if (id === 'friendly-1v1' && active.length < 2) throw new Error('friendly-1v1-needs-two-seats');
    if (id === 'friendly-2v2' && active.length < 4) throw new Error('friendly-2v2-needs-four-seats');
    const participantKin = {};
    const kinDesignIds = [];
    const families = active.map(actor => {
      const profile = this.profileStore && this.profileStore.get(actor.profileId);
      const kin = profile && profile.circuitkinRoster.find(item => item.designId === actor.circuitkinId) || profile?.circuitkinRoster[0];
      const design = kin && this.circuitkinSystem?.design(kin.designId);
      if (kin) {
        participantKin[actor.seatId] = { designId: kin.designId, name: design?.name || kin.name, family: design?.family || kin.family, tier: design?.tier || kin.tier || 'individual', signature: design?.signature || null };
        kinDesignIds.push(kin.designId);
      }
      return design?.family || kin?.family;
    }).filter(Boolean);
    const compatibilityScores = [];
    if (this.circuitkinSystem) for (let first = 0; first < kinDesignIds.length; first += 1) for (let second = first + 1; second < kinDesignIds.length; second += 1) compatibilityScores.push(this.circuitkinSystem.compatibilityForDesign(kinDesignIds[first], kinDesignIds[second]));
    const teamCompatibility = compatibilityScores.length ? Number((compatibilityScores.reduce((sum, value) => sum + value, 0) / compatibilityScores.length).toFixed(2)) : null;
    session.encounter = {
      schema: 'axm.circuitseed-tactical-encounter/v1', id, name: definition.name, friendly: !!definition.friendly,
      status: 'running', round: 1, stage: 1, stages: definition.stages, stability: 0, stabilityGoal: definition.stabilityGoal,
      threat: definition.threat, partyIntegrity: definition.integrity, maxPartyIntegrity: definition.integrity,
      teamCompatibility,
      participantKin,
      shields: 0, scanDepth: 0, conflict: id === 'rootsignal-fracture' ? 35 : 18,
      operators: active.filter(actor => actor.role === 'field-operator').slice(0, 4).map(actor => actor.seatId),
      participation: Object.fromEntries(active.map(actor => [actor.seatId, { role: actor.role, actions: 0, contribution: 0 }])),
      log: [], recommendations: [], rngState: seedFromText(session.worldRuntime.worldSeed + ':' + id + ':' + session.tick)
    };
    session.encounter.recommendations = recommendations(session.encounter);
    session.ledger.append('encounter-start', { id, operators: session.encounter.operators, participation: session.encounter.participation });
    return this.publicState(session.encounter);
  }
  allowedForRole(role, action) {
    if (role === 'field-operator' || role === 'round-rotation') return true;
    const support = { 'support-console': ['Scan','Challenge','Synchronize'], scan: ['Scan','Isolate'], item: ['Shield','Patch','Anchor'], vote: ['Challenge','Synchronize','Reroute'] };
    return (support[role] || ['Scan','Synchronize']).includes(action);
  }
  apply(session, seatId, action) {
    const encounter = session.encounter; const actor = session.actors[seatId];
    if (!encounter || encounter.status !== 'running') throw new Error('encounter-not-running');
    if (!actor || !actor.active || !encounter.participation[seatId]) throw new Error('seat-not-participating');
    if (!TACTICAL_ACTIONS.includes(action)) throw new Error('unknown-tactical-action');
    if (!this.allowedForRole(actor.role, action)) throw new Error('action-not-available-to-role');
    const rng = createRng(encounter.rngState); const variance = rng.int(0, 3); encounter.rngState = rng.snapshot();
    const effect = { stability: 0, threat: 0, integrity: 0, shields: 0, conflict: 0, scan: 0 };
    if (action === 'Scan') { effect.scan = 1; effect.stability = 5 + variance; }
    if (action === 'Anchor') { effect.stability = 9 + Math.min(4, encounter.scanDepth); effect.threat = -2; }
    if (action === 'Shield') { effect.shields = 10 + variance; effect.stability = 3; }
    if (action === 'Patch') { effect.integrity = encounter.scanDepth ? 12 + variance : 4; effect.stability = encounter.scanDepth ? 5 : -2; }
    if (action === 'Reroute') { effect.threat = -(7 + variance); effect.stability = 6; }
    if (action === 'Challenge') { effect.conflict = -(8 + variance); effect.stability = 5; }
    if (action === 'Isolate') { effect.threat = -(10 + variance); effect.stability = 3; }
    if (action === 'Synchronize') { const participants = Object.keys(encounter.participation).length; const compatibilityBonus = encounter.teamCompatibility == null ? 0 : Math.max(0, Math.round((encounter.teamCompatibility - 0.68) * 20)); effect.stability = 6 + Math.min(8, participants * 2) + compatibilityBonus; effect.conflict = -3; }
    const kinBoost = this.circuitkinSystem?.actionBonus(encounter.participantKin?.[seatId]?.designId, action) || { amount: 0, source: null, signature: false };
    if (kinBoost.amount) {
      if (action === 'Shield') effect.shields += kinBoost.amount * 2;
      else if (action === 'Patch') effect.integrity += kinBoost.amount * 2;
      else if (action === 'Isolate') effect.threat -= kinBoost.amount * 2;
      else effect.stability += kinBoost.amount;
    }
    effect.circuitkinBonus = kinBoost.amount;
    effect.circuitkinSource = kinBoost.source;
    effect.signature = kinBoost.signature;
    encounter.scanDepth += effect.scan; encounter.stability = Math.max(0, encounter.stability + effect.stability);
    encounter.threat = Math.max(0, encounter.threat + effect.threat); encounter.shields += effect.shields;
    encounter.partyIntegrity = Math.min(encounter.maxPartyIntegrity, encounter.partyIntegrity + effect.integrity);
    encounter.conflict = Math.max(0, encounter.conflict + effect.conflict);
    encounter.participation[seatId].actions += 1; encounter.participation[seatId].contribution += Math.max(0, effect.stability - effect.threat + effect.integrity + effect.shields / 2);
    const incoming = Math.max(0, Math.round(encounter.threat * 0.045 + encounter.conflict * 0.03) - Math.round(encounter.shields * 0.22));
    encounter.shields = Math.max(0, encounter.shields - 4); encounter.partyIntegrity = Math.max(0, encounter.partyIntegrity - incoming);
    encounter.log.push({ round: encounter.round, seatId, role: actor.role, action, effect, incoming });
    encounter.round += 1;
    const stageGoal = encounter.stabilityGoal * (encounter.stage / encounter.stages);
    if (encounter.stability >= stageGoal && encounter.stage < encounter.stages) { encounter.stage += 1; encounter.log.push({ type: 'stage-stabilized', stage: encounter.stage - 1 }); }
    if (encounter.stability >= encounter.stabilityGoal || encounter.threat === 0) encounter.status = 'resolved';
    else if (encounter.partyIntegrity === 0) encounter.status = 'recovery-required';
    encounter.recommendations = recommendations(encounter);
    if (encounter.status !== 'running') session.ledger.append('encounter-result', { id: encounter.id, status: encounter.status, rounds: encounter.round - 1, participation: encounter.participation });
    return this.publicState(encounter);
  }
  recover(session) {
    const encounter = session.encounter; if (!encounter || encounter.status !== 'recovery-required') throw new Error('recovery-not-required');
    encounter.partyIntegrity = Math.ceil(encounter.maxPartyIntegrity * 0.45); encounter.threat = Math.max(10, encounter.threat - 12); encounter.status = 'running'; encounter.log.push({ type: 'recovered-with-consequence' });
    return this.publicState(encounter);
  }
  publicState(encounter) {
    if (!encounter) return null;
    const { rngState, ...publicState } = encounter;
    return JSON.parse(JSON.stringify(publicState));
  }
}

module.exports = { DEFINITIONS, EncounterSystem, recommendations };
