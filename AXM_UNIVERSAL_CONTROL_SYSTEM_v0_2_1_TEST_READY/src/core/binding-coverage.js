export function effectivePhoneBindings(profile, overrides = {}) {
  return Object.fromEntries((profile?.phoneLayout?.controls || []).map(control => [control.id, overrides[control.id] || control.action]));
}

export function missingRequiredPhoneActions(profile, overrides = {}) {
  const assigned = new Set(Object.values(effectivePhoneBindings(profile, overrides)).filter(Boolean));
  return (profile?.actions || []).filter(action => action.required && !assigned.has(action.id)).map(action => action.id);
}

export function compatibleProfileActions(profile, actionDefinitions, controlId) {
  const stick = /stick/i.test(String(controlId));
  const allowedTypes = stick ? new Set(['axis2','pointer']) : new Set(['digital','axis1','trigger']);
  return (profile?.actions || []).map(action => action.id).filter(actionId => allowedTypes.has(actionDefinitions.get(actionId)?.type));
}
