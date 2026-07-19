'use strict';

const path = require('path');
const ContractCurriculum = require('../organs/reasoning-contract-curriculum-organ');
const ReasoningSkillCycle = require('../training/reasoning-skill-cycle');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'training', 'datasets', 'reasoning-receipts');
const derived = ContractCurriculum.derive({ root, directory });
const reasoning = ReasoningSkillCycle.run({ root, reasoningReceiptsDir: directory });
const heldOut = ContractCurriculum.evaluateHeldOut(derived, reasoning.model, { root, directory });

console.log(`Contract curriculum batch: ${derived.batch.batchId}${derived.reused ? ' (reused)' : ''}`);
console.log(`Typed contracts: ${derived.batch.summary.eligibleContracts}; training ${derived.batch.summary.privateTrainingExams}; held-out ${derived.batch.summary.heldOutEvaluationExams}`);
console.log(`Boundary exams: ${derived.batch.summary.boundaryPreserved}/${derived.batch.summary.eligibleContracts}; mismatches ${derived.batch.summary.boundaryMismatches}`);
console.log(`Private receipts appended: ${derived.reused ? 0 : derived.batch.summary.receiptsAppended}; held-out receipts: ${heldOut.evaluation.summary.trainingReceiptsCreated}`);
console.log(`Private reasoning cycle: ${reasoning.cycle.cycleId}${reasoning.reused ? ' (reused)' : ''}; active runtime: ${reasoning.cycle.authority.activeRuntime}`);
console.log(`Held-out transfer: ${heldOut.evaluation.summary.challengerPassed}/${heldOut.evaluation.summary.heldOutContracts}; leakage ${heldOut.evaluation.splitLeakage}`);
