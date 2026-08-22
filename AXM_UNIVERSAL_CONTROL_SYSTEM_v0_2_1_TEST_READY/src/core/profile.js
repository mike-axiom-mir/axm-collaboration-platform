const PHONE_MODES = new Set(['simple','standard','advanced','custom']);
const ORIENTATIONS = new Set(['portrait','landscape','either']);
const STANDARD_GAMEPAD_CONTROLS = new Set([
  'leftStick','rightStick','dpad','south','east','west','north',
  'leftBumper','rightBumper','leftTrigger','rightTrigger','view','menu',
  'leftStickButton','rightStickButton','dpadUp','dpadDown','dpadLeft',
  'dpadRight','home'
]);

export function validateControlProfile(profile, registry) {
  const errors = [];
  if (!profile || typeof profile !== 'object') return ['profile must be an object'];
  if (!String(profile.id || '').trim()) errors.push('profile id is required');
  if (!String(profile.version || '').trim()) errors.push('profile version is required');
  if (!String(profile.gameId || '').trim()) errors.push('gameId is required');
  if (!Array.isArray(profile.actions) || !profile.actions.length) errors.push('actions are required');

  const declared = new Set();
  for (const action of profile.actions || []) {
    if (!action?.id) { errors.push('profile action id is required'); continue; }
    if (declared.has(action.id)) errors.push(`duplicate profile action ${action.id}`);
    declared.add(action.id);
    if (!registry.has(action.id)) errors.push(`unknown action ${action.id}`);
    if (typeof action.required !== 'boolean') errors.push(`action ${action.id} requires a boolean required flag`);
    if (action.bindingOverrides != null && (typeof action.bindingOverrides !== 'object' || Array.isArray(action.bindingOverrides))) {
      errors.push(`action ${action.id} bindingOverrides must be an object`);
    }
  }

  if (!profile.phoneLayout || typeof profile.phoneLayout !== 'object') errors.push('phoneLayout is required');
  else {
    if (!PHONE_MODES.has(profile.phoneLayout.mode)) errors.push('phoneLayout.mode is invalid');
    if (typeof profile.phoneLayout.twinStick !== 'boolean') errors.push('phoneLayout.twinStick must be boolean');
    if (profile.phoneLayout.preferredOrientation && !ORIENTATIONS.has(profile.phoneLayout.preferredOrientation)) errors.push('phoneLayout.preferredOrientation is invalid');
    for (const control of profile.phoneLayout.controls || []) {
      if (control.action && !registry.has(control.action)) errors.push(`phone control ${control.id || '<unknown>'} uses unknown action ${control.action}`);
      if (control.action && !declared.has(control.action)) errors.push(`phone control ${control.id || '<unknown>'} uses undeclared game action ${control.action}`);
    }
  }

  if (!profile.controllerLayout || typeof profile.controllerLayout !== 'object' || Array.isArray(profile.controllerLayout)) errors.push('controllerLayout must be an object');
  else for (const [actionId,binding] of Object.entries(profile.controllerLayout)) {
    if (!registry.has(actionId)) errors.push(`controllerLayout uses unknown action ${actionId}`);
    if (!declared.has(actionId)) errors.push(`controllerLayout uses undeclared game action ${actionId}`);
    validateControllerBinding(binding, `controllerLayout.${actionId}`, errors);
  }

  if (!Array.isArray(profile.contexts) || !profile.contexts.length) errors.push('at least one visible context is required');
  const contextIds = new Set();
  for (const context of profile.contexts || []) {
    if (!String(context?.id || '').trim()) { errors.push('context id is required'); continue; }
    if (contextIds.has(context.id)) errors.push(`duplicate context ${context.id}`);
    contextIds.add(context.id);
    if (!String(context.visibleLabel || '').trim()) errors.push(`context ${context.id} lacks visibleLabel`);
    for (const actionId of context.allowedActions || []) if (!registry.has(actionId)) errors.push(`context ${context.id} allows unknown action ${actionId}`);
    for (const [from,to] of Object.entries(context.remap || {})) {
      if (!registry.has(from)) errors.push(`context ${context.id} remaps unknown source ${from}`);
      if (!registry.has(to)) errors.push(`context ${context.id} remaps to unknown target ${to}`);
      if (registry.has(from) && registry.has(to) && registry.get(from).type !== registry.get(to).type) {
        errors.push(`context ${context.id} remap ${from} -> ${to} changes input type`);
      }
    }
  }

  const phoneActions = new Set((profile.phoneLayout?.controls || []).map(control => control.action).filter(Boolean));
  for (const action of profile.actions || []) {
    if (action.required && !phoneActions.has(action.id)) errors.push(`required action ${action.id} has no phone control path`);
  }

  if (profile.phoneLayout?.twinStick) {
    const hasMove = declared.has('MOVE');
    const hasSecondAxis = declared.has('AIM') || declared.has('LOOK');
    if (!hasMove || !hasSecondAxis) errors.push('twinStick profile requires MOVE and AIM or LOOK');
  }
  return errors;
}

function validateControllerBinding(binding, path, errors) {
  if (Number.isInteger(binding) && binding >= 0) return;
  if (typeof binding === 'string') {
    if (STANDARD_GAMEPAD_CONTROLS.has(binding) || /^button\d+$/.test(binding)) return;
    errors.push(`${path} uses unknown standard control ${binding}`);
    return;
  }
  if (Array.isArray(binding)) {
    if (binding.length === 2 && binding.every(value => Number.isInteger(value) && value >= 0)) return;
    if (!binding.length) { errors.push(`${path} must not be empty`); return; }
    binding.forEach((alternative,index) => validateControllerBinding(alternative, `${path}[${index}]`, errors));
    return;
  }
  if (binding && typeof binding === 'object' && !Array.isArray(binding)) {
    const control = binding.control || binding.input;
    if (typeof control !== 'string') errors.push(`${path} requires a control`);
    else validateControllerBinding(control, `${path}.control`, errors);
    if (binding.gesture != null && binding.gesture !== 'release') errors.push(`${path}.gesture must be release`);
    for (const key of ['threshold','releaseThreshold']) {
      if (binding[key] != null && (!Number.isFinite(binding[key]) || binding[key] < 0 || binding[key] > 1)) {
        errors.push(`${path}.${key} must be between 0 and 1`);
      }
    }
    return;
  }
  errors.push(`${path} has an invalid binding`);
}

export function requiredActions(profile) {
  return (profile.actions || []).filter(action => action.required).map(action => action.id);
}
