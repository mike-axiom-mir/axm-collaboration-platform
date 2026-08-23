'use strict';

module.exports = function optionalWasmVips() {
  try {
    return require('wasm-vips');
  } catch (error) {
    const directMissing = error && error.code === 'MODULE_NOT_FOUND' && /['"]wasm-vips['"]/.test(String(error.message || ''));
    if (directMissing) {
      try {
        return require('../vendor/wasm-vips/lib/vips-node.js');
      } catch (vendorError) {
        const vendorMissing = vendorError && vendorError.code === 'MODULE_NOT_FOUND' && /Cannot find module ['"]\.\.\/vendor\/wasm-vips\/lib\/vips-node\.js['"]/.test(String(vendorError.message || ''));
        if (vendorMissing) return null;
        throw vendorError;
      }
    }
    throw error;
  }
};
