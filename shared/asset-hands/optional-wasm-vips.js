'use strict';

module.exports = function optionalWasmVips() {
  try {
    return require('wasm-vips');
  } catch (error) {
    const directMissing = error && error.code === 'MODULE_NOT_FOUND' && /['"]wasm-vips['"]/.test(String(error.message || ''));
    if (directMissing) return null;
    throw error;
  }
};
