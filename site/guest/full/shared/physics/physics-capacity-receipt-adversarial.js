'use strict';
/**
 * Focused executable gate for the additive contact-capacity receipt.
 * Does not raise the 2,048 cap or alter collision ordering/response.
 */
const P = require('./axm-physics-core');

function item(id, status, evidence, measurements, limitations) {
  return { id, status, evidence, measurements, limitations: limitations || [] };
}

function add(world, body) {
  return P.addBody(world, body).world;
}

function belowCap() {
  let world = P.createWorld({
    gravity: { x: 0, y: 0 },
    fixedDelta: 1 / 60,
    solverIterations: 1,
    maxSubsteps: 1,
    bounds: false,
    sleep: { enabled: false }
  });
  world = add(world, {
    id: 'a',
    sensor: true,
    shape: { kind: 'circle', radius: 0.5 },
    position: { x: 0, y: 0 },
    gravityScale: 0
  });
  world = add(world, {
    id: 'b',
    sensor: true,
    shape: { kind: 'circle', radius: 0.5 },
    position: { x: 0.2, y: 0 },
    gravityScale: 0
  });
  world = P.step(world).world;
  const d = world.diagnostics;
  const receipt = d.contactCapacity;
  const ok =
    d.contactCount === 1 &&
    d.detectedUniqueContacts === 1 &&
    d.contactsStored === 1 &&
    d.contactsTruncated === 0 &&
    d.contactCapacityLimit === P.CONTACT_CAPACITY &&
    receipt &&
    receipt.schema === 'axm.physics-contact-capacity/v1' &&
    receipt.detected === 1 &&
    receipt.retained === 1 &&
    receipt.stored === 1 &&
    receipt.truncated === 0 &&
    receipt.limit === 2048 &&
    receipt.status === 'WITHIN_CAPACITY' &&
    receipt.reason === 'WITHIN_CONFIGURED_LIMIT';
  return item(
    'capacity-receipt-below-cap',
    ok ? 'PASS' : 'FAIL',
    'A single overlapping sensor pair must report complete capacity accounting with zero truncation.',
    {
      contactCount: d.contactCount,
      detectedUniqueContacts: d.detectedUniqueContacts,
      contactsStored: d.contactsStored,
      contactsTruncated: d.contactsTruncated,
      contactCapacityLimit: d.contactCapacityLimit,
      contactCapacity: receipt
    }
  );
}

function overCap() {
  let world = P.createWorld({
    gravity: { x: 0, y: 0 },
    fixedDelta: 1 / 120,
    solverIterations: 1,
    maxSubsteps: 1,
    bounds: false,
    sleep: { enabled: false },
    broadphase: { mode: 'spatial-hash', cellSize: 4 }
  });
  for (let index = 0; index < 66; index++) {
    world = add(world, {
      id: 'sensor-' + String(index).padStart(2, '0'),
      type: 'dynamic',
      sensor: true,
      shape: { kind: 'circle', radius: 0.5 },
      position: { x: (index % 11) * 0.01, y: Math.floor(index / 11) * 0.01 },
      gravityScale: 0
    });
  }
  world = P.step(world).world;
  const theoreticalPairs = (66 * 65) / 2;
  const d = world.diagnostics;
  const receipt = d.contactCapacity;
  const ok =
    theoreticalPairs > 2048 &&
    world.contacts.length === 2048 &&
    world.contactManifolds.length === 2048 &&
    d.detectedUniqueContacts === theoreticalPairs &&
    d.contactsStored === 2048 &&
    d.contactsTruncated === theoreticalPairs - 2048 &&
    d.contactCapacityLimit === 2048 &&
    receipt &&
    receipt.detected === theoreticalPairs &&
    receipt.retained === 2048 &&
    receipt.stored === 2048 &&
    receipt.truncated === theoreticalPairs - 2048 &&
    receipt.limit === 2048 &&
    receipt.status === 'TRUNCATED' &&
    receipt.reason === 'ACTIVE_CONTACT_EVIDENCE_CAP' &&
    receipt.prioritization === 'FIRST_DETECTED_UNIQUE_KEYS';
  return item(
    'capacity-receipt-over-cap',
    ok ? 'PASS' : 'FAIL',
    'The 66-body capacity probe must expose detected/retained/truncated counts without raising the 2,048 cap.',
    {
      bodies: 66,
      theoreticalPairs,
      contacts: world.contacts.length,
      manifolds: world.contactManifolds.length,
      detectedUniqueContacts: d.detectedUniqueContacts,
      contactsStored: d.contactsStored,
      contactsTruncated: d.contactsTruncated,
      contactCapacity: receipt
    },
    ['Does not choose a new prioritization policy beyond documenting first-detected unique keys.']
  );
}

function run() {
  const checks = [belowCap(), overCap()];
  const fail = checks.filter((check) => check.status === 'FAIL').length;
  return {
    schema: 'axm.physics-capacity-receipt-adversarial/v1',
    engine: { id: 'axm-physics-2d', version: P.VERSION },
    status: fail ? 'FAIL' : 'PASS',
    checks,
    summary: { pass: checks.length - fail, fail },
    truth: {
      contactCapRaised: false,
      collisionOrderingChanged: false,
      collisionResponseChanged: false,
      additiveDiagnosticsOnly: true
    }
  };
}

if (require.main === module) {
  const report = run();
  report.checks.forEach((check) =>
    console.log(check.status.padEnd(5), check.id, '·', check.evidence, JSON.stringify(check.measurements))
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail) process.exitCode = 1;
}

module.exports = { run };
