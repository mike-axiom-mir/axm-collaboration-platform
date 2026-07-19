'use strict';

const path = require('path');
const MemoryContext = require('../organs/reasoning-memory-context-organ');

try {
  const result = MemoryContext.run();
  const context = result.context;
  console.log(`Reasoning memory context: ${context.state}`);
  console.log(`Receipts: ${context.inventory.supplied} supplied / ${context.inventory.verifiedUnique} verified unique / ${context.inventory.accessible} in scope`);
  console.log(`Exact matches: ${context.inventory.exactMatches} (${context.inventory.supporting} supporting / ${context.inventory.counterevidence} counterevidence)`);
  console.log(`Contradictory structural contexts: ${context.contradictions.length}`);
  console.log(`Unknowns: ${context.unknowns.join(', ') || 'none'}`);
  console.log('Memory writes: 0; evidence admissions: 0; decisions: 0; permission grants: 0; runtime promotions: 0');
  console.log(`Context: ${context.contextId}${result.reused ? ' (reused)' : ''}`);
  console.log(`State: ${path.resolve(result.runDir)}`);
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exitCode = 1;
}
