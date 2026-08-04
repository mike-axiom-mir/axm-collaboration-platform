import AXM from '../../dist/runtime/axm-aether-runtime.mjs';

const runtime = new AXM.AetherRuntime();
const compiled = runtime.compile();
const web = runtime.targetReport('web-css');
const game = runtime.targetReport('generic-game-contract');
const snapshot = runtime.snapshot();

console.log(JSON.stringify({
  fabricVersion: AXM.version,
  valid: compiled.report.valid,
  sourceLayers: compiled.recipe.layers.length,
  resolvedOperations: compiled.plan.length,
  webSupport: web.summary,
  gameSupport: game.summary,
  snapshot: {
    schema: snapshot.schema,
    customModules: snapshot.customModules.length
  }
}, null, 2));
