'use strict';

const fs = require('fs');
const path = require('path');

function createTraceStore(options = {}) {
  const maxMemory = Math.max(10, Math.min(5000, Number(options.maxMemory) || 500));
  const file = options.file || null;
  const traces = new Map();

  function save(trace) {
    traces.set(trace.traceId, trace);
    while (traces.size > maxMemory) traces.delete(traces.keys().next().value);
    if (file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, JSON.stringify(trace) + '\n', 'utf8');
    }
    return trace;
  }

  function get(id) {
    return traces.get(String(id || '')) || null;
  }

  function count() {
    return traces.size;
  }

  return { save, get, count };
}

module.exports = { createTraceStore };
