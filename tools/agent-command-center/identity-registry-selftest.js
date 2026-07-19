'use strict';
var Registry = require('./identity-registry.js');
var data = {};
var fakeStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
  setItem: function (k, v) { data[k] = String(v); },
  removeItem: function (k) { delete data[k]; }
};
Registry.configure({ storage: fakeStorage }).reset();
var pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }

ok(Registry.profiles().length === 4, 'four supervised identity profiles');
ok(Registry.connectorFor('nova') === 'local', 'Nova is locked to local');
ok(Registry.connectorFor('axiom-mir') === 'chatgpt', 'Axiom/Mir is locked to cloud ChatGPT');
ok(Registry.connectorFor('gemini-local') === 'local', 'Gemini Local is locked to local');
ok(Registry.binding('gemini-local').model === 'gemini-local', 'Gemini Local is also model locked');
ok(Registry.connectorFor('mirror') === 'mirror-native', 'Mirror is locked to its separate native runtime');
ok(Registry.binding('mirror').askEnabled === false, 'Mirror Workshop binding is wisdom-only');
ok(Registry.defaultIdentity() === null, 'default identity is opt-in');
Registry.setDefaultIdentity('nova');
ok(Registry.defaultIdentity().id === 'nova', 'optional default identity can be selected');
var privateNova = Registry.remember('nova', { text: 'Nova private lesson', source: 'test', evidence: ['observed'], confidence: 'high' });
ok(privateNova.scope === 'private', 'identity memory defaults to private');
ok(!Registry.memories('axiom-mir').some(function (x) { return x.text === 'Nova private lesson'; }), 'private Nova memory does not leak to Axiom/Mir');
ok(!Registry.memories('mirror').some(function (x) { return x.text === 'Nova private lesson'; }), 'private Nova memory does not leak to Mirror');
var privateMirror = Registry.remember('mirror', { text: 'Mirror private lesson', source: 'test', evidence: ['observed'], confidence: 'high' });
ok(privateMirror.scope === 'private' && Registry.memories('mirror', { includeShared: false }).length === 1, 'Mirror has an isolated private wisdom stream');
Registry.remember('nova', { text: 'Deliberately shared lesson', source: 'test', evidence: ['approved'], confidence: 'high' }, { shared: true });
ok(Registry.memories('axiom-mir').some(function (x) { return x.text === 'Deliberately shared lesson'; }), 'explicit shared wisdom reaches the other identity');
var blocked = false;
try { Registry.assertRoute('nova', 'chatgpt'); } catch (e) { blocked = /blocked/.test(e.message); }
ok(blocked, 'wrong connector is blocked');
var mirrorAskBlocked = false;
try { Registry.ask('mirror', 'hello', { connect: { ask: function () { throw new Error('must not route'); } } }); } catch (e) { mirrorAskBlocked = /wisdom-only/.test(e.message); }
ok(mirrorAskBlocked, 'Mirror is not silently routed through a generic connector');
var captured;
Registry.ask('nova', 'hello', { connect: { ask: function (prompt, opts) { captured = opts; return Promise.resolve({ text: 'ok' }); } } }).then(function (r) {
  ok(r.identityId === 'nova', 'response is identity attributed');
  ok(captured.aiProvider === 'local' && captured.system.indexOf('ACTIVE IDENTITY: Nova') >= 0, 'ask injects only the bound identity context');
  console.log('PASS identity registry: ' + pass + ' assertions');
}).catch(function (e) { console.error(e.stack || e); process.exitCode = 1; });
