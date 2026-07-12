'use strict';
const Router = require('./identity-router');
let captured = null, pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
Router.configure({ registry: { ask: function (identityId, prompt, opts) { captured = { identityId, prompt, opts }; return Promise.resolve({ text: 'ok' }); } } });
ok(Router.resolve('studio', 'ai1') === 'nova', 'Studio primary resolves to Nova');
ok(Router.resolve('studio', 'ai2') === 'gemini-local', 'Studio second resolves to Gemini Local');
let blocked = false; try { Router.resolve('studio', 'ghost'); } catch (e) { blocked = /no identity route/.test(e.message); }
ok(blocked, 'unknown slot is refused');
Router.register('test-tool', { reviewer: 'gemini-local' });
ok(Router.resolve('test-tool', 'reviewer') === 'gemini-local', 'new tool route registers without forking registry');
Router.ask('studio', 'ai1', 'hello', { temperature: 0 }).then(function (r) {
  ok(captured.identityId === 'nova', 'ask uses resolved identity');
  ok(r.toolId === 'studio' && r.slot === 'ai1' && r.identityId === 'nova', 'response carries route attribution');
  console.log('PASS identity router: ' + pass + ' assertions');
}).catch(function (e) { console.error(e.stack || e); process.exitCode = 1; });
