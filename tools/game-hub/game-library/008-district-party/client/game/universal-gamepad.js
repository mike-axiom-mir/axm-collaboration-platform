const DEAD_ZONE = 0.22;
const SEND_INTERVAL_MS = 50;
const IDLE_HEARTBEAT_MS = 500;

const pressed = (gamepad, index) => Boolean(gamepad?.buttons?.[index]?.pressed || gamepad?.buttons?.[index]?.value > 0.55);
const axis = (gamepad, index) => {
  const value = Number(gamepad?.axes?.[index]) || 0;
  if (Math.abs(value) <= DEAD_ZONE) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE));
};

export function sampleUniversalGamepad(gamepad) {
  if (!gamepad) return { connected: false, supported: false, input: null };
  if (gamepad.mapping !== 'standard') return { connected: true, supported: false, input: null };
  let moveX = axis(gamepad, 0);
  let moveY = axis(gamepad, 1);
  if (Math.abs(moveX) < 0.01) moveX = pressed(gamepad, 14) ? -1 : pressed(gamepad, 15) ? 1 : 0;
  if (Math.abs(moveY) < 0.01) moveY = pressed(gamepad, 12) ? -1 : pressed(gamepad, 13) ? 1 : 0;
  const aimX = axis(gamepad, 2);
  const aimY = axis(gamepad, 3);
  return {
    connected: true,
    supported: true,
    input: {
      moveX,
      moveY,
      aimX,
      aimY,
      aimActive: Math.hypot(aimX, aimY) > 0.12,
      action: pressed(gamepad, 0),
      brake: pressed(gamepad, 1),
      fire: pressed(gamepad, 2) || pressed(gamepad, 7),
      attack: pressed(gamepad, 2) || pressed(gamepad, 7),
      inventoryToggle: pressed(gamepad, 3) || pressed(gamepad, 8),
      inventoryPrev: pressed(gamepad, 4),
      inventoryNext: pressed(gamepad, 5),
      inventoryActivate: pressed(gamepad, 0),
      sprint: pressed(gamepad, 5) || pressed(gamepad, 6),
      mapToggle: pressed(gamepad, 9),
    },
  };
}

function fingerprint(input) {
  return JSON.stringify(input, Object.keys(input).sort());
}

export async function startUniversalGamepads({ sessionId, roomCode, partyId, statusElement }) {
  if (!navigator.getGamepads) {
    if (statusElement) statusElement.textContent = 'GAMEPADS: browser API unavailable';
    return { stop() {}, bindings: [] };
  }
  const query = new URLSearchParams({ sessionId, roomCode, party: partyId });
  const response = await fetch(`/api/local-gamepad-bindings?${query}`, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.reason || `gamepad bindings HTTP ${response.status}`);
  const bindings = (payload.bindings || []).map((binding) => ({
    ...binding,
    seq: Number(binding.acceptedSeq) || 0,
    sending: false,
    queued: null,
    lastFingerprint: '',
    lastSentAt: 0,
  }));
  let stopped = false;

  const send = async (binding, input) => {
    if (binding.sending) {
      binding.queued = input;
      return;
    }
    binding.sending = true;
    try {
      const inputResponse = await fetch('/api/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          sessionId,
          seatId: binding.seatId,
          token: binding.token,
          source: 'shared-gamepad',
          seq: ++binding.seq,
          input,
        }),
      });
      const result = await inputResponse.json().catch(() => ({}));
      if (!inputResponse.ok || result.ok === false) {
        if (Number.isSafeInteger(result.acceptedSeq)) binding.seq = Math.max(binding.seq, result.acceptedSeq);
        throw new Error(result.reason || result.error || `input HTTP ${inputResponse.status}`);
      }
      binding.lastSentAt = performance.now();
      binding.lastFingerprint = fingerprint(input);
    } catch (error) {
      if (statusElement) statusElement.textContent = `GAMEPADS: reconnecting - ${error.message}`;
    } finally {
      binding.sending = false;
      const queued = binding.queued;
      binding.queued = null;
      if (queued && !stopped) queueMicrotask(() => send(binding, queued));
    }
  };

  const poll = () => {
    if (stopped) return;
    const pads = navigator.getGamepads();
    let connected = 0;
    let unsupported = 0;
    const now = performance.now();
    bindings.forEach((binding) => {
      const sample = sampleUniversalGamepad(pads[binding.gamepadIndex]);
      if (!sample.connected) return;
      connected += 1;
      if (!sample.supported) {
        unsupported += 1;
        return;
      }
      const nextFingerprint = fingerprint(sample.input);
      const meaningful = Math.hypot(sample.input.moveX, sample.input.moveY) > 0.01
        || Math.hypot(sample.input.aimX, sample.input.aimY) > 0.01
        || Object.entries(sample.input).some(([key, value]) => !['moveX', 'moveY', 'aimX', 'aimY', 'aimActive'].includes(key) && value === true);
      if (meaningful || nextFingerprint !== binding.lastFingerprint || now - binding.lastSentAt >= IDLE_HEARTBEAT_MS) send(binding, sample.input);
    });
    if (statusElement) {
      statusElement.textContent = unsupported
        ? `GAMEPADS: ${connected - unsupported} READY - ${unsupported} UNSUPPORTED`
        : connected
          ? `GAMEPADS: ${connected}/${bindings.length} READY - PADS FOLLOW SEAT ORDER`
          : `GAMEPADS: CONNECT UP TO ${bindings.length} - PRESS A`;
    }
  };
  const timer = setInterval(poll, SEND_INTERVAL_MS);
  poll();
  return {
    bindings,
    profile: payload.profile,
    stop() { stopped = true; clearInterval(timer); },
  };
}
