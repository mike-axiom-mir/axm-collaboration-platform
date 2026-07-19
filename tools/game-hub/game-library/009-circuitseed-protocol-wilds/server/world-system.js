'use strict';

const { INPUT_TIMEOUT_MS } = require('../shared/constants');
const { consumePulse } = require('./input-gate');

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function regionAt(bones, position) {
  return bones.regions.find(region => position.x >= region.bounds.x && position.x <= region.bounds.x + region.bounds.width && position.y >= region.bounds.y && position.y <= region.bounds.y + region.bounds.height) || bones.regions[0];
}
function nearest(items, position, maxDistance = 86) {
  return items.map(item => ({ item, d: distance(item, position) })).filter(value => value.d <= maxDistance).sort((a, b) => a.d - b.d)[0]?.item || null;
}

class WorldSystem {
  constructor(bones) { this.bones = bones; }
  tick(session, now, deltaSeconds) {
    session.tick += 1;
    for (const actor of Object.values(session.actors)) {
      if (!actor.active) continue;
      if (actor.controllerType === 'ai') this.hostAiIntent(actor, session);
      if (actor.controllerType !== 'ai' && now - actor.lastInputAt > INPUT_TIMEOUT_MS) actor.input = {};
      const dx = Number(actor.input.moveX || 0), dy = Number(actor.input.moveY || 0);
      const speed = actor.role === 'field-operator' ? 185 : 160;
      const old = { ...actor.position };
      actor.position.x = Math.max(28, Math.min(this.bones.size.width - 28, actor.position.x + dx * speed * deltaSeconds));
      actor.position.y = Math.max(28, Math.min(this.bones.size.height - 28, actor.position.y + dy * speed * deltaSeconds));
      if (Math.hypot(dx, dy) > 0.05) actor.facing = { x: dx, y: dy };
      actor.sessionStats.distance += distance(old, actor.position);
      actor.currentRegionId = regionAt(this.bones, actor.position).id;
      actor.energy = Math.min(100, actor.energy + deltaSeconds * 2);
    }
    session.worldRuntime.conditions.signalPressure = Math.max(0, Math.min(100, session.worldRuntime.conditions.signalPressure + Math.sin(session.tick / 240) * 0.015));
  }
  hostAiIntent(actor, session) {
    const angle = (session.tick / 80) + actor.slot * 1.7;
    actor.input = { moveX: Math.cos(angle) * 0.3, moveY: Math.sin(angle) * 0.3, moveActive: true };
  }
  nearbyPoint(actor) { return nearest(this.bones.points, actor.position); }
  nearbyResource(actor, session) { return nearest(this.bones.resourceNodes.filter(node => !session.worldRuntime.resourcesRecovered[node.id]), actor.position, 72); }
  collectResource(session, actor) {
    const node = this.nearbyResource(actor, session); if (!node) return null;
    session.worldRuntime.resourcesRecovered[node.id] = { profileId: actor.profileId, at: new Date().toISOString() };
    return node;
  }
  consumeWorldPulses(actor) {
    return Object.fromEntries(['scan','connect','deploy','assist','recover','return','build','interact'].map(field => [field, consumePulse(actor, field)]));
  }
}

module.exports = { WorldSystem, distance, nearest, regionAt };
