#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Core = require('./axm-direction-core');
const modules = [
  { id:'copy-composer-hand', name:'Copy Composer Hand', folder:'copy-composer-hand', entry:'index.html' },
  { id:'asset-fabric', name:'Asset Fabric', folder:'asset-fabric', entry:'index.html' },
  { id:'studio', name:'Studio', folder:'studio', entry:'index.html' },
  { id:'game-forge', name:'Game Forge', folder:'game-forge', entry:'index.html' },
  { id:'agent-tool-forge', name:'Agent Tool Forge', folder:'agent-tool-forge', entry:'index.html' },
  { id:'project-room', name:'Project Room', folder:'project-room', entry:'index.html' },
  { id:'governed-evolution-lab', name:'Living World Lineage', folder:'governed-evolution-lab', entry:'index.html' }
];
let pass = 0;
function test(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name + '\n  ' + error.stack); process.exitCode = 1; } }
test('visual asset request gets a real Body Pulse hand', () => { const plan = Core.compile({ title:'Make revive icons', description:'Build a reusable icon asset pack', actorId:'mike' }, modules, 1000); const route = plan.routes.find(item => item.moduleId === 'asset-fabric'); assert(route); assert.equal(route.execution.mode, 'BODY_PULSE'); assert.equal(route.bodyGoal.maxPulses, 2); });
test('exact Mike quote request gets the deterministic copy hand', () => { const plan = Core.compile({ title:'make an inspiring quote for axm', description:'make an inspiring quote for axm', actorId:'mike' }, modules, 1000); assert.equal(plan.routes.length, 1); assert.equal(plan.routes[0].moduleId, 'copy-composer-hand'); assert.equal(plan.routes[0].execution.handId, 'copy-composer'); assert.equal(plan.verdict, 'READY_BOUNDED'); assert.equal(plan.handRequests.length, 0); });
test('game request names an adapter gap instead of faking automation', () => { const plan = Core.compile({ title:'Build a co-op game', description:'Make a multiplayer game with controller joining' }, modules, 1000); const route = plan.routes.find(item => item.moduleId === 'game-forge'); assert(route); assert.equal(route.status, 'WAITING_FOR_OPERATOR_OR_HAND'); assert(plan.handRequests.some(hand => hand.targetModuleId === 'game-forge' && hand.kind === 'AUTOMATION_ADAPTER')); });
test('missing installed module becomes a capability-module request', () => { const plan = Core.compile({ title:'Compose music', description:'Make a music score' }, modules, 1000); assert.equal(plan.routes[0].status, 'HELD_MISSING_CAPABILITY'); assert.equal(plan.handRequests[0].kind, 'CAPABILITY_MODULE'); });
test('mixed request splits across modules and remains bounded to eight routes', () => { const plan = Core.compile({ title:'Build a world game', description:'Make a game with icon assets, evolving species, music, research data, a trailer, code tools, and a publish package', maxPulsesPerRoute:99 }, modules, 1000); assert(plan.routes.length > 2); assert(plan.routes.length <= 8); assert.equal(plan.request.maxPulsesPerRoute, 8); assert.equal(plan.verdict, 'PARTIAL_HANDS_REQUIRED'); });
test('high quality adds independent review without granting promotion', () => { const plan = Core.compile({ title:'Create badges', description:'Generate achievement badge assets', quality:'HIGH' }, modules, 1000); assert(plan.routes[0].qualityExams.includes('independent-perspective-review')); assert.equal(plan.limits.promotionAuthority, 'NONE'); });
test('same input and time produces the same route plan', () => { const input = { title:'Build an icon', description:'Make an icon asset', actorId:'mirror' }; assert.deepEqual(Core.compile(input, modules, 1000), Core.compile(input, modules, 1000)); });
test('stored direction lifecycle is explicit', () => { const plan = Core.compile({ title:'Build assets', description:'Create icon assets' }, modules, 1000); let state = Core.storePlan(Core.createState(), plan, 2000); state = Core.setDirectionStatus(state, plan.request.requestId, 'PAUSED', 'mike', 3000); assert.equal(Core.publicState(state).directions[0].status, 'PAUSED'); });
if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · direction-core ' + Core.VERSION);
