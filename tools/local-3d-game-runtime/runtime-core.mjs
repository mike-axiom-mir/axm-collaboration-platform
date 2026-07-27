export const FIXED_DELTA = 1 / 60;

export function createGameState(seed = 'district-runtime-01') {
  return {
    schema: 'axm.local-3d-runtime.state/v1',
    seed: String(seed),
    phase: 'ready',
    tick: 0,
    elapsed: 0,
    player: { x: 0, y: 0, z: 8, yaw: Math.PI, speed: 0 },
    beacons: [
      { id: 'north-door', x: 0, z: 2.2, collected: false },
      { id: 'west-bench', x: -3.2, z: 3.4, collected: false },
      { id: 'east-pallet', x: 3.1, z: 3.2, collected: false }
    ],
    outcome: null
  };
}

export function startGame(state) {
  return { ...state, phase: state.outcome ? 'complete' : 'playing' };
}

export function togglePause(state) {
  if (state.phase === 'playing') return { ...state, phase: 'paused' };
  if (state.phase === 'paused') return { ...state, phase: 'playing' };
  return state;
}

export function stepGame(state, input = {}, delta = FIXED_DELTA) {
  if (state.phase !== 'playing') return state;
  const dt = Math.max(0, Math.min(0.05, Number(delta) || 0));
  const forward = Math.max(-1, Math.min(1, Number(input.forward) || 0));
  const right = Math.max(-1, Math.min(1, Number(input.right) || 0));
  const magnitude = Math.hypot(forward, right) || 1;
  const sprint = input.sprint ? 1.65 : 1;
  const speed = 3.2 * sprint;
  const yaw = Number.isFinite(input.yaw) ? input.yaw : state.player.yaw;
  const localForward = forward / magnitude;
  const localRight = right / magnitude;
  const dx = (Math.sin(yaw) * localForward + Math.cos(yaw) * localRight) * speed * dt;
  const dz = (Math.cos(yaw) * localForward - Math.sin(yaw) * localRight) * speed * dt;
  const player = {
    ...state.player,
    x: Math.max(-11, Math.min(11, state.player.x + dx)),
    z: Math.max(-8, Math.min(12, state.player.z + dz)),
    yaw,
    speed: Math.hypot(dx, dz) / Math.max(dt, 1e-6)
  };
  const beacons = state.beacons.map((beacon) => ({
    ...beacon,
    collected: beacon.collected || Math.hypot(player.x - beacon.x, player.z - beacon.z) < 0.72
  }));
  const collected = beacons.filter((beacon) => beacon.collected).length;
  const complete = collected === beacons.length;
  return {
    ...state,
    tick: state.tick + 1,
    elapsed: state.elapsed + dt,
    phase: complete ? 'complete' : 'playing',
    player,
    beacons,
    outcome: complete ? { kind: 'district-survey-complete', ticks: state.tick + 1, elapsed: state.elapsed + dt } : null
  };
}

export function stateDigestPayload(state) {
  return {
    schema: state.schema,
    seed: state.seed,
    phase: state.phase,
    tick: state.tick,
    player: [state.player.x, state.player.y, state.player.z, state.player.yaw].map((value) => Number(value.toFixed(6))),
    beacons: state.beacons.map((beacon) => [beacon.id, beacon.collected]),
    outcome: state.outcome ? state.outcome.kind : null
  };
}
