'use strict';

const STARTERS = new Set(['trace', 'mend', 'relay']);
const RECRUITMENT_EVIDENCE = new Set(['repair', 'trust', 'help', 'negotiation', 'unfinished-need']);

function newDevelopment() {
  return { uses: {}, failures: 0, recoveries: 0, pairings: {}, diagnoses: 0, uncertaintyAccepted: 0, conflictsSurfaced: 0 };
}

function totalUses(kin) {
  return Object.values(kin?.development?.uses || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

class CircuitkinSystem {
  constructor(catalog, profileStore) {
    this.catalog = catalog;
    this.profileStore = profileStore;
    this.byId = new Map(catalog.designs.map(design => [design.id, design]));
    this.individuals = catalog.designs.filter(design => design.tier !== 'confluence');
    this.specialists = catalog.designs.filter(design => design.tier === 'confluence');
  }

  design(id) { return this.byId.get(id) || null; }

  makeInstance(design, profile, options = {}) {
    return {
      instanceId: design.id + '-' + profile.profileId,
      designId: design.id,
      name: design.name,
      family: design.family,
      tier: design.tier || 'individual',
      state: design.tier === 'confluence' ? 'Confluence Circuitkin' : 'Circuitkin',
      trust: Number(options.trust ?? (design.starter ? 3 : 2)),
      branch: null,
      components: Array.isArray(design.components) ? [...design.components] : [],
      development: newDevelopment(),
      history: [options.history || { type: 'connected-by-consent', at: new Date().toISOString() }]
    };
  }

  recruitStarter(profileId, designId, reason = 'unfinished need repaired') {
    if (!STARTERS.has(designId)) throw new Error('starter-choice-rejected');
    const design = this.design(designId);
    if (!design || design.tier === 'confluence') throw new Error('unknown-circuitseed');
    return this.profileStore.mutate(profileId, profile => {
      if (profile.circuitkinRoster.length) throw new Error('starter-already-chosen');
      profile.circuitkinRoster.push(this.makeInstance(design, profile, {
        trust: 3,
        history: { type: 'connected-by-consent', reason, at: new Date().toISOString() }
      }));
      profile.activeCircuitkinId = designId;
      profile.relationships[designId] = { trust: 3, milestones: ['first-connection'] };
      profile.history.push({ type: 'starter-connected', designId, at: new Date().toISOString() });
    });
  }

  recruit(profileId, designId, evidence) {
    const design = this.design(designId);
    if (!design || design.tier === 'confluence') throw new Error('recruitment-design-rejected');
    if (!evidence || !RECRUITMENT_EVIDENCE.has(evidence.kind)) throw new Error('recruitment-needs-trust-or-repair-evidence');
    const current = this.profileStore.get(profileId);
    if (design.starter && !current.circuitkinRoster.length) throw new Error('opening-starter-relationship-required');
    if (current.circuitkinRoster.some(kin => kin.designId === designId)) return current;
    return this.profileStore.mutate(profileId, profile => {
      profile.circuitkinRoster.push(this.makeInstance(design, profile, {
        trust: 2,
        history: { type: 'connected-by-consent', evidence, at: new Date().toISOString() }
      }));
      if (!profile.activeCircuitkinId) profile.activeCircuitkinId = designId;
      profile.relationships[designId] = { trust: 2, milestones: ['unfinished-need-resolved'] };
      profile.history.push({ type: 'field-circuitkin-connected', designId, evidence, at: new Date().toISOString() });
    });
  }

  recordUse(profileId, designId, action, outcome = {}) {
    return this.profileStore.mutate(profileId, profile => {
      const kin = profile.circuitkinRoster.find(item => item.designId === designId);
      if (!kin) throw new Error('circuitkin-not-found');
      kin.development = kin.development || newDevelopment();
      kin.development.uses = kin.development.uses || {};
      kin.development.pairings = kin.development.pairings || {};
      kin.development.uses[action] = (kin.development.uses[action] || 0) + 1;
      if (outcome.failed) kin.development.failures += 1;
      if (outcome.recovered) kin.development.recoveries += 1;
      if (outcome.diagnosed) kin.development.diagnoses += 1;
      if (outcome.uncertaintyAccepted) kin.development.uncertaintyAccepted += 1;
      if (outcome.conflictSurfaced) kin.development.conflictsSurfaced += 1;
      if (outcome.pairedWith) kin.development.pairings[outcome.pairedWith] = (kin.development.pairings[outcome.pairedWith] || 0) + 1;
      kin.trust = Math.max(0, Math.min(100, Number(kin.trust || 0) + (outcome.trustDelta || (outcome.failed ? 0 : 0.5))));
      kin.history.push({ type: 'field-use', action, outcome: { failed: !!outcome.failed, recovered: !!outcome.recovered }, at: new Date().toISOString() });
      profile.trainingHistory.push({ designId, action, at: new Date().toISOString(), source: 'validated-game-action' });
      if (profile.relationships[designId]) profile.relationships[designId].trust = kin.trust;
    });
  }

  branchEligibility(profile, designId) {
    const design = this.design(designId);
    const kin = profile.circuitkinRoster.find(item => item.designId === designId);
    if (!design || !kin || design.tier === 'confluence') return [];
    return (design.branches || []).map(branch => {
      const requirements = branch.requires || {};
      const missing = [];
      for (const [key, required] of Object.entries(requirements)) {
        const actual = key === 'trust' ? kin.trust
          : key === 'scans' ? (kin.development.uses.Scan || 0)
            : key === 'assists' ? (kin.development.uses.Synchronize || 0)
              : key === 'recoveries' ? kin.development.recoveries
                : kin.development[key] || 0;
        if (actual < required) missing.push({ key, required, actual });
      }
      return { id: branch.id, name: branch.name, effect: branch.effect || null, eligible: !missing.length, missing };
    });
  }

  specialize(profileId, designId, branchId) {
    const profile = this.profileStore.get(profileId);
    const choice = this.branchEligibility(profile, designId).find(item => item.id === branchId);
    if (!choice || !choice.eligible) throw new Error('branch-requirements-not-met');
    return this.profileStore.mutate(profileId, draft => {
      const kin = draft.circuitkinRoster.find(item => item.designId === designId);
      if (kin.branch) throw new Error('branch-already-chosen');
      kin.branch = branchId;
      kin.history.push({ type: 'focus-specialized', branchId, at: new Date().toISOString() });
      draft.specializationHistory.push({ type: 'focus-branch', designId, branchId, at: new Date().toISOString(), explicitChoice: true });
    });
  }

  confluenceEligibility(profile, specialistId) {
    const design = this.design(specialistId);
    if (!design || design.tier !== 'confluence') return null;
    const connected = profile.circuitkinRoster.some(kin => kin.designId === specialistId);
    const missing = [];
    const components = design.components.map(componentId => {
      const componentDesign = this.design(componentId);
      const kin = profile.circuitkinRoster.find(item => item.designId === componentId);
      const uses = totalUses(kin);
      const trust = Number(kin?.trust || 0);
      if (!kin) missing.push({ key: 'component:' + componentId, label: componentDesign?.name || componentId, required: 1, actual: 0 });
      else {
        if (trust < 3) missing.push({ key: componentId + ':trust', label: componentDesign.name + ' trust', required: 3, actual: trust });
        if (uses < 2) missing.push({ key: componentId + ':fieldUses', label: componentDesign.name + ' field uses', required: 2, actual: uses });
      }
      return { designId: componentId, name: componentDesign?.name || componentId, connected: !!kin, trust, uses };
    });
    return {
      designId: design.id,
      name: design.name,
      tier: design.tier,
      connected,
      eligible: !connected && !missing.length,
      components,
      missing,
      signature: design.signature,
      inheritedActions: [...design.baseActions]
    };
  }

  confluenceOptions(profile) {
    return this.specialists.map(design => this.confluenceEligibility(profile, design.id));
  }

  evolve(profileId, specialistId) {
    const current = this.profileStore.get(profileId);
    const eligibility = this.confluenceEligibility(current, specialistId);
    if (!eligibility) throw new Error('unknown-confluence-specialist');
    if (eligibility.connected) throw new Error('confluence-already-connected');
    if (!eligibility.eligible) {
      const error = new Error('confluence-requirements-not-met');
      error.missing = eligibility.missing;
      throw error;
    }
    const design = this.design(specialistId);
    return this.profileStore.mutate(profileId, profile => {
      const parents = design.components.map(id => profile.circuitkinRoster.find(kin => kin.designId === id));
      const trust = Number((parents.reduce((sum, kin) => sum + Number(kin.trust || 0), 0) / parents.length).toFixed(1));
      profile.circuitkinRoster.push(this.makeInstance(design, profile, {
        trust,
        history: { type: 'confluence-evolved-by-consent', components: [...design.components], parentsPreserved: true, at: new Date().toISOString() }
      }));
      for (const parent of parents) parent.history.push({ type: 'confluence-parent', specialistId, selfPreserved: true, at: new Date().toISOString() });
      profile.relationships[specialistId] = { trust, milestones: ['confluence-evolution'] };
      profile.evolutionHistory = profile.evolutionHistory || [];
      profile.evolutionHistory.push({ specialistId, components: [...design.components], parentsPreserved: true, at: new Date().toISOString() });
      profile.specializationHistory.push({ type: 'confluence-evolution', designId: specialistId, components: [...design.components], at: new Date().toISOString(), explicitChoice: true });
      profile.history.push({ type: 'confluence-evolved', specialistId, components: [...design.components], at: new Date().toISOString() });
    });
  }

  selectActive(profileId, designId) {
    const current = this.profileStore.get(profileId);
    if (!current.circuitkinRoster.some(kin => kin.designId === designId)) throw new Error('circuitkin-not-in-roster');
    if (current.activeCircuitkinId === designId) return current;
    return this.profileStore.mutate(profileId, profile => {
      profile.activeCircuitkinId = designId;
      profile.history.push({ type: 'active-circuitkin-selected', designId, at: new Date().toISOString() });
    });
  }

  actionProfile(designId) {
    const design = this.design(designId);
    if (!design) return null;
    return {
      tier: design.tier || 'individual',
      inheritedActions: [...(design.baseActions || [])],
      signature: design.signature || null
    };
  }

  actionBonus(designId, action) {
    const profile = this.actionProfile(designId);
    if (!profile) return { amount: 0, source: null, signature: false };
    const inherited = profile.inheritedActions.includes(action);
    const signature = profile.signature?.action === action;
    const inheritedAmount = inherited ? (profile.tier === 'confluence' ? 4 : 2) : 0;
    const newSignatureRole = signature && profile.tier === 'confluence' && !inherited ? 4 : 0;
    const amount = inheritedAmount + newSignatureRole + (signature ? 3 : 0);
    return { amount, source: signature ? profile.signature.name : inherited ? (profile.tier === 'confluence' ? 'combined-role' : 'trained-role') : null, signature };
  }

  componentFamilies(designId) {
    const design = this.design(designId);
    if (!design) return [];
    if (design.tier !== 'confluence') return [design.family];
    return [...new Set(design.components.flatMap(id => this.componentFamilies(id)))];
  }

  compatibilityForDesign(firstId, secondId) {
    const first = this.componentFamilies(firstId);
    const second = this.componentFamilies(secondId);
    const scores = first.flatMap(firstFamily => second.map(secondFamily => this.compatibility(firstFamily, secondFamily)));
    return scores.length ? Math.max(...scores) : 0.74;
  }

  codex(profile) {
    const discoveries = new Set(profile.discoveries.map(item => typeof item === 'string' ? item : item.id));
    return this.catalog.designs.map(design => {
      const connected = profile.circuitkinRoster.some(kin => kin.designId === design.id);
      const active = profile.activeCircuitkinId === design.id;
      if (design.tier === 'confluence') {
        const evolution = this.confluenceEligibility(profile, design.id);
        return { designId: design.id, name: design.name, tier: design.tier, family: design.family, connected, active, status: connected ? 'connected' : evolution.eligible ? 'ready-to-evolve' : 'confluence-locked', evolution };
      }
      const opening = design.starter && profile.circuitkinRoster.length === 0;
      const discovered = opening || connected || (design.fieldSignal && discoveries.has(design.fieldSignal.pointId));
      return {
        designId: design.id,
        name: design.name,
        tier: design.tier || 'individual',
        family: design.family,
        connected,
        active,
        discovered,
        status: connected ? 'connected' : opening ? 'starter-path' : design.fieldSignal?.method === 'encounter-help' ? 'encounter-needed' : discovered ? 'ready-to-connect' : 'scan-needed',
        source: design.fieldSignal || null
      };
    });
  }

  compatibility(firstFamily, secondFamily) {
    const pairs = { 'Scout:Signal': 0.85, 'Repair:Guardian': 0.9, 'Builder:Root': 0.88, 'Care/Mediator:Wildcard': 0.82, 'Signal:Care/Mediator': 0.9 };
    return pairs[firstFamily + ':' + secondFamily] || pairs[secondFamily + ':' + firstFamily] || (firstFamily === secondFamily ? 0.68 : 0.74);
  }
}

module.exports = { CircuitkinSystem, STARTERS, newDevelopment, totalUses };
