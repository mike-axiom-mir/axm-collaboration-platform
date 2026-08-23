'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./artifact-depot-core');
const Host = require('./artifact-depot-host');

let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function expect(code, fn) { let error = null; try { fn(); } catch (caught) { error = caught; } check(error && error.code === code, `expected ${code}, observed ${error && error.code}`); }

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-artifact-depot-'));
  try {
    const bytes = Buffer.from('immutable candidate bytes\n');
    const first = Host.put(root, bytes, { mediaType: 'text/plain' });
    check(first.state === 'STORED_VERIFIED', 'new artifact stored and verified');
    check(Host.put(root, bytes, { mediaType: 'text/plain' }).state === 'EXISTS_VERIFIED', 'duplicate put verifies existing bytes');
    check(Host.get(root, first.ref).equals(bytes), 'get returns digest-verified bytes');
    check(Host.list(root).length === 1 && Host.list(root)[0] === first.ref.digest, 'list exposes only complete digest paths');
    const partial = path.join(path.dirname(first.path), `.${first.ref.digest}.partial-crash`);
    fs.writeFileSync(partial, 'interrupted');
    check(Host.list(root).length === 1, 'interrupted partial file is never a valid artifact');
    const tampered = Buffer.from('tampered');
    expect('ARTIFACT_DIGEST_MISMATCH', () => Core.verifyRef(first.ref, tampered));
    const lease = Host.putLease(root, { id: 'test-lease', owner: 'selftest', artifacts: [first.ref.digest] });
    check(lease.grantsAuthority === false, 'lease does not grant runtime authority');
    expect('LEASE_ALREADY_EXISTS', () => Host.putLease(root, { id: 'test-lease', owner: 'selftest', artifacts: [] }));
    const exported = Core.exportManifest([first.ref]);
    check(exported.artifacts.length === 1 && exported.executionAuthority === false, 'offline export is data without execution authority');
    check(typeof Host.delete === 'undefined' && typeof Host.collect === 'undefined', 'no deletion or garbage-collection API exists');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write(`artifact-depot selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();
module.exports = { run };
