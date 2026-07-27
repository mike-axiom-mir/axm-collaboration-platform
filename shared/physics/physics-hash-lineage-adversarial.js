'use strict';
/**
 * Focused gate for additive configuration/definition/identity lineage hashes.
 * The legacy checksum algorithm and values must remain byte-for-byte unchanged.
 */
const P = require('./axm-physics-core');

function item(id, status, evidence, measurements, limitations) {
  return { id, status, evidence, measurements, limitations: limitations || [] };
}

function add(world, body) {
  return P.addBody(world, body).world;
}

function sampleWorld() {
  let world = P.createWorld({
    gravity: { x: 0, y: 9.81 },
    fixedDelta: 1 / 60,
    solverIterations: 8,
    maxSubsteps: 8,
    bounds: { minX: 0, minY: 0, maxX: 16, maxY: 9, restitution: 0.35 },
    broadphase: { mode: 'spatial-hash', cellSize: 1 },
    constraints: { warmStart: false, warmStartFactor: 0.85 }
  });
  world = add(world, {
    id: 'floor',
    type: 'static',
    shape: { kind: 'box', halfWidth: 7, halfHeight: 0.35 },
    position: { x: 8, y: 8.5 },
    friction: 0.8
  });
  world = add(world, {
    id: 'ball',
    type: 'dynamic',
    shape: { kind: 'circle', radius: 0.35 },
    position: { x: 8, y: 1 },
    velocity: { x: 0.5, y: 0 },
    mass: 1,
    restitution: 0.25,
    collision: { category: 1, mask: 2147483647, group: 0 }
  });
  return world;
}

function stability() {
  const a = sampleWorld();
  const b = sampleWorld();
  const hashesA = {
    checksum: P.checksum(a),
    configurationHash: P.configurationHash(a),
    definitionHash: P.definitionHash(a),
    identityHash: P.identityHash(a),
    lineage: P.lineageHashes(a)
  };
  const hashesB = {
    checksum: P.checksum(b),
    configurationHash: P.configurationHash(b),
    definitionHash: P.definitionHash(b),
    identityHash: P.identityHash(b),
    lineage: P.lineageHashes(b)
  };
  const diag = a.diagnostics;
  const ok =
    hashesA.checksum === hashesB.checksum &&
    hashesA.configurationHash === hashesB.configurationHash &&
    hashesA.definitionHash === hashesB.definitionHash &&
    hashesA.identityHash === hashesB.identityHash &&
    hashesA.lineage.configurationHash === hashesA.configurationHash &&
    hashesA.lineage.definitionHash === hashesA.definitionHash &&
    hashesA.lineage.identityHash === hashesA.identityHash &&
    diag.configurationHash === hashesA.configurationHash &&
    diag.definitionHash === hashesA.definitionHash &&
    diag.identityHash === hashesA.identityHash &&
    diag.checksum === hashesA.checksum &&
    hashesA.configurationHash !== hashesA.definitionHash &&
    hashesA.definitionHash !== hashesA.identityHash &&
    hashesA.configurationHash !== hashesA.checksum;
  return item(
    'lineage-hash-stability',
    ok ? 'PASS' : 'FAIL',
    'Identical worlds must produce stable, clearly separated lineage digests alongside the legacy checksum.',
    { hashesA, hashesB, diagnostics: { configurationHash: diag.configurationHash, definitionHash: diag.definitionHash, identityHash: diag.identityHash, checksum: diag.checksum } }
  );
}

