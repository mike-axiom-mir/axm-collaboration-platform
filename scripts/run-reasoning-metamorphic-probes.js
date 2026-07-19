'use strict';

const Metamorphic = require('../organs/reasoning-metamorphic-organ');

try {
  const result = Metamorphic.run();
  const summary = result.batch.summary;
  console.log(`${result.reused ? 'REUSED' : 'CREATED'} ${result.batch.batchId}`);
  console.log(`Decision-invariance probes: ${summary.invariantConfirmed}/${summary.probes} confirmed`);
  console.log(`Atomic/composed probes: ${summary.atomicProbes}/${summary.composedProbes} (maximum depth ${summary.maximumCompositionDepth})`);
  console.log(`Counterexamples found: ${summary.counterexamplesFound}`);
  console.log(`Positive training receipts created: ${summary.positiveTrainingReceiptsCreated}`);
  console.log(`Negative receipts appended/reused: ${summary.negativeReceiptsAppended}/${summary.negativeReceiptsReused}`);
  console.log(`Repair operator candidates: ${summary.repairOperatorCandidates}`);
  console.log(`Frontier state: ${result.batch.frontier.state}`);
  console.log(`Run directory: ${result.runDir}`);
  console.log('No tool, world, semantic truth, runtime, canon, identity, or permission authority changed.');
} catch (error) {
  console.error(`Reasoning metamorphic probes failed: ${error.message}`);
  process.exitCode = 1;
}
