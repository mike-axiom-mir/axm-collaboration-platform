'use strict';

const { TICK_MS, TICK_RATE } = require('../shared/constants');
const { updateAiPlayerInputs } = require('./ai-player-system');
const { updateBaseRegeneration } = require('./base-system');
const { updateCombat } = require('./combat-system');
const { updateMission } = require('./mission-system');
const { updateNpcs } = require('./npc-system');
const { updateJustice } = require('./justice-system');
const { updatePlayers } = require('./player-system');
const { updateTerritory } = require('./territory-system');
const { updateVehicles } = require('./vehicle-system');

function advanceWorld(world, options = {}) {
  const deltaSeconds = options.deltaSeconds || 1 / TICK_RATE;
  const now = options.now || Date.now();
  world.tick += 1;
  updateAiPlayerInputs(world);
  updatePlayers(world, deltaSeconds, now);
  updateVehicles(world, deltaSeconds, now);
  updateCombat(world, deltaSeconds);
  updateBaseRegeneration(world, deltaSeconds);
  updateNpcs(world, deltaSeconds);
  updateTerritory(world, deltaSeconds);
  updateMission(world);
  updateJustice(world, deltaSeconds);
  world.metrics.connectedControllers = Object.values(world.actors)
    .filter((actor) => ['human', 'adapter'].includes(actor.controller) && actor.connected).length;
  return world;
}

class WorldLoop {
  constructor(getSession, options = {}) {
    this.getSession = getSession;
    this.intervalMs = options.intervalMs || TICK_MS;
    this.timer = null;
    this.lastTickAt = 0;
  }

  start() {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const session = this.getSession();
      if (session?.status === 'running' && session.world) {
        session.world.metrics.loopDriftMs = Math.round((now - this.lastTickAt) - this.intervalMs);
        advanceWorld(session.world, { deltaSeconds: 1 / TICK_RATE, now });
      }
      this.lastTickAt = now;
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { WorldLoop, advanceWorld };