function sensitivity() {
  const base = sampleWorld();
  const baseline = {
    checksum: P.checksum(base),
    configurationHash: P.configurationHash(base),
    definitionHash: P.definitionHash(base),
    identityHash: P.identityHash(base)
  };

  function clone() {
    return JSON.parse(JSON.stringify(base));
  }

  const gravity = clone();
  gravity.gravity.y = 2;
  const shape = clone();
  shape.bodies.find((b) => b.id === 'ball').shape.radius = 0.5;
  const material = clone();
  material.bodies.find((b) => b.id === 'ball').friction = 0.9;
  const filter = clone();
  filter.bodies.find((b) => b.id === 'ball').collision.mask = 1;
  const identity = clone();
  identity.bodies.find((b) => b.id === 'ball').id = 'sphere';
  const position = clone();
  position.bodies.find((b) => b.id === 'ball').position.x = 9;

  const map = {
    gravity: {
      configurationHash: P.configurationHash(gravity) !== baseline.configurationHash,
      definitionHash: P.definitionHash(gravity) !== baseline.definitionHash,
      identityHash: P.identityHash(gravity) !== baseline.identityHash,
      checksum: P.checksum(gravity) !== baseline.checksum
    },
    shape: {
      configurationHash: P.configurationHash(shape) !== baseline.configurationHash,
      definitionHash: P.definitionHash(shape) !== baseline.definitionHash,
      identityHash: P.identityHash(shape) !== baseline.identityHash,
      checksum: P.checksum(shape) !== baseline.checksum
    },
    material: {
      configurationHash: P.configurationHash(material) !== baseline.configurationHash,
      definitionHash: P.definitionHash(material) !== baseline.definitionHash,
      identityHash: P.identityHash(material) !== baseline.identityHash,
      checksum: P.checksum(material) !== baseline.checksum
    },
    filter: {
      configurationHash: P.configurationHash(filter) !== baseline.configurationHash,
      definitionHash: P.definitionHash(filter) !== baseline.definitionHash,
      identityHash: P.identityHash(filter) !== baseline.identityHash,
      checksum: P.checksum(filter) !== baseline.checksum
    },
    identity: {
      configurationHash: P.configurationHash(identity) !== baseline.configurationHash,
      definitionHash: P.definitionHash(identity) !== baseline.definitionHash,
      identityHash: P.identityHash(identity) !== baseline.identityHash,
      checksum: P.checksum(identity) !== baseline.checksum
    },
    position: {
      configurationHash: P.configurationHash(position) !== baseline.configurationHash,
      definitionHash: P.definitionHash(position) !== baseline.definitionHash,
      identityHash: P.identityHash(position) !== baseline.identityHash,
      checksum: P.checksum(position) !== baseline.checksum
    }
  };

  const ok =
    map.gravity.configurationHash === true &&
    map.gravity.definitionHash === false &&
    map.gravity.identityHash === false &&
    map.gravity.checksum === false &&
    map.shape.configurationHash === false &&
    map.shape.definitionHash === true &&
    map.shape.identityHash === false &&
    map.shape.checksum === false &&
    map.material.definitionHash === true &&
    map.material.configurationHash === false &&
    map.material.identityHash === false &&
    map.filter.definitionHash === true &&
    map.filter.identityHash === false &&
    map.identity.identityHash === true &&
    map.identity.definitionHash === true &&
    map.identity.checksum === true &&
    map.position.configurationHash === false &&
    map.position.definitionHash === false &&
    map.position.identityHash === false &&
    map.position.checksum === true;

  return item(
    'lineage-hash-field-sensitivity',
    ok ? 'PASS' : 'FAIL',
    'Configuration, definition and identity digests must react only to their declared fields; legacy checksum remains position/state scoped.',
    { baseline, map },
    ['Legacy checksum is intentionally not redefined.']
  );
}

function legacyPreservedAcrossStep() {
  const world = sampleWorld();
  const before = P.checksum(world);
  const stepped = P.step(world).world;
  const after = P.checksum(stepped);
  const ok =
    typeof before === 'string' &&
    before.length === 8 &&
    after.length === 8 &&
    stepped.diagnostics.checksum === after &&
    stepped.diagnostics.configurationHash === P.configurationHash(stepped) &&
    stepped.diagnostics.definitionHash === P.definitionHash(stepped) &&
    stepped.diagnostics.identityHash === P.identityHash(stepped) &&
    // same configuration/definition/identity across pure free motion step start
    P.configurationHash(world) === P.configurationHash(stepped) &&
    P.definitionHash(world) === P.definitionHash(stepped) &&
    P.identityHash(world) === P.identityHash(stepped);
  return item(
    'lineage-legacy-checksum-preserved',
    ok ? 'PASS' : 'FAIL',
    'Stepping must keep additive lineage fields coherent without redefining the legacy checksum field.',
    { before, after, steppedChecksum: stepped.diagnostics.checksum, lineage: stepped.diagnostics.lineage }
  );
}

function run() {
  const checks = [stability(), sensitivity(), legacyPreservedAcrossStep()];
  const fail = checks.filter((check) => check.status === 'FAIL').length;
  return {
    schema: 'axm.physics-hash-lineage-adversarial/v1',
    engine: { id: 'axm-physics-2d', version: P.VERSION },
    status: fail ? 'FAIL' : 'PASS',
    checks,
    summary: { pass: checks.length - fail, fail },
    truth: {
      legacyChecksumRedefined: false,
      additiveLineageOnly: true,
      authoritativeSignedZeroHash: false
    }
  };
}

if (require.main === module) {
  const report = run();
  report.checks.forEach((check) =>
    console.log(check.status.padEnd(5), check.id, '·', check.evidence, JSON.stringify(check.measurements.map || check.measurements.baseline || check.measurements))
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail) process.exitCode = 1;
}

module.exports = { run };
