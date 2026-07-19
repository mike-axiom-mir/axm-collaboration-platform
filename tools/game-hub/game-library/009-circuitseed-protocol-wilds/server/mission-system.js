'use strict';

const crypto = require('node:crypto');

function objectiveParts(value) { return String(value).split(':'); }
function dedupe(id, suffix) { return 'mission:' + id + ':' + suffix; }

class MissionSystem {
  constructor(missionData, profileStore, worldStore) {
    this.data = missionData; this.profileStore = profileStore; this.worldStore = worldStore;
  }
  current(session) { return this.data.stages[session.worldRuntime.story.stageIndex] || null; }
  ensureProgress(session) {
    const mission = this.current(session);
    if (!mission) return null;
    if (!session.missionProgress || session.missionProgress.missionId !== mission.id) session.missionProgress = { missionId: mission.id, counts: {}, completed: false, startedAt: Date.now() };
    return session.missionProgress;
  }
  record(session, key, count = 1) {
    const progress = this.ensureProgress(session); if (!progress || progress.completed) return { complete: false, reason: 'no-active-mission' };
    progress.counts[key] = (progress.counts[key] || 0) + count;
    const mission = this.current(session);
    const status = mission.objectives.map(objective => {
      const parts = objectiveParts(objective);
      const required = parts.length > 2 && /^\d+$/.test(parts[parts.length - 1]) ? Number(parts.pop()) : 1;
      const lookup = parts.join(':');
      return { objective, current: progress.counts[lookup] || 0, required, complete: (progress.counts[lookup] || 0) >= required };
    });
    progress.completed = status.every(item => item.complete);
    session.events.push({ type: 'mission-progress', missionId: mission.id, key, status });
    return { complete: progress.completed, mission, status };
  }
  dynamicMission(session) {
    const values = session.worldRuntime.instability;
    const region = Object.keys(values).sort((a, b) => values[b] - values[a])[0];
    const template = this.data.dynamicTemplates.find(item => item.requires.toLowerCase().startsWith(region)) || this.data.dynamicTemplates[0];
    return { ...template, derivedFrom: { region, instability: values[region] }, generated: false, templateBound: true };
  }
  resolveDynamic(session, action) {
    const currentMission = this.current(session);
    if (!currentMission || !currentMission.objectives.includes('dynamic:resolve')) throw new Error('dynamic-mission-not-active');
    const mission = this.dynamicMission(session);
    if (!mission.actions.map(value => value.toLowerCase()).includes(String(action).toLowerCase())) throw new Error('dynamic-action-does-not-fit-world-state');
    const nextWorld = this.worldStore.mutate(session.worldId, draft => {
      const before = Number(draft.instability[mission.derivedFrom.region] || 0);
      draft.instability[mission.derivedFrom.region] = Math.max(0, before - 18);
      draft.worldEvents.push({
        type: 'dynamic-world-resolution', region: mission.derivedFrom.region,
        action: String(action).toLowerCase(), before,
        after: draft.instability[mission.derivedFrom.region], at: new Date().toISOString()
      });
    });
    session.worldRuntime = JSON.parse(JSON.stringify(nextWorld));
    session.ledger.append('dynamic-world-resolution', {
      region: mission.derivedFrom.region, action: String(action).toLowerCase(),
      instability: nextWorld.instability[mission.derivedFrom.region], worldVersion: nextWorld.version
    });
    return this.record(session, 'dynamic:resolve');
  }
  cooperativePulse(session, seatId) {
    session.coopPulse = session.coopPulse || {};
    session.coopPulse[seatId] = Date.now();
    const active = Object.values(session.actors).filter(actor => actor.active);
    const recent = active.filter(actor => Date.now() - (session.coopPulse[actor.seatId] || 0) < 3000);
    const solo = active.length === 1 && this.profileStore.get(active[0].profileId).circuitkinRoster.length > 0;
    if (recent.length >= 2 || solo) return this.record(session, 'coop:synchronize');
    return { complete: false, waitingFor: 'another occupied seat or trusted Circuitkin' };
  }
  createEnvelope(session) {
    const mission = this.current(session); const progress = this.ensureProgress(session);
    if (!mission || !progress || !progress.completed) throw new Error('mission-objectives-not-complete');
    return {
      schema: 'axm.circuitseed-mission-envelope/v1', envelopeId: 'env-' + crypto.randomBytes(10).toString('hex'),
      missionId: mission.id, worldId: session.worldId, sessionId: session.id, createdAt: new Date().toISOString(),
      participantRewards: JSON.parse(JSON.stringify(mission.reward || {})),
      worldConsequences: { completeStage: mission.id, nextStageIndex: session.worldRuntime.story.stageIndex + 1, rootSignalState: mission.id === 'm10-rootsignal' ? 'heard-with-conflict-preserved' : session.worldRuntime.story.rootSignalState },
      commits: { participants: {}, world: null }
    };
  }
  applyReward(profile, mission, reward) {
    profile.currency += Number(reward.currency || 0);
    for (const [material, count] of Object.entries(reward.materials || {})) profile.inventory.materials[material] = (profile.inventory.materials[material] || 0) + count;
    if (reward.recipe && !profile.recipes.includes(reward.recipe)) profile.recipes.push(reward.recipe);
    if (reward.achievement && !profile.achievements.includes(reward.achievement)) profile.achievements.push(reward.achievement);
    if (reward.reputation) profile.business.reputation += reward.reputation;
    if (reward.trust) Object.values(profile.relationships).forEach(value => { value.trust = Math.min(100, value.trust + reward.trust); });
    if (reward.relationship) Object.values(profile.relationships).forEach(value => { value.trust = Math.min(100, value.trust + reward.relationship); });
    profile.history.push({ type: 'mission-reward', missionId: mission.id, reward, at: new Date().toISOString() });
  }
  commitEnvelope(session, envelope) {
    const mission = this.data.stages.find(item => item.id === envelope.missionId); if (!mission) throw new Error('mission-envelope-unknown');
    session.ledger.append('mission-envelope-opened', { envelopeId: envelope.envelopeId, missionId: mission.id }, { dedupeKey: dedupe(mission.id, 'opened') });
    for (const actor of Object.values(session.actors).filter(value => value.occupied)) {
      const current = this.profileStore.get(actor.profileId); const receipt = dedupe(mission.id, actor.profileId);
      if (current.receipts.includes(receipt)) { envelope.commits.participants[actor.profileId] = { status: 'deduplicated', version: current.version }; continue; }
      const next = this.profileStore.mutate(actor.profileId, profile => { this.applyReward(profile, mission, envelope.participantRewards); profile.receipts.push(receipt); });
      envelope.commits.participants[actor.profileId] = { status: 'committed', version: next.version };
      session.ledger.append('participant-reward-commit', { envelopeId: envelope.envelopeId, missionId: mission.id, profileId: actor.profileId, profileVersion: next.version }, { dedupeKey: receipt, actorId: actor.id });
    }
    const world = this.worldStore.get(session.worldId); const worldReceipt = dedupe(mission.id, 'world');
    if (world.worldEvents.some(event => event.receipt === worldReceipt)) {
      envelope.commits.world = { status: 'deduplicated', version: world.version };
      session.worldRuntime = JSON.parse(JSON.stringify(world));
    } else {
      const nextWorld = this.worldStore.mutate(session.worldId, draft => {
        draft.story.completedStages.push(mission.id); draft.story.stageIndex = Math.max(draft.story.stageIndex, envelope.worldConsequences.nextStageIndex);
        draft.story.rootSignalState = envelope.worldConsequences.rootSignalState;
        draft.worldEvents.push({ receipt: worldReceipt, missionId: mission.id, at: new Date().toISOString(), consequence: envelope.worldConsequences });
      });
      session.worldRuntime = JSON.parse(JSON.stringify(nextWorld));
      envelope.commits.world = { status: 'committed', version: nextWorld.version };
      session.ledger.append('world-consequence-commit', { envelopeId: envelope.envelopeId, missionId: mission.id, worldVersion: nextWorld.version }, { dedupeKey: worldReceipt });
    }
    session.missionProgress = null;
    session.ledger.append('mission-envelope-acknowledged', { envelopeId: envelope.envelopeId, commits: envelope.commits });
    return envelope;
  }
}

module.exports = { MissionSystem, dedupe };
