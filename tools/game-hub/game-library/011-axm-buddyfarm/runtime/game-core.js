(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BuddyFarmCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SAVE_SCHEMA = 'axm.buddyfarm-save/v1';
  const GAME_ID = '011-axm-buddyfarm';
  const TRAVEL_HOLD_MS = 200;
  const WALK_DURATION_MS = 150;
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const BUDDY_RECIPES = Object.freeze({
    p1: Object.freeze({ id: 'mint-sprout', shirt: '#52e6ad', trim: '#e9ffad', hair: '#493326', boots: '#253d55' }),
    p2: Object.freeze({ id: 'sun-bloom', shirt: '#ffd36c', trim: '#fff1bd', hair: '#673c2e', boots: '#4e3e65' }),
    p3: Object.freeze({ id: 'violet-clover', shirt: '#bc8cff', trim: '#ffe0ff', hair: '#372d50', boots: '#234f52' })
  });

  const WORLD = Object.freeze({
    farm: {
      width: 384,
      height: 256,
      sourceWidth: 12288,
      sourceHeight: 8192,
      sourceUnitsPerCell: 32,
      chunkWidth: 32,
      chunkHeight: 32,
      chunkColumns: 12,
      chunkRows: 8
    },
    starterDistrict: { x: 0, y: 0, width: 40, height: 28 },
    house: { width: 14, height: 10 },
    cellar: { width: 12, height: 8 },
    houseExterior: { x: 15, y: 3, width: 10, height: 7, door: { x: 19, y: 9 } },
    portals: {
      farmDoor: { scene: 'farm', x: 19, y: 9, approach: { x: 19, y: 10 } },
      houseExit: { scene: 'house', x: 6, y: 9, approach: { x: 6, y: 8 } },
      houseStairs: { scene: 'house', x: 11, y: 2, approach: { x: 11, y: 3 } },
      cellarStairs: { scene: 'cellar', x: 6, y: 1, approach: { x: 6, y: 2 } }
    },
    bed: { scene: 'house', x: 3, y: 2 },
    plots: [
      { id: 'starter', name: 'Starter Garden', x: 15, y: 14, width: 10, height: 7, cost: 0, sign: null },
      { id: 'east-meadow', name: 'East Meadow', x: 25, y: 14, width: 9, height: 7, cost: 2, sign: { x: 25, y: 17 } },
      { id: 'west-meadow', name: 'West Meadow', x: 6, y: 14, width: 8, height: 7, cost: 4, sign: { x: 13, y: 17 } },
      { id: 'south-field', name: 'South Field', x: 15, y: 22, width: 10, height: 5, cost: 8, sign: { x: 19, y: 22 } }
    ]
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function actorSort(a, b) {
    return Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, ''));
  }

  function gamepadPlayerIds(actors, localPlayer, padCount) {
    const list = (Array.isArray(actors) ? actors : Object.values(actors || {})).slice().sort(actorSort);
    const humans = list.filter(actor => actor.type === 'human');
    const count = Math.max(0, Math.min(3, Number(padCount || 0)));
    void localPlayer;
    return humans.slice(0, count).map(actor => actor.id);
  }

  function cellKey(x, y) {
    return String(x) + ',' + String(y);
  }

  function normalizeRoster(roster) {
    const source = Array.isArray(roster) && roster.length ? roster.slice(0, 3) : [
      { slot: 1, seat_id: 'seat_1', display_name: 'Mike', type: 'human' },
      { slot: 2, seat_id: 'seat_2', display_name: 'Buddy', type: 'human' }
    ];
    return source.map((seat, index) => ({
      id: 'p' + (Number(seat.slot) || index + 1),
      seatId: seat.seat_id || 'seat_' + (index + 1),
      name: String(seat.display_name || seat.name || ('Buddy ' + (index + 1))).slice(0, 32),
      type: ['human', 'adapter', 'ai'].includes(seat.type) ? seat.type : 'human'
    }));
  }

  function createInitialState(roster) {
    const actors = {};
    normalizeRoster(roster).forEach((seat, index) => {
      actors[seat.id] = {
        id: seat.id,
        seatId: seat.seatId,
        name: seat.name,
        type: seat.type,
        scene: 'farm',
        x: 18 + index,
        y: 13,
        facing: 'down',
        fieldKit: { id: 'starter-field-kit', level: 1, upgrades: [] },
        appearance: clone(BUDDY_RECIPES[seat.id] || BUDDY_RECIPES.p3),
        helperBudget: seat.type === 'ai' ? { day: 1, completedTasks: 0, dailyLimit: 3 } : null,
        steps: 0,
        walkState: {
          sequence: 0,
          direction: 'down',
          from: { x: 18 + index, y: 13 },
          to: { x: 18 + index, y: 13 },
          durationMs: WALK_DURATION_MS,
          footstepAtMs: Math.floor(WALK_DURATION_MS / 2)
        },
        workState: { sequence: 0, kind: 'idle', target: null }
      };
    });
    return {
      schema: SAVE_SCHEMA,
      gameId: GAME_ID,
      revision: 0,
      day: 1,
      weather: 'soft-sun',
      actors,
      farm: {
        unlockedPlots: 1,
        growthTokens: 0,
        totalHarvests: 0,
        cells: {}
      },
      inventory: {
        seeds: 12,
        buddyCarrots: 0
      },
      exploration: {
        schema: 'axm.buddyfarm-fog/v1',
        exploredChunks: ['0,0', '1,0']
      },
      message: 'Welcome to BuddyFarm. The starter garden is ready.',
      events: []
    };
  }

  function boundsForScene(scene) {
    return WORLD[scene] || WORLD.farm;
  }

  function isWalkable(scene, x, y, worldAdapter) {
    const bounds = boundsForScene(scene);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return false;
    if (scene === 'farm') {
      if (plotContains(WORLD.starterDistrict, x, y)) {
        const house = WORLD.houseExterior;
        if (x >= house.x && x < house.x + house.width && y >= house.y && y < house.y + house.height) return false;
        return true;
      }
      return worldAdapter && typeof worldAdapter.isWalkableCell === 'function'
        ? worldAdapter.isWalkableCell(x, y)
        : true;
    }
    if (scene === 'house') {
      if (x < 1 || y < 1 || x > 12 || y > 8) return false;
      if ((x === 3 && y === 2) || (x === 4 && y === 2)) return false;
      if ((x === 9 || x === 10) && y === 2) return false;
      if (pointEquals({ x, y }, WORLD.portals.houseStairs)) return false;
      return true;
    }
    if (scene === 'cellar') {
      if (x < 1 || y < 1 || x > 10 || y > 6) return false;
      return !pointEquals({ x, y }, WORLD.portals.cellarStairs);
    }
    return false;
  }

  function targetFor(actor) {
    const delta = DIRECTIONS[actor.facing] || DIRECTIONS.down;
    return { x: actor.x + delta.x, y: actor.y + delta.y };
  }

  function pointEquals(point, other) {
    return point && other && point.x === other.x && point.y === other.y;
  }

  function plotContains(plot, x, y) {
    return x >= plot.x && x < plot.x + plot.width && y >= plot.y && y < plot.y + plot.height;
  }

  function unlockedPlotAt(state, x, y) {
    for (let index = 0; index < state.farm.unlockedPlots; index += 1) {
      if (plotContains(WORLD.plots[index], x, y)) return WORLD.plots[index];
    }
    return null;
  }

  function record(state, text, actorId) {
    state.revision += 1;
    state.message = text;
    state.events.push({ revision: state.revision, day: state.day, actorId: actorId || null, text });
    if (state.events.length > 24) state.events.splice(0, state.events.length - 24);
  }

  function move(state, actorId, direction, worldAdapter) {
    const actor = state.actors[actorId];
    const delta = DIRECTIONS[direction];
    if (!actor || !delta) return { ok: false, message: 'Unknown farm buddy or direction.' };
    actor.facing = direction;
    const next = { x: actor.x + delta.x, y: actor.y + delta.y };
    if (!isWalkable(actor.scene, next.x, next.y, worldAdapter)) {
      record(state, actor.name + ' found a boundary.', actorId);
      return { ok: false, message: state.message };
    }
    const from = { x: actor.x, y: actor.y };
    actor.x = next.x;
    actor.y = next.y;
    actor.steps += 1;
    actor.walkState = {
      sequence: Number(actor.walkState && actor.walkState.sequence || 0) + 1,
      direction,
      from,
      to: { x: actor.x, y: actor.y },
      durationMs: WALK_DURATION_MS,
      footstepAtMs: Math.floor(WALK_DURATION_MS / 2)
    };
    state.revision += 1;
    return { ok: true };
  }

  function placeActor(actor, scene, x, y, facing) {
    actor.scene = scene;
    actor.x = x;
    actor.y = y;
    actor.facing = facing;
    actor.walkState = {
      sequence: Number(actor.walkState && actor.walkState.sequence || 0) + 1,
      direction: facing,
      from: { x, y },
      to: { x, y },
      durationMs: WALK_DURATION_MS,
      footstepAtMs: Math.floor(WALK_DURATION_MS / 2)
    };
  }

  function enterHouse(state, actor) {
    placeActor(actor, 'house', WORLD.portals.houseExit.approach.x, WORLD.portals.houseExit.approach.y, 'up');
    record(state, actor.name + ' entered the farmhouse.', actor.id);
    return { ok: true, transition: 'house' };
  }

  function leaveHouse(state, actor) {
    placeActor(actor, 'farm', WORLD.portals.farmDoor.approach.x, WORLD.portals.farmDoor.approach.y, 'down');
    record(state, actor.name + ' stepped back onto the grassland.', actor.id);
    return { ok: true, transition: 'farm' };
  }

  function enterCellar(state, actor) {
    placeActor(actor, 'cellar', WORLD.portals.cellarStairs.approach.x, WORLD.portals.cellarStairs.approach.y, 'down');
    record(state, actor.name + ' descended into the cellar.', actor.id);
    return { ok: true, transition: 'cellar' };
  }

  function leaveCellar(state, actor) {
    placeActor(actor, 'house', WORLD.portals.houseStairs.approach.x, WORLD.portals.houseStairs.approach.y, 'up');
    record(state, actor.name + ' returned to the farmhouse.', actor.id);
    return { ok: true, transition: 'house' };
  }

  function sleepUntilMorning(state, actor) {
    Object.values(state.farm.cells).forEach(cell => {
      if (!cell.crop) return;
      if (cell.watered) cell.growth = Math.min(2, Number(cell.growth || 0) + 1);
      cell.watered = false;
    });
    state.day += 1;
    record(state, actor.name + ' ended the day. Every buddy wakes on day ' + state.day + '.', actor.id);
    return { ok: true, day: state.day };
  }

  function tryExpand(state, actor, target) {
    const nextIndex = state.farm.unlockedPlots;
    const next = WORLD.plots[nextIndex];
    if (!next || !next.sign || !pointEquals(next.sign, target)) return null;
    if (state.farm.growthTokens < next.cost) {
      record(state, next.name + ' needs ' + next.cost + ' growth tokens. The farm has ' + state.farm.growthTokens + '.', actor.id);
      return { ok: false, reason: 'needs-growth', cost: next.cost };
    }
    state.farm.growthTokens -= next.cost;
    state.farm.unlockedPlots += 1;
    record(state, actor.name + ' opened ' + next.name + '. The shared farm became larger.', actor.id);
    return { ok: true, expanded: next.id };
  }

  function interact(state, actorId, options) {
    const actor = state.actors[actorId];
    if (!actor) return { ok: false, message: 'Unknown farm buddy.' };
    const target = targetFor(actor);
    const heldLongEnough = Number(options && options.holdMs || 0) >= TRAVEL_HOLD_MS;
    const requireTravelHold = () => heldLongEnough
      ? null
      : { ok: false, reason: 'hold-required', requiredHoldMs: TRAVEL_HOLD_MS, message: 'Hold Action for 0.2 seconds to travel.' };
    if (actor.scene === 'farm') {
      if (pointEquals(target, WORLD.portals.farmDoor)) return requireTravelHold() || enterHouse(state, actor);
      const expansion = tryExpand(state, actor, target);
      if (expansion) return expansion;
    }
    if (actor.scene === 'house') {
      if (pointEquals(target, WORLD.portals.houseExit)) return requireTravelHold() || leaveHouse(state, actor);
      if (pointEquals(target, WORLD.portals.houseStairs)) return requireTravelHold() || enterCellar(state, actor);
      if (pointEquals(target, WORLD.bed)) return sleepUntilMorning(state, actor);
    }
    if (actor.scene === 'cellar' && pointEquals(target, WORLD.portals.cellarStairs)) return requireTravelHold() || leaveCellar(state, actor);
    record(state, actor.name + ' found nothing to use there.', actorId);
    return { ok: false, message: state.message };
  }

  function chooseTool(state, actorId, tool) {
    const actor = state.actors[actorId];
    if (!actor || !['till', 'seed', 'water'].includes(tool)) return { ok: false, message: 'Unknown tool.' };
    record(state, 'The field kit chooses the farm action from context; there is no routine tool carousel.', actorId);
    return { ok: false, reason: 'contextual-field-kit-only' };
  }

  function setWorkState(actor, kind, target) {
    actor.workState = {
      sequence: Number(actor.workState && actor.workState.sequence || 0) + 1,
      kind,
      target: target ? { x: target.x, y: target.y } : null
    };
  }

  function harvestCrop(state, actor, target) {
    const cell = state.farm.cells[cellKey(target.x, target.y)];
    if (!cell || !cell.crop || cell.growth < 2) return { ok: false, reason: 'not-ripe' };
    cell.crop = null;
    cell.growth = 0;
    cell.watered = false;
    state.inventory.buddyCarrots += 1;
    state.farm.totalHarvests += 1;
    state.farm.growthTokens += 1;
    setWorkState(actor, 'harvest', target);
    record(state, actor.name + ' harvested a Buddy Carrot. +1 shared growth token.', actor.id);
    return { ok: true, harvested: true };
  }

  function contextualAction(state, actorId) {
    const actor = state.actors[actorId];
    if (!actor) return { ok: false, message: 'Unknown farm buddy.' };
    const target = targetFor(actor);
    if (actor.scene !== 'farm') {
      record(state, 'Work actions are separate from doors, people and story objects.', actorId);
      return { ok: false, reason: 'use-interact' };
    }
    const plot = unlockedPlotAt(state, target.x, target.y);
    if (!plot) {
      record(state, 'Face an unlocked farm tile to use the field kit.', actorId);
      return { ok: false, reason: 'not-farm-work' };
    }
    const cell = state.farm.cells[cellKey(target.x, target.y)];
    if (cell && cell.crop && cell.growth >= 2) return harvestCrop(state, actor, target);
    if (!cell || !cell.tilled) return useTool(state, actorId, 'till');
    if (!cell.crop) return useTool(state, actorId, 'seed');
    if (!cell.watered) return useTool(state, actorId, 'water');
    record(state, 'That crop is already watered. It needs a new morning.', actorId);
    return { ok: false, reason: 'already-tended' };
  }

  function useTool(state, actorId, requestedTool) {
    const actor = state.actors[actorId];
    if (!actor) return { ok: false, message: 'Unknown farm buddy.' };
    const tool = requestedTool;
    const target = targetFor(actor);
    if (actor.scene !== 'farm' || !unlockedPlotAt(state, target.x, target.y)) {
      record(state, 'Tools work only inside an unlocked farm plot.', actorId);
      return { ok: false, reason: 'locked-plot' };
    }
    const key = cellKey(target.x, target.y);
    const cell = state.farm.cells[key] || { x: target.x, y: target.y, tilled: false, crop: null, growth: 0, watered: false };
    if (tool === 'till') {
      if (cell.crop) {
        record(state, 'That crop is still growing.', actorId);
        return { ok: false, reason: 'occupied' };
      }
      cell.tilled = true;
      state.farm.cells[key] = cell;
      setWorkState(actor, 'prepare', target);
      record(state, actor.name + ' prepared a grass tile for planting.', actorId);
      return { ok: true, tilled: key };
    }
    if (tool === 'seed') {
      if (!cell.tilled || cell.crop) {
        record(state, 'Till an empty plot tile before planting.', actorId);
        return { ok: false, reason: 'not-tilled' };
      }
      if (state.inventory.seeds < 1) {
        record(state, 'The shared seed pouch is empty.', actorId);
        return { ok: false, reason: 'no-seeds' };
      }
      cell.crop = 'buddy-carrot';
      cell.growth = 0;
      cell.watered = false;
      state.inventory.seeds -= 1;
      state.farm.cells[key] = cell;
      setWorkState(actor, 'plant', target);
      record(state, actor.name + ' planted a Buddy Carrot.', actorId);
      return { ok: true, planted: key };
    }
    if (tool === 'water') {
      if (!cell.crop) {
        record(state, 'There is no crop on that tile yet.', actorId);
        return { ok: false, reason: 'no-crop' };
      }
      cell.watered = true;
      state.farm.cells[key] = cell;
      setWorkState(actor, 'water', target);
      record(state, actor.name + ' watered the crop.', actorId);
      return { ok: true, watered: key };
    }
    return { ok: false, message: 'Unknown tool.' };
  }

  function applyAction(state, actorId, action, options) {
    const value = action || {};
    const worldAdapter = options && options.worldAdapter;
    if (value.type === 'move') return move(state, actorId, value.direction, worldAdapter);
    if (value.type === 'work') return contextualAction(state, actorId);
    if (value.type === 'action') return interact(state, actorId, value);
    return { ok: false, message: 'Unknown action.' };
  }

  function snapshot(state) {
    return clone(state);
  }

  function nearestFarmTask(state) {
    const entries = Object.values(state.farm.cells);
    const ripe = entries.find(cell => cell.crop && cell.growth >= 2);
    if (ripe) return { x: ripe.x, y: ripe.y, action: 'interact' };
    const dry = entries.find(cell => cell.crop && !cell.watered);
    if (dry) return { x: dry.x, y: dry.y, action: 'water' };
    const emptyTilled = entries.find(cell => cell.tilled && !cell.crop);
    if (emptyTilled && state.inventory.seeds > 0) return { x: emptyTilled.x, y: emptyTilled.y, action: 'seed' };
    const plot = WORLD.plots[0];
    for (let y = plot.y; y < plot.y + plot.height; y += 1) {
      for (let x = plot.x; x < plot.x + plot.width; x += 1) {
        if (!state.farm.cells[cellKey(x, y)]) return { x, y, action: 'till' };
      }
    }
    return null;
  }

  function helperStep(state, actorId, options) {
    const actor = state.actors[actorId];
    if (!actor || actor.type !== 'ai') return { ok: false, reason: 'not-ai' };
    if (!actor.helperBudget || actor.helperBudget.day !== state.day) {
      actor.helperBudget = { day: state.day, completedTasks: 0, dailyLimit: 3 };
    }
    if (actor.helperBudget.completedTasks >= actor.helperBudget.dailyLimit) {
      return { ok: false, reason: 'daily-helper-budget-complete' };
    }
    if (actor.scene !== 'farm') {
      placeActor(actor, 'farm', 20, 12, 'down');
      record(state, actor.name + ' returned outside to help.', actorId);
      return { ok: true };
    }
    const task = nearestFarmTask(state);
    if (!task) return { ok: false, reason: 'no-task' };
    const distance = Math.abs(task.x - actor.x) + Math.abs(task.y - actor.y);
    if (distance === 1) {
      if (task.x < actor.x) actor.facing = 'left';
      else if (task.x > actor.x) actor.facing = 'right';
      else if (task.y < actor.y) actor.facing = 'up';
      else actor.facing = 'down';
      const result = task.action === 'interact'
        ? contextualAction(state, actorId)
        : useTool(state, actorId, task.action);
      if (result.ok) actor.helperBudget.completedTasks += 1;
      return result;
    }
    const horizontal = task.x !== actor.x;
    const direction = horizontal ? (task.x < actor.x ? 'left' : 'right') : (task.y < actor.y ? 'up' : 'down');
    return move(state, actorId, direction, options && options.worldAdapter);
  }

  return {
    BUDDY_RECIPES,
    GAME_ID,
    SAVE_SCHEMA,
    TRAVEL_HOLD_MS,
    WALK_DURATION_MS,
    WORLD,
    applyAction,
    cellKey,
    clone,
    createInitialState,
    contextualAction,
    gamepadPlayerIds,
    helperStep,
    interact,
    isWalkable,
    move,
    normalizeRoster,
    placeActor,
    snapshot,
    targetFor,
    unlockedPlotAt,
    useTool
  };
});
