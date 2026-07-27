'use strict';

module.exports = function loadJsPdf() {
  try {
    return require('jspdf');
  } catch (error) {
    const directMissing = error && error.code === 'MODULE_NOT_FOUND' && /['"]jspdf['"]/.test(String(error.message || ''));
    if (!directMissing) throw error;
    return require('../vendor/jspdf/jspdf.umd.min.js');
  }
};
