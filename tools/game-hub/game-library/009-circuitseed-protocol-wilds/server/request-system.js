'use strict';

function totalUses(kin) {
  return Object.values(kin?.development?.uses || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function measure(profile, requirement) {
  const roster = profile.circuitkinRoster || [];
  switch (requirement.type) {
    case 'discoveries': return (profile.discoveries || []).length;
    case 'memoryEchoes': return (profile.discoveries || []).filter(item => item && typeof item === 'object' && item.kind === 'memory-echo').length;
    case 'individuals': return roster.filter(kin => (kin.tier || 'individual') !== 'confluence').length;
    case 'confluences': return roster.filter(kin => kin.tier === 'confluence').length;
    case 'fieldUses': return roster.reduce((sum, kin) => sum + totalUses(kin), 0);
    case 'recoveries': return roster.reduce((sum, kin) => sum + Number(kin?.development?.recoveries || 0), 0);
    case 'specializations': return (profile.specializationHistory || []).filter(item => item.type === 'focus-branch').length;
    case 'crafted': return (profile.history || []).filter(item => item.type === 'crafted').length;
    case 'orders': return (profile.business?.completedOrders || []).length;
    case 'reputation': return Number(profile.business?.reputation || 0);
    case 'achievement': return (profile.achievements || []).includes(requirement.value) ? 1 : 0;
    default: return 0;
  }
}

class RequestSystem {
  constructor(data, profileStore) {
    this.data = data;
    this.profileStore = profileStore;
    this.byId = new Map(data.requests.map(request => [request.id, request]));
  }

  receipt(id) { return 'field-request:' + id; }

  evaluate(profile, request) {
    const progress = request.requirements.map(requirement => {
      const actual = measure(profile, requirement);
      const required = Number(requirement.count || 1);
      return { type: requirement.type, label: requirement.label, actual, required, complete: actual >= required };
    });
    const claimed = (profile.receipts || []).includes(this.receipt(request.id));
    return {
      id: request.id,
      category: request.category,
      issuer: request.issuer,
      title: request.title,
      brief: request.brief,
      rewards: JSON.parse(JSON.stringify(request.rewards || {})),
      progress,
      claimed,
      eligible: !claimed && progress.every(item => item.complete)
    };
  }

  summary(profile) {
    const requests = this.data.requests.map(request => this.evaluate(profile, request));
    return {
      title: this.data.boardTitle,
      total: requests.length,
      claimed: requests.filter(request => request.claimed).length,
      ready: requests.filter(request => request.eligible).length,
      requests
    };
  }

  applyRewards(profile, rewards) {
    profile.currency += Number(rewards.currency || 0);
    for (const [id, count] of Object.entries(rewards.materials || {})) profile.inventory.materials[id] = (profile.inventory.materials[id] || 0) + Number(count || 0);
    for (const [id, count] of Object.entries(rewards.items || {})) profile.inventory.items[id] = (profile.inventory.items[id] || 0) + Number(count || 0);
    for (const recipeId of rewards.recipes || []) if (!profile.recipes.includes(recipeId)) profile.recipes.push(recipeId);
    for (const achievementId of rewards.achievements || []) if (!profile.achievements.includes(achievementId)) profile.achievements.push(achievementId);
    profile.business.reputation += Number(rewards.reputation || 0);
    const trust = Number(rewards.trust || 0);
    if (trust) {
      for (const kin of profile.circuitkinRoster) {
        kin.trust = Math.min(100, Number(kin.trust || 0) + trust);
        if (profile.relationships[kin.designId]) profile.relationships[kin.designId].trust = kin.trust;
      }
    }
  }

  claim(profileId, requestId) {
    const request = this.byId.get(requestId);
    if (!request) throw new Error('unknown-field-request');
    const current = this.profileStore.get(profileId);
    const evaluation = this.evaluate(current, request);
    if (evaluation.claimed) throw new Error('field-request-already-claimed');
    if (!evaluation.eligible) {
      const error = new Error('field-request-requirements-not-met');
      error.missing = evaluation.progress.filter(item => !item.complete);
      throw error;
    }
    const profile = this.profileStore.mutate(profileId, draft => {
      this.applyRewards(draft, request.rewards || {});
      draft.receipts.push(this.receipt(requestId));
      draft.history.push({ type: 'field-request-claimed', requestId, rewards: request.rewards || {}, at: new Date().toISOString() });
    });
    return { profile, request: this.evaluate(profile, request), board: this.summary(profile) };
  }
}

module.exports = { RequestSystem, measure, totalUses };
