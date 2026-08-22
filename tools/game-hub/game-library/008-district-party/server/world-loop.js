'use strict';

const { TICK_MS, TICK_RATE } = require('../shared/constants');
const { updateAiPlayerInputs } = require('./ai-player-system');
const { updateBaseRegeneration } = require('./base-system');
const { updateCombat } = require('./combat-system');
const { updateMission } = require('./mission-system');
const { updateNpcs } = require('./npc-system');
const { updateJustice } = require('./justice-system');
const { updatePlayers } = require('./player-system');
const { isGroupSaveMenuOpen, updateGroupSaveComputer } = require('./group-save-system');
const { updateTerritory } = require('./territory-system');
const { updateVehicles } = require('./vehicle-system');
const { updateCityLife } = require('./city-life-system');
const { updateCombatGear } = require('./combat-gear-system');

function updateConnectedMetrics(world) {
  world.metrics.connectedControllers = Object.values(world.actors)
    .filter((actor) => ['human', 'adapter'].includes(actor.controller) && actor.connected).length;
}

function advanceWorld(world, options = {}) {
  const deltaSeconds = options.deltaSeconds || 1 / TICK_RATE;
  const now = options.now || Date.now();
  world.tick += 1;
  updateGroupSaveComputer(world);
  if (isGroupSaveMenuOpen(world)) {
    updateConnectedMetrics(world);
    return world;
  }
  updateCombatGear(world);
  updateAiPlayerInputs(world);
  updatePlayers(world, deltaSeconds, now);
  if (isGroupSaveMenuOpen(world)) {
    updateConnectedMetrics(world);
    return world;
  }
  updateVehicles(world, deltaSeconds, now);
  updateCombat(world, deltaSeconds);
  updateBaseRegeneration(world, deltaSeconds);
  updateNpcs(world, deltaSeconds);
  updateTerritory(world, deltaSeconds);
  updateMission(world);
  updateJustice(world, deltaSeconds);
  updateCityLife(world);
  updateConnectedMetrics(world);
  return world;
}

class WorldLoop {
  constructor(getSession, options = {}) {
    this.getSession = getSession;
    this.processSession = typeof options.processSession === 'function' ? options.processSession : null;
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
        this.processSession?.(session);
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
