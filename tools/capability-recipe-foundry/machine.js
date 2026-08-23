'use strict';

const Foundry = require('./foundry-core.js');

const ACTIONS = ['pilot.example', 'intent.validate', 'recipe.route', 'packet.forge', 'packet.verify'];
const FORBIDDEN = ['filesystem.write', 'builder.execute', 'generated-code.execute', 'test.execute', 'recipe.activate', 'catalog.mutate', 'install', 'register', 'stage', 'promote', 'permission-grant', 'network', 'foundation.mutate', 'canon'];

function response(fields) {
  return Object.assign({
    schema: 'axm.capability-recipe-foundry-machine-response/v1',
    providerCalled: false,
    builderSourceExecuted: false,
    generatedCodeExecuted: false,
    testsExecuted: false,
    authority: Foundry.clone(Foundry.AUTHORITY)
  }, fields);
}
function refusal(code, reason) { return response({ ok: false, refused: true, code: code, reason: reason }); }

async function run(request) {
  request = request || {};
  const action = String(request.action || '');
  const input = request.input || {};
  if (ACTIONS.indexOf(action) < 0) {
    return refusal(FORBIDDEN.indexOf(action) >= 0 ? 'FORBIDDEN_ACTION' : 'UNSUPPORTED_ACTION', 'The machine door exposes pure inspection and packet assembly only.');
  }
  if (action === 'pilot.example') return response({ ok: true, intent: Foundry.example() });
  if (action === 'intent.validate') {
    const validation = Foundry.validateIntent(input.intent);
    return response({ ok: validation.ok, validation: validation });
  }
  if (action === 'recipe.route') {
    const plan = Foundry.plan(input.intent);
    return response({ ok: plan.status === 'READY', plan: plan });
  }
  if (action === 'packet.forge') {
    const result = Foundry.forge(input.intent);
    return response({ ok: result.status === 'COMPLETE', result: result });
  }
  if (action === 'packet.verify') {
    const verification = Foundry.verify(input.result);
    return response({ ok: verification.ok, verification: verification });
  }
  return refusal('UNSUPPORTED_ACTION', 'Action is unavailable.');
}

module.exports = { ACTIONS: ACTIONS, FORBIDDEN: FORBIDDEN, run: run };
