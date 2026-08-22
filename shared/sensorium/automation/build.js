'use strict';

const Inventory = require('./inventory-compiler');
const Dual = require('./dual-form-compiler');

async function build() {
  const source = Inventory.readSource();
  const outputs = Object.assign({}, Inventory.render(source), Dual.render(source));
  await Inventory.write(outputs);
  return { schema: 'axm.sensorium-build-receipt/v1', verdict: 'PASS', source: Inventory.SOURCE, artifacts: Object.keys(outputs).length };
}
if (require.main === module) {
  build().then(function (receipt) { console.log('Sensorium deterministic build: PASS - ' + receipt.artifacts + ' artifacts'); })
    .catch(function (error) { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { build };
