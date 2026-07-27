#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/schema-identity-core');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function treeReceipt(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (entry.isSymbolicLink()) rows.push('SYMLINK:' + relative);
      else if (entry.isDirectory()) visit(absolute);
      else rows.push(relative + ':' + fs.statSync(absolute).size);
    }
  }
  visit(root);
  return rows;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-schema-identity-'));
try {
  writeJson(path.join(fixtureRoot, 'schemas', 'unique.json'), {
    $id: 'axm.fixture.unique/v1',
    type: 'object',
    properties: { id: { type: 'string' } }
  });
  const repeated = {
    $id: 'axm.fixture.repeated/v1',
    type: 'object',
    required: ['value']
  };
  writeJson(path.join(fixtureRoot, 'schemas', 'repeat-a.json'), repeated);
  writeJson(path.join(fixtureRoot, 'schemas', 'repeat-b.json'), repeated);
  writeJson(path.join(fixtureRoot, 'schemas', 'collision-a.json'), {
    $id: 'axm.fixture.collision/v1',
    type: 'string'
  });
  writeJson(path.join(fixtureRoot, 'schemas', 'collision-b.json'), {
    $id: 'axm.fixture.collision/v1',
    type: 'number'
  });
  writeJson(path.join(fixtureRoot, 'records', 'references.json'), {
    schema: 'axm.fixture.unique/v1',
    nested: {
      schema_version: 'axm.fixture.external/v2',
      future: { schema: 'future:axm.fixture.future/v3' }
    }
  });
  fs.mkdirSync(path.join(fixtureRoot, 'records'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'records', 'bom.json'),
    '\ufeff' + JSON.stringify({ schema: 'axm.fixture.unique/v1' })
  );
  fs.mkdirSync(path.join(fixtureRoot, 'broken'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'broken', 'invalid.json'), '{ nope');
  fs.mkdirSync(path.join(fixtureRoot, 'state'), { recursive: true });
  writeJson(path.join(fixtureRoot, 'state', 'ignored.json'), { $id: 'axm.ignored/v1' });
  fs.symlinkSync(path.join(fixtureRoot, 'schemas'), path.join(fixtureRoot, 'linked-schemas'));

  const before = treeReceipt(fixtureRoot);
  const first = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T00:00:00Z' });
  const second = Core.scanWorkshop(fixtureRoot, { now: '2026-07-26T01:00:00Z' });
  const after = treeReceipt(fixtureRoot);
  const definition = identity => first.definitionGroups.find(group => group.identity === identity);
  const reference = identity => first.referenceGroups.find(group => group.identity === identity);

  check('schema map declares its exact output schema', () => {
    assert.equal(first.schema, 'axm.schema-identity-map/v1');
  });
  check('one definition remains uniquely identified', () => {
    assert.equal(definition('axm.fixture.unique/v1').state, 'UNIQUE_DEFINITION');
  });
  check('byte-equivalent definition bodies are identical reuse', () => {
    const group = definition('axm.fixture.repeated/v1');
    assert.equal(group.state, 'REPEATED_IDENTICAL_DEFINITION');
    assert.equal(group.definitionDigests.length, 1);
    assert.equal(group.occurrences.length, 2);
  });
  check('same identity with different bodies is visibly divergent', () => {
    const group = definition('axm.fixture.collision/v1');
    assert.equal(group.state, 'DIVERGENT_SAME_ID_DEFINITIONS');
    assert.equal(group.definitionDigests.length, 2);
  });
  check('a reference with a local definition is observed exactly', () => {
    assert.equal(reference('axm.fixture.unique/v1').state, 'LOCAL_DEFINITION_OBSERVED');
  });
  check('absence of a local definition is observation rather than invalidity', () => {
    const group = reference('axm.fixture.external/v2');
    assert.equal(group.state, 'NO_LOCAL_DEFINITION_OBSERVED');
    assert.equal(group.truth.definitionRequiredInThisWorkshop, false);
  });
  check('future namespace remains explicit and version-shaped', () => {
    const occurrence = reference('future:axm.fixture.future/v3').occurrences[0];
    assert.equal(occurrence.protocol.future, true);
    assert.equal(occurrence.protocol.version, 'v3');
  });
  check('invalid JSON is recorded without stopping the bounded scan', () => {
    assert.equal(first.parseFailures.length, 1);
    assert.equal(first.parseFailures[0].code, 'INVALID_JSON');
  });
  check('UTF-8 BOM JSON is parsed with a visible format note', () => {
    assert.deepEqual(first.formatNotes, [{
      path: 'records/bom.json',
      code: 'UTF8_BOM_PRESENT'
    }]);
    assert(reference('axm.fixture.unique/v1').occurrences.some(item => item.path === 'records/bom.json'));
  });
  check('excluded state JSON does not enter identity evidence', () => {
    assert.equal(definition('axm.ignored/v1'), undefined);
  });
  check('filesystem symlinks are skipped and never followed', () => {
    assert.deepEqual(first.source.skippedSymlinks, ['linked-schemas']);
    assert.equal(first.source.symlinksFollowed, false);
  });
  check('scanning performs no source writes', () => {
    assert.deepEqual(after, before);
  });
  check('measurement time does not alter the source fingerprint', () => {
    assert.equal(first.source.fingerprint, second.source.fingerprint);
    assert.notEqual(first.measuredAt, second.measuredAt);
  });
  check('output leaks no absolute fixture root', () => {
    assert.equal(JSON.stringify(first).includes(fixtureRoot), false);
  });
  check('freshness is live inside TTL and stale after TTL', () => {
    const timed = Object.assign({}, first, { freshnessTtlMs: 1000 });
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:00.500Z' }).status, 'LIVE');
    assert.equal(Core.freshness(timed, { now: '2026-07-26T00:00:02Z' }).status, 'STALE');
  });
  check('unknown timing remains explicitly untimed', () => {
    assert.equal(Core.freshness({}).status, 'UNTIMED');
  });
  check('protocol parsing is deliberately convention-bounded', () => {
    assert.equal(Core.protocolShape('axm.demo/v12-beta').version, 'v12-beta');
    assert.equal(Core.protocolShape('KTX.2.0').convention, 'UNPARSED_VERSION_CONVENTION');
  });
  check('truth refuses validation registration repair installation and CANON', () => {
    for (const field of [
      'jsonSchemaValidationPerformed',
      'externalRegistryChecked',
      'semanticCompatibilityInferred',
      'schemasRegistered',
      'adaptersGenerated',
      'sourceMutationPerformed',
      'installerStagingPerformed',
      'installationPerformed',
      'permissionChanged',
      'promotionPerformed',
      'canonChanged'
    ]) assert.equal(first.truth[field], false);
  });
  check('manifest and contract identity version and permissions align', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    assert.equal(manifest.id, contract.id);
    assert.equal(manifest.version, contract.version);
    assert.deepEqual(manifest.permissions, contract.permissions);
  });
  check('contract refuses identity merge adapters mutation install and CANON', () => {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
    for (const boundary of [
      'same-id-automatic-merge',
      'adapter-generation',
      'source-mutation',
      'installer-staging',
      'module-installation',
      'canon-change'
    ]) assert(contract.boundaries.refuses.includes(boundary));
  });
  check('browser entry references only local candidate files', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    for (const name of ['styles.css', 'current-schema-map.js', 'app.js']) assert(html.includes(name));
    assert.equal(/https?:\/\//.test(html), false);
  });
  check('bundle builder is self-contained and excludes its output', () => {
    const source = fs.readFileSync(path.join(__dirname, 'build-bundle.js'), 'utf8');
    assert(source.includes("absolute === output"));
    assert(source.includes("'axm.module-bundle/v1'"));
  });

  const workshopRoot = argValue('--workshop-root');
  if (workshopRoot) {
    const live = Core.scanWorkshop(workshopRoot);
    check('live Workshop schema scan reads bounded JSON evidence', () => {
      assert(live.source.jsonFilesRead > 0);
      assert.equal(live.summary.uniqueDefinitionIds + live.summary.repeatedIdenticalDefinitions >= 0, true);
    });
    check('live Workshop scan remains observation only', () => {
      assert.equal(live.truth.sourceMutationPerformed, false);
      assert.equal(live.truth.canonChanged, false);
    });
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.stdout.write('\nSchema Identity Observatory selftest: PASS (' + checks + ' checks)\n');
