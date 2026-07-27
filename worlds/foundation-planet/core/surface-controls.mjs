export const SURFACE_CONTROLS_SCHEMA = 'axm.foundation-planet.surface-controls/v1';

export const SURFACE_CONTROL_SETTINGS = Object.freeze({
  mouseYawRadiansPerPixel: 0.0022,
  mousePitchRadiansPerPixel: 0.0018,
  keyboardYawRadiansPerSecond: 1.85,
  keyboardPitchRadiansPerSecond: 1.35,
  minimumPitchRadians: -1.35,
  maximumPitchRadians: 1.2
});

const CONTROL_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'ShiftLeft', 'ShiftRight'
]);
const LOOK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pressed = (keys, code) => keys?.[code] ? 1 : 0;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function isSurfaceControlKey(code) {
  return CONTROL_KEYS.has(code);
}

export function isSurfaceLookKey(code) {
  return LOOK_KEYS.has(code);
}

export function wrapYaw(yaw) {
  const turn = Math.PI * 2;
  return ((finite(yaw) + Math.PI) % turn + turn) % turn - Math.PI;
}

export function surfaceMovementIntent(yaw, keys = {}) {
  let forward = pressed(keys, 'KeyW') - pressed(keys, 'KeyS');
  let strafe = pressed(keys, 'KeyD') - pressed(keys, 'KeyA');
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }
  const heading = finite(yaw);
  return {
    forward,
    strafe,
    x: Math.sin(heading) * forward + Math.cos(heading) * strafe,
    z: -Math.cos(heading) * forward + Math.sin(heading) * strafe
  };
}

export function applySurfaceLook(view = {}, input = {}, settings = SURFACE_CONTROL_SETTINGS) {
  const deltaSeconds = clamp(finite(input.deltaSeconds), 0, 0.1);
  const keyboardYaw = pressed(input.keys, 'ArrowRight') - pressed(input.keys, 'ArrowLeft');
  const keyboardPitch = pressed(input.keys, 'ArrowUp') - pressed(input.keys, 'ArrowDown');
  const yaw = finite(view.yaw)
    + finite(input.mouseX) * settings.mouseYawRadiansPerPixel
    + keyboardYaw * settings.keyboardYawRadiansPerSecond * deltaSeconds;
  const pitch = finite(view.pitch)
    - finite(input.mouseY) * settings.mousePitchRadiansPerPixel
    + keyboardPitch * settings.keyboardPitchRadiansPerSecond * deltaSeconds;
  return {
    yaw: wrapYaw(yaw),
    pitch: clamp(pitch, settings.minimumPitchRadians, settings.maximumPitchRadians)
  };
}

export function surfaceControlsDescription() {
  return {
    schema: SURFACE_CONTROLS_SCHEMA,
    movement: 'WASD camera-relative movement with normalized diagonals',
    look: 'standard non-inverted mouse look plus arrow-key look',
    sprint: 'left or right Shift',
    pointerLock: 'click the rendered world; Escape releases the cursor',
    settings: { ...SURFACE_CONTROL_SETTINGS }
  };
}
