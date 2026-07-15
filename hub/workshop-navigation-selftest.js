#!/usr/bin/env node
'use strict';
const Nav = require('./workshop-navigation.js');
let fails = 0;
function ok(value, message) { if (value) console.log('  PASS  ' + message); else { console.log('  FAIL  ' + message); fails++; } }

(function logicalTrail() {
  const storage = Nav.memoryStorage();
  const history = Nav.createHistory(storage, 'test.logical', 4);
  history.record({ kind: 'home', label: 'Home' });
  history.record({ kind: 'module', id: 'studio', label: 'Studio' });
  history.record({ kind: 'module', id: 'project-room', label: 'Project Room' });
  ok(history.canBack(), 'logical trail can go back after visiting modules');
  const prior = history.back();
  ok(prior && prior.kind === 'module' && prior.id === 'studio', 'back returns the previous module');
  history.record({ kind: 'module', id: 'studio', label: 'Studio' });
  ok(history.entries().length === 2, 'consecutive duplicate screens are not added');
})();

(function boundedAndSafe() {
  const storage = Nav.memoryStorage();
  const history = Nav.createHistory(storage, 'test.bound', 3);
  history.record({ kind: 'home' });
  history.record({ kind: 'module', id: 'one' });
  history.record({ kind: 'module', id: 'two' });
  history.record({ kind: 'module', id: 'three' });
  ok(history.entries().length === 3, 'trail is bounded');
  history.record({ kind: 'route', route: 'https://example.com/not-axm' });
  ok(history.entries().length === 3, 'external routes are refused');
  ok(Nav.isWorkshopRoute('/tools/studio/index.html') && Nav.isWorkshopRoute('/hub/index.html'), 'same-origin workshop routes are accepted');
  ok(!Nav.isWorkshopRoute('//example.com') && !Nav.isWorkshopRoute('/admin'), 'non-workshop routes are refused');
})();

(function independentFromSavedState() {
  const navigationStorage = Nav.memoryStorage();
  const projectStorage = Nav.memoryStorage();
  projectStorage.setItem('axm.project.saved', JSON.stringify({ draft: 'untouched' }));
  const history = Nav.createHistory(navigationStorage, 'test.isolation', 10);
  history.record({ kind: 'home' });
  history.record({ kind: 'module', id: 'studio' });
  history.back();
  ok(projectStorage.getItem('axm.project.saved') === JSON.stringify({ draft: 'untouched' }), 'navigation does not modify saved project state');
})();

console.log(fails ? '\nNavigation self-test FAILED: ' + fails : '\nNavigation self-test PASS');
process.exitCode = fails ? 1 : 0;
