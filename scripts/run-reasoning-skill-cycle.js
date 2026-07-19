'use strict';

const Cycle = require('../training/reasoning-skill-cycle');
const ContractCurriculum = require('../organs/reasoning-contract-curriculum-organ');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');
const Counterexamples = require('../organs/reasoning-counterexample-organ');
const Metamorphic = require('../organs/reasoning-metamorphic-organ');

try {
  const contractCurriculum = ContractCurriculum.derive();
  const handoffGraph = HandoffGraph.derive();
  const counterexamples = Counterexamples.run();
  const metamorphic = Metamorphic.run();
  const result = Cycle.run();
  const contractHeldOut = ContractCurriculum.evaluateHeldOut(contractCurriculum, result.model);
  console.log(`${handoffGraph.reused ? 'REUSED' : 'CREATED'} ${handoffGraph.batch.batchId} (${handoffGraph.batch.summary.manifestBindingsPassed} manifest-bound contracts; ${handoffGraph.batch.summary.undeclaredContractFiles} undeclared files refused; ${handoffGraph.batch.summary.exactCrossModuleEdges} exact edges; ${handoffGraph.batch.summary.directRoutes} direct + ${handoffGraph.batch.summary.composedDepthTwoRoutes} depth-two routes; ${handoffGraph.batch.summary.routeSelectionMismatches} mismatches; no training)`);
  console.log(`${contractCurriculum.reused ? 'REUSED' : 'CREATED'} ${contractCurriculum.batch.batchId} (${contractCurriculum.batch.summary.privateTrainingExams} training + ${contractCurriculum.batch.summary.heldOutEvaluationExams} held-out contract exams; ${contractCurriculum.batch.summary.boundaryMismatches} mismatches)`);
  console.log(`${contractHeldOut.reused ? 'REUSED' : 'CREATED'} ${contractHeldOut.evaluation.evaluationId} (${contractHeldOut.evaluation.summary.challengerPassed}/${contractHeldOut.evaluation.summary.heldOutContracts} held-out transfer; ${contractHeldOut.evaluation.summary.trainingReceiptsCreated} held-out receipts)`);
  console.log(`${counterexamples.reused ? 'REUSED' : 'CREATED'} ${counterexamples.batch.batchId} (${counterexamples.batch.summary.worked} worked, ${counterexamples.batch.summary.didNotWork} did not work)`);
  console.log(`${metamorphic.reused ? 'REUSED' : 'CREATED'} ${metamorphic.batch.batchId} (${metamorphic.batch.summary.invariantConfirmed}/${metamorphic.batch.summary.probes} invariants confirmed; ${metamorphic.batch.summary.atomicProbes} atomic + ${metamorphic.batch.summary.composedProbes} composed; ${metamorphic.batch.summary.counterexamplesFound} counterexamples found)`);
  console.log(`${result.reused ? 'REUSED' : 'CREATED'} ${result.cycle.cycleId}`);
  console.log(`Decision: ${result.cycle.promotion.state}`);
  console.log(`Baseline held-out accuracy: ${result.cycle.evaluation.baseline.passed}/${result.cycle.evaluation.baseline.cases}`);
  console.log(`Challenger held-out accuracy: ${result.cycle.evaluation.challenger.passed}/${result.cycle.evaluation.challenger.cases}`);
  console.log(`Adversarial transfer: ${result.cycle.evaluation.challenger.adversarialPassed}/${result.cycle.evaluation.challenger.adversarialCases}`);
  console.log(`Observable candidate origination: ${result.cycle.evaluation.origination.challenger.passed}/${result.cycle.evaluation.origination.challenger.cases}`);
  console.log(`Legacy exact candidate-free diagnostic: ${result.cycle.evaluation.origination.challenger.legacyExactPassed}/${result.cycle.evaluation.origination.challenger.cases}`);
  console.log(`Safe underspecified holds: ${result.cycle.evaluation.origination.challenger.safeUnderspecifiedHolds}`);
  console.log(`Episodic reasoning receipts: ${result.cycle.corpus.privateReasoningExperienceReceiptCount} (${result.cycle.corpus.realLocalReasoningExperienceReceiptCount} real, ${result.cycle.corpus.syntheticCounterexampleReceiptCount} parent-linked synthetic, ${result.cycle.corpus.contractDerivedExamReceiptCount} contract-derived; ${result.cycle.corpus.admittedPositiveEpisodicExperiences} positive, ${result.cycle.corpus.admittedNegativeEpisodicExperiences} negative)`);
  console.log(`Learned strategy labels: ${result.cycle.model.learnedLabels.join(', ')}`);
  console.log(`Learned ordered strategies: ${result.cycle.model.learnedSequences.join(', ')}`);
  console.log(`Open seams: ${result.seamReport.summary.open}`);
  for (const seam of result.seamReport.seams.filter(item => item.status === 'OPEN')) console.log(`- ${seam.id}: ${seam.statement}`);
  console.log(`Run directory: ${result.runDir}`);
  console.log('Active runtime pointer unchanged. No automatic promotion occurred.');
} catch (error) {
  console.error(`Reasoning skill cycle failed: ${error.message}`);
  process.exitCode = 1;
}
