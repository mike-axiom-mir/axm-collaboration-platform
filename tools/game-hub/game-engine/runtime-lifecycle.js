'use strict';

const { endSession } = require('./engine-core');

/* Close a child-game loss through the same authoritative state transition as
   an intentional finish. This is deliberately pure with respect to disk: the
   Game Hub decides where to persist the returned receipt. */
function recoverRuntimeSession(state, details) {
  if (!state || !state.session || state.session.phase !== 'RUNNING' || !state.session.session_id) return null;
  const session = JSON.parse(JSON.stringify(state.session));
  const info = details || {};
  const summary = endSession(state, {
    status: info.status || 'runtime-lost',
    reason: info.reason || 'child-runtime-ended-without-game-end'
  });
  return Object.assign({}, summary, {
    game: session.selected_game || null,
    selected_players: Array.isArray(session.selected_players) ? session.selected_players : [],
    skipped_players: Array.isArray(session.skipped_players) ? session.skipped_players : [],
    started_at: session.started_at || null,
    reflection_state: 'SKIPPED',
    confirmed_finish: false
  });
}

module.exports = { recoverRuntimeSession };
