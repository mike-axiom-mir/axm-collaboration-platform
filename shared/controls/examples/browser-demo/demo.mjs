import { AxmVirtualStick } from '/src/browser/axm-virtual-stick.mjs';
import { AxmControllerRuntime } from '/src/browser/axm-controller-runtime.mjs';

const $ = (id) => document.getElementById(id);
const profileSelect = $('profile');
const buttonBindings = [];
let runtime = null;
let sticks = [];

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('gesturestart', (event) => event.preventDefault());

function safePacket(packet) {
  return { ...packet, token: '[private seat token redacted]' };
}

async function localDemoTransport(packet) {
  $('intent').textContent = JSON.stringify(packet.input, null, 2);
  $('packet').textContent = JSON.stringify(safePacket(packet), null, 2);
  await new Promise((resolve) => setTimeout(resolve, 8));
  return { ok: true, acceptedSeq: packet.seq, actorId: 'actor-seat-demo' };
}

function clearBindings() {
  for (const release of buttonBindings.splice(0)) release();
}

function bindButton(button, control, profile) {
  const semantic = profile.buttons[control];
  const isPulse = profile.intent.pulseFields.includes(semantic);
  const down = (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add('pressed');
    if (isPulse) runtime.pulse(control);
    else runtime.setButton(control, true);
  };
  const up = (event) => {
    event.preventDefault?.();
    button.classList.remove('pressed');
    if (!isPulse) runtime.setButton(control, false);
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  buttonBindings.push(() => {
    button.removeEventListener('pointerdown', down);
    button.removeEventListener('pointerup', up);
    button.removeEventListener('pointercancel', up);
  });
}

async function loadProfile(name) {
  const response = await fetch(`/profiles/${name}.json`);
  if (!response.ok) throw new Error(`Could not load ${name}.`);
  return response.json();
}

async function activateProfile(name) {
  runtime?.stop();
  runtime?.reset();
  sticks.forEach((stick) => stick.destroy());
  sticks = [];
  clearBindings();
  const profile = await loadProfile(name);
  runtime = new AxmControllerRuntime({
    identity: {
      roomCode: 'AXM1',
      sessionId: 'session-local-demo',
      seatId: 'seat_demo',
      token: 'private-seat-demo-token',
    },
    profile,
    transport: localDemoTransport,
    onStatus: ({ state, sequence }) => {
      $('status').textContent = `${profile.displayName} · ${state} · sequence ${sequence}`;
    },
  });
  $('left-label').textContent = profile.labels?.left || 'LEFT';
  $('right-label').textContent = profile.labels?.right || 'RIGHT';

  sticks.push(new AxmVirtualStick({
    element: $('left-zone'), base: $('left-base'), knob: $('left-knob'),
    onChange: (state) => runtime.setVector('left', state),
  }));
  sticks.push(new AxmVirtualStick({
    element: $('right-zone'), base: $('right-base'), knob: $('right-knob'),
    onChange: (state) => runtime.setVector('right', state),
    onRelease: (state) => {
      runtime.setVector('right', state);
      if (!state.cancelled) runtime.releaseVector('right');
      navigator.vibrate?.(8);
    },
  }));
  document.querySelectorAll('[data-control]').forEach((button) => {
    const control = button.dataset.control;
    button.textContent = profile.labels?.[control] || control.toUpperCase();
    bindButton(button, control, profile);
  });
  runtime.start();
}

profileSelect.addEventListener('change', () => {
  activateProfile(profileSelect.value).catch((error) => { $('status').textContent = error.message; });
});
activateProfile(profileSelect.value).catch((error) => { $('status').textContent = error.message; });

