'use strict';

const path = require('path');
const HandoffGraph = require('../organs/reasoning-handoff-graph-organ');

const root = path.resolve(__dirname, '..');
const result = HandoffGraph.derive({ root });
const summary = result.batch.summary;

console.log(`Handoff graph batch: ${result.batch.batchId}${result.reused ? ' (reused)' : ''}`);
console.log(`Typed contracts: ${summary.eligibleContracts}; exact cross-module edges: ${summary.exactCrossModuleEdges}`);
console.log(`Routes: ${summary.directRoutes} direct + ${summary.composedDepthTwoRoutes} depth-two = ${summary.exactRoutesSelected}`);
console.log(`Manifest bindings: ${summary.manifestBindingsPassed} passed; ${summary.manifestBindingsFailed} failed; undeclared contract files: ${summary.undeclaredContractFiles}`);
console.log(`Exact manifest-bound routes selected: ${summary.exactRoutesSelected}; unbound decoys rejected: ${summary.unboundDecoysRejected}; mismatches: ${summary.routeSelectionMismatches}`);
console.log(`Training receipts: ${summary.trainingReceiptsCreated}; world actions: ${summary.worldActionsExecuted}; Frontier: ${result.batch.frontier.state}`);
