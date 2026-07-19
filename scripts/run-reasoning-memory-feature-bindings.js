'use strict';

const Binding = require('../organs/reasoning-memory-feature-binding-organ');

try {
  const result = Binding.run();
  process.stdout.write(JSON.stringify({
    ok: true,
    batchId: result.batch.batchId,
    batchDigest: result.batch.batchDigest,
    state: result.batch.state,
    strategiesAssessed: result.batch.summary.strategiesAssessed,
    exactBindings: result.batch.summary.exactBindings,
    heldBindings: result.batch.summary.heldBindings,
    bindings: result.batch.bindings.map(item => ({ strategyTag: item.strategyTag, state: item.state, bindingFeature: item.bindingFeature })),
    tagOnlyRetrievalsAllowed: 0,
    evidenceAdmissions: 0,
    trainingAdmissions: 0,
    promotions: 0,
    worldActions: 0,
    reused: result.reused,
    runDir: result.runDir
  }, null, 2) + '\n');
} catch (error) {
  process.stderr.write(`REASONING MEMORY FEATURE BINDING REFUSED: ${error.message}\n`);
  process.exitCode = 1;
}
