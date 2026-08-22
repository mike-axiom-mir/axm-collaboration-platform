'use strict';

/**
 * Compatibility boundary for the existing Robo Pong server.
 * The game keeps its current room.inputs.left/right fields and usePower function.
 * Devices send semantic AXM action frames instead of raw touch/button names.
 */
function createRoboPongSemanticBridge(options) {
  if (!options?.room) throw new Error('room is required');
  if (typeof options.usePower !== 'function') throw new Error('usePower callback is required');
  const previousPrimary = { p1: 0, p2: 0 };
  const threshold = Number.isFinite(options.digitalThreshold) ? options.digitalThreshold : 0.18;

  function applyFrame(player, frame) {
    if (player !== 'p1' && player !== 'p2') throw new Error('player must be p1 or p2');
    if (!frame || frame.protocol !== 'axm-input/0.1' || frame.type !== 'input_frame' || !Array.isArray(frame.actions)) {
      throw new Error('invalid AXM input frame');
    }

    let moveX = 0;
    let primary = 0;
    let pause = 0;
    for (const action of frame.actions) {
      if (action.id === 'MOVE') moveX = Number(action.value?.x || 0);
      if (action.id === 'PRIMARY_ACTION') primary = action.value ? 1 : 0;
      if (action.id === 'PAUSE' || action.id === 'OPEN_MENU') pause = action.value ? 1 : 0;
    }

    options.room.inputs[player].left = moveX < -threshold;
    options.room.inputs[player].right = moveX > threshold;

    const primaryPressed = primary && !previousPrimary[player];
    previousPrimary[player] = primary;
    if (primaryPressed) options.usePower(player, Date.now());

    return {
      player,
      left: options.room.inputs[player].left,
      right: options.room.inputs[player].right,
      primaryPressed: Boolean(primaryPressed),
      pauseRequested: Boolean(pause)
    };
  }

  function release(player) {
    options.room.inputs[player].left = false;
    options.room.inputs[player].right = false;
    previousPrimary[player] = 0;
  }

  return { applyFrame, release };
}

module.exports = { createRoboPongSemanticBridge };
