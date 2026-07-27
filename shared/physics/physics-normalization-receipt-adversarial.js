'use strict';
/**
 * Focused gate for additive input-normalization receipts.
 * Permissive coerce/clamp/fallback behavior must remain unchanged.
 */
const P = require('./axm-physics-core');

function item(id, status, evidence, measurements, limitations) {
  return { id, status, evidence, measurements, limitations: limitations || [] };
}

function expectedNormalizedWorld() {
  return {
    gravity: { x: 2, y: 9.81 },
    fixedDelta: 0.1,
    solverIterations: 1,
    maxSubsteps: 16,
    broadphase: { mode: 'spatial-hash', cellSize: 0.05 },
    constraints: { warmStart: false, warmStartFactor: 1 },
    bounds: {
      minX: -1000000000,
      minY: 0,
      maxX: 1000000000,
      maxY: 3,
      restitution: 1
    }
  };
}

function expectedNormalizedBody() {
  return {
    id: 'body-001',
    type: 'dynamic',
    shape: { kind: 'circle', radius: 0.001 },
    mass: 0.000001,
    restitution: 1,
    friction: 0,
    linearDamping: 0.999,
    gravityScale: 20,
    collision: { category: 2147483647, mask: 0, group: 32767 }
  };
}

function behaviorUnchanged() {
  const world = P.createWorld({
    fixedDelta: 99,
    solverIterations: 0,
    maxSubsteps: 99,
    gravity: { x: '2', y: 'bad' },
    broadphase: { mode: 'unknown', cellSize: 0 },
    constraints: { warmStart: 'yes', warmStartFactor: 9 },
    bounds: { minX: -2e9, minY: 'bad', maxX: 2e9, maxY: 3, restitution: 9 }
  });
  const added = P.addBody(world, {
    id: ' ',
    type: 'unknown',
    shape: { kind: 'circle', radius: -2 },
    mass: -2,
    restitution: 9,
    friction: -1,
    linearDamping: 4,
    gravityScale: 99,
    collision: { category: 2147483648, mask: -1, group: 99999 }
  });
  const body = added.world.bodies[0];
  const observedWorld = {
    gravity: added.world.gravity,
    fixedDelta: added.world.fixedDelta,
    solverIterations: added.world.solverIterations,
    maxSubsteps: added.world.maxSubsteps,
    broadphase: added.world.broadphase,
    constraints: added.world.constraints,
    bounds: added.world.bounds
  };
  const observedBody = {
    id: body.id,
    type: body.type,
    shape: body.shape,
    mass: body.mass,
    restitution: body.restitution,
    friction: body.friction,
    linearDamping: body.linearDamping,
    gravityScale: body.gravityScale,
    collision: body.collision
  };
  const same =
    JSON.stringify(observedWorld) === JSON.stringify(expectedNormalizedWorld()) &&
    JSON.stringify(observedBody) === JSON.stringify(expectedNormalizedBody());
  return item(
    'normalization-behavior-unchanged',
    same ? 'PASS' : 'FAIL',
    'Representative coerce/clamp/fallback outcomes must match the pre-receipt permissive contract.',
    { observedWorld, observedBody, expectedWorld: expectedNormalizedWorld(), expectedBody: expectedNormalizedBody() }
  );
}

function evidencePresent() {
  const world = P.createWorld({
    fixedDelta: 99,
    solverIterations: 0,
    maxSubsteps: 99,
    gravity: { x: '2', y: 'bad' },
    broadphase: { mode: 'unknown', cellSize: 0 },
    constraints: { warmStart: 'yes', warmStartFactor: 9 },
    bounds: { minX: -2e9, minY: 'bad', maxX: 2e9, maxY: 3, restitution: 9 }
  });
  const added = P.addBody(world, {
    id: ' ',
    type: 'unknown',
    shape: { kind: 'circle', radius: -2 },
    mass: -2,
    restitution: 9,
    friction: -1,
    linearDamping: 4,
    gravityScale: 99,
    collision: { category: 2147483648, mask: -1, group: 99999 }
  });
  const worldReceipt = world.normalizationReceipt;
  const bodyReceipt = added.normalizationReceipt;
  function validEvent(event) {
    return (
      event &&
      typeof event.field === 'string' &&
      typeof event.reason === 'string' &&
      event.input &&
      typeof event.input.kind === 'string' &&
      Object.prototype.hasOwnProperty.call(event, 'result')
    );
  }
  const requiredWorld = [
    ['fixedDelta', 'CLAMP_MAX', 0.1],
    ['gravity.x', 'COERCED_NUMBER', 2],
    ['gravity.y', 'NON_FINITE_FALLBACK', 9.81],
    ['broadphase.mode', 'ENUM_FALLBACK', 'spatial-hash'],
    ['constraints.warmStart', 'STRICT_TRUE_ONLY', false],
    ['bounds.restitution', 'CLAMP_MAX', 1]
  ];
  const requiredBody = [
    ['body.type', 'ENUM_FALLBACK', 'dynamic'],
    ['body.shape.radius', 'CLAMP_MIN', 0.001],
    ['body.mass', 'CLAMP_MIN', 0.000001],
    ['body.collision.category', 'CLAMP_MAX', 2147483647],
    ['body.collision.group', 'CLAMP_MAX', 32767]
  ];
  function has(receipt, field, reason, result) {
    return (receipt.events || []).some(
      (event) => event.field === field && event.reason === reason && event.result === result
    );
  }
  const worldOk =
    worldReceipt &&
    worldReceipt.schema === 'axm.physics-normalization-receipt/v1' &&
    worldReceipt.limit === 64 &&
    worldReceipt.events.length > 0 &&
    worldReceipt.events.every(validEvent) &&
    requiredWorld.every((row) => has(worldReceipt, row[0], row[1], row[2]));
  const bodyOk =
    bodyReceipt &&
    bodyReceipt.schema === 'axm.physics-normalization-receipt/v1' &&
    bodyReceipt.events.every(validEvent) &&
    requiredBody.every((row) => has(bodyReceipt, row[0], row[1], row[2]));
  return item(
    'normalization-receipt-evidence',
    worldOk && bodyOk ? 'PASS' : 'FAIL',
    'createWorld/addBody must expose bounded typed normalization evidence with field, reason, input and result.',
    {
      worldReceipt,
      bodyReceipt,
      requiredWorld,
      requiredBody,
      worldOk,
      bodyOk
    },
    ['Receipts are diagnostic only; silent permissive defaults remain.']
  );
}

function run() {
  const checks = [behaviorUnchanged(), evidencePresent()];
  const fail = checks.filter((check) => check.status === 'FAIL').length;
  return {
    schema: 'axm.physics-normalization-receipt-adversarial/v1',
    engine: { id: 'axm-physics-2d', version: P.VERSION },
    status: fail ? 'FAIL' : 'PASS',
    checks,
    summary: { pass: checks.length - fail, fail },
    truth: {
      permissiveDefaultsPreserved: true,
      strictRejectionNotImplemented: true,
      additiveDiagnosticsOnly: true
    }
  };
}

if (require.main === module) {
  const report = run();
  report.checks.forEach((check) =>
    console.log(check.status.padEnd(5), check.id, '·', check.evidence)
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail) process.exitCode = 1;
}

module.exports = { run };
