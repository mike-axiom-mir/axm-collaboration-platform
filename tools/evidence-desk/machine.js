'use strict';
const Core = require('./evidence-core.js');

module.exports = {
  apiVersion: '1.0',
  async call(context, action, input) {
    if (!context || typeof context.authorize !== 'function') {
      return { ok: false, error: { code: 'HOST_GATE_REQUIRED', message: 'Machine adapter requires an authenticated host gate decision.' } };
    }
    const decision = await context.authorize({ tool: 'evidence-desk', action, effect: 'read-only' });
    if (!decision || !decision.allow) {
      return { ok: false, error: { code: 'GATE_DENIED', message: decision && decision.reason || 'Action denied.' } };
    }
    if (action === 'validate') {
      const result = Core.validate(input);
      return { ok: true, tool: 'evidence-desk', action, effect: 'read-only', result, writes: [], evidence: [{ kind: 'shared-core', source: 'tools/evidence-desk/evidence-core.js' }] };
    }
    if (action === 'build') {
      const receipt = Core.build(input);
      return { ok: true, tool: 'evidence-desk', action, effect: 'read-only', result: { receipt, report: Core.report(receipt) }, writes: [], evidence: [{ kind: 'shared-core', source: 'tools/evidence-desk/evidence-core.js' }] };
    }
    return { ok: false, error: { code: 'UNKNOWN_ACTION', message: 'Action is not declared by this adapter.' } };
  }
};
