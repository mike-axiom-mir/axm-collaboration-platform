'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixtureDir = path.resolve(__dirname, '..', 'fixtures');

test('byte-bound HTML fixtures are checked out with repository-stable LF endings', function () {
  const fixtureNames = fs.readdirSync(fixtureDir)
    .filter(function (name) { return name.endsWith('.html'); })
    .sort();

  assert.ok(fixtureNames.length > 0, 'expected at least one HTML fixture');
  fixtureNames.forEach(function (name) {
    const bytes = fs.readFileSync(path.join(fixtureDir, name));
    assert.equal(
      bytes.includes(13),
      false,
      name + ' contains CR bytes; the byte-preserving goldens require LF-stable checkout'
    );
  });
});
