#!/usr/bin/env node
'use strict';

/**
 * Brace Room — headless bot playtest harness.
 *
 * No browser or physical device was available in this build session, so
 * this is a stand-in for a first human playtest: a simple, always-correct
 * heuristic bot plays the game (via game-core.js's public tick API, no
 * DOM) across many seeds, player counts, and session lengths, and reports
 * aggregate win rate / final hull / miss counts.
 *
 * IMPORTANT — what this is and isn't:
 *   - The bot never misidentifies a false alarm (it only ever acts on
 *     'real' faults), never mistimes a rhythm tap search (it just holds
 *     the action key while in a rhythm station's zone, which the real
 *     scoring rewards probabilistically, not perfectly), and reacts with
 *     zero human delay to reprioritize targets. So this is closer to an
 *     UPPER BOUND on how forgiving the wave table is, not a prediction of
 *     average human performance. Treat "the bot always wins" as "this
 *     wave table is at least beatable," not "this is well-balanced for
 *     humans." A real human playtest is still the next real gate — see
 *     KNOWN_LIMITS.md.
 *   - This does exercise real spawn/wave/effort/hull code paths end to
 *     end, so it's still useful for catching things like the solo-Bulkhead
 *     unresolvable-fault bug it was written to help verify.
 *
 * Usage: node dev/balance-sim.js [seedsPerConfig]
 */

const Core = require('../runtime/game-core');

