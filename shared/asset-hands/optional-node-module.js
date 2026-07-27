'use strict';

module.exports = function optionalNodeModule(request, allowedMissingPackages) {
  try {
    return require(request);
  } catch (error) {
    const message = String(error && error.message || '');
    const allowed = Array.isArray(allowedMissingPackages) ? allowedMissingPackages : [];
    const directOptionalGap = error && error.code === 'MODULE_NOT_FOUND' && allowed.some(name => {
      const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp("['\"]" + escaped + "['\"]").test(message);
    });
    if (directOptionalGap) return null;
    throw error;
  }
};
