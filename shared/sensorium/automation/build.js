'use strict';

const Inventory = require('./inventory-compiler');
const Dual = require('./dual-form-compiler');

function build() {
  const source = Inventory.readSource();
  const outputs = Object.assign({}, Inventory.render(source), Dual.render(source));
  Inventory.write(outputs);
  return { schema: 'axm.sensorium-build-receipt/v1', verdict: 'PASS', source: Inventory.SOURCE, artifacts: Object.keys(outputs).length };
}
if (require.main === module) {
  try { const receipt = build(); console.log('Sensorium deterministic build: PASS - ' + receipt.artifacts + ' artifacts'); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { build };
