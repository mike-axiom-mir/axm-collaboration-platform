'use strict';

const path = require('path');
const Cycle = require('../training/learning-cycle');

try {
  const result = Cycle.run();
  const open = result.seamReport.summary.open;
  console.log(`${result.reused ? 'REUSED' : 'CREATED'} ${result.cycle.cycleId}`);
  console.log(`Decision: ${result.cycle.promotion.state}`);
  console.log(`Open seams: ${open}`);
  for (const seam of result.seamReport.seams.filter(item => item.status === 'OPEN')) console.log(`- ${seam.id}: ${seam.statement}`);
  console.log(`Run directory: ${path.resolve(result.runDir)}`);
  console.log('Runtime pointer unchanged. No automatic promotion occurred.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