function clampAxis(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

/**
 * Coordinated assignment: rather than every bot independently chasing
 * whichever fault is nearest to *it* (which piles everyone onto one fire
 * while others expire untouched — not representative of a team that can
 * actually talk to each other), assign each real fault to its own bot by
 * global nearest-pair-first matching, give Bulkhead (crew2) two bots, and
 * send any leftover bots to reinforce whichever assigned fault is closest
 * to expiring. This models a coordinated team's upper bound, not four
 * players each independently guessing.
 */
function assignBots(state) {
  const activeIds = Core.PLAYER_IDS.slice(0, state.playerCount);
  const realFaults = state.faults.filter(f => f.kind === 'real');
  if (realFaults.length === 0) return {};

  const faultNeeds = new Map(realFaults.map(f => [f.id, f.verb === 'crew2' ? 2 : 1]));
  const assignment = {}; // playerId -> fault
  const pairs = [];
  activeIds.forEach(id => {
    const player = state.players[id];
    realFaults.forEach(fault => {
      const station = Core.STATIONS.find(s => s.id === fault.stationId);
      const pos = Core.stationPosition(station);
      pairs.push({ id, fault, station, pos, dist: Math.hypot(player.x - pos.x, player.y - pos.y) });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);

  const assignedPlayers = new Set();
  pairs.forEach(pair => {
    if (assignedPlayers.has(pair.id)) return;
    const remainingNeed = faultNeeds.get(pair.fault.id);
    if (remainingNeed <= 0) return;
    assignment[pair.id] = pair;
    assignedPlayers.add(pair.id);
    faultNeeds.set(pair.fault.id, remainingNeed - 1);
  });

  // Leftover bots (more players than fault-slots needed): reinforce
  // whichever assigned fault is soonest to expire.
  const soonest = realFaults.slice().sort((a, b) => (a.spawnedAt + a.ringMs) - (b.spawnedAt + b.ringMs))[0];
  if (soonest) {
    const station = Core.STATIONS.find(s => s.id === soonest.stationId);
    const pos = Core.stationPosition(station);
    activeIds.forEach(id => {
      if (assignedPlayers.has(id)) return;
      assignment[id] = { id, fault: soonest, station, pos, dist: Math.hypot(state.players[id].x - pos.x, state.players[id].y - pos.y) };
    });
  }

  return assignment;
}

function decideInputs(state, heldAction) {
  const inputs = {};
  const activeIds = Core.PLAYER_IDS.slice(0, state.playerCount);
  const assignment = assignBots(state);

  activeIds.forEach(id => {
    const player = state.players[id];
    const best = assignment[id];

    if (!best) {
      inputs[id] = { moveX: 0, moveY: 0, action: false, actionEdge: false };
      heldAction[id] = false;
      return;
    }

    const dx = best.pos.x - player.x;
    const dy = best.pos.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const inZone = dist <= Core.ZONE_RADIUS - 6;
    const moveX = inZone ? 0 : clampAxis(dx / dist);
    const moveY = inZone ? 0 : clampAxis(dy / dist);
    const wasHeld = Boolean(heldAction[id]);

    // Verb-aware action, not just "hold once and forget": a bot that only
    // ever fires a single edge on arrival and then holds forever (the
    // original version of this file) never actually mashes, which starved
    // mash-verb faults of effort and made them look far harder than they
    // are. hold/crew2 genuinely just need continuous hold; mash needs
    // repeated discrete presses; rhythm needs presses timed to the beat.
    let wantsAction;
    if (!inZone) {
      wantsAction = false;
    } else if (best.fault.verb === 'mash') {
      wantsAction = !wasHeld; // pulse every tick: press, release, press, release...
    } else if (best.fault.verb === 'rhythm') {
      const delta = Core.nearestBeatDelta(state.elapsedMs - best.fault.beatAnchorMs);
      wantsAction = delta <= Core.RHYTHM_WINDOW_MS;
    } else {
      wantsAction = true; // hold, crew2
    }

    inputs[id] = { moveX, moveY, action: wantsAction, actionEdge: wantsAction && !wasHeld };
    heldAction[id] = wantsAction;
  });

  return inputs;
}

function runOne({ seed, playerCount, sessionMinutes, dtMs }) {
  const state = Core.createInitialState({ seed, sessionMinutes, playerCount });
  const heldAction = {};
  let ticks = 0;
  const maxTicks = Math.ceil((sessionMinutes * 60 * 1000) / dtMs) + 50;
  while (state.status === 'running' && ticks < maxTicks) {
    Core.tick(state, dtMs, decideInputs(state, heldAction));
    ticks += 1;
  }
  return state.summary || Core.buildSummary(state);
}

function aggregate(summaries) {
  const n = summaries.length;
  const wins = summaries.filter(s => s.outcome === 'won').length;
  const avg = key => summaries.reduce((sum, s) => sum + s[key], 0) / n;
  return {
    runs: n,
    winRate: wins / n,
    avgFinalHull: avg('finalHull'),
    avgResolved: avg('resolved'),
    avgMissed: avg('missed'),
    avgFalseAlarmsMisresolved: avg('falseAlarmsMisresolved'),
    avgBestStreak: avg('bestStreak')
  };
}

function main() {
  const seedsPerConfig = Number(process.argv[2]) || 20;
  const dtMs = 100;
  const playerCounts = [1, 2, 3, 4];
  const sessionMinutesOptions = [6, 9, 12];

  console.log(`Brace Room balance sim — ${seedsPerConfig} seeds x ${playerCounts.length} player counts x ${sessionMinutesOptions.length} session lengths\n`);
  console.log('players | minutes | winRate | avgFinalHull | avgResolved | avgMissed | avgFalseAlarmErrors | avgBestStreak');
  console.log('--------|---------|---------|--------------|-------------|-----------|----------------------|---------------');

  const rows = [];
  playerCounts.forEach(playerCount => {
    sessionMinutesOptions.forEach(sessionMinutes => {
      const summaries = [];
      for (let seed = 0; seed < seedsPerConfig; seed += 1) {
        summaries.push(runOne({ seed: seed * 97 + playerCount * 13 + sessionMinutes, playerCount, sessionMinutes, dtMs }));
      }
      const agg = aggregate(summaries);
      rows.push(Object.assign({ playerCount, sessionMinutes }, agg));
      console.log(
        `${String(playerCount).padStart(7)} | ${String(sessionMinutes).padStart(7)} | ` +
        `${(agg.winRate * 100).toFixed(0).padStart(6)}% | ${agg.avgFinalHull.toFixed(1).padStart(12)} | ` +
        `${agg.avgResolved.toFixed(1).padStart(11)} | ${agg.avgMissed.toFixed(1).padStart(9)} | ` +
        `${agg.avgFalseAlarmsMisresolved.toFixed(1).padStart(21)} | ${agg.avgBestStreak.toFixed(1).padStart(14)}`
      );
    });
  });

  return rows;
}

if (require.main === module) {
  main();
}

module.exports = { runOne, aggregate, decideInputs, main };
