'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../core/promotion-gate');
const actor={actor_id:'mike',actor_kind:'HUMAN'};
function packet(verdict){return P.create({candidate:{candidate_id:'candidate:x'},challenger:{model_id:'model:c',hash:'c'},baseline:{model_id:'model:b',hash:'b'},baselineEvaluation:{summary:{}},challengerEvaluation:{summary:{}},seamVerdict:{verdict_id:'sv',verdict,seams:[]},actor});}
test('approval is blocked unless Seam Cell recommends promote',()=>{const p=packet('HOLD');assert.throws(()=>P.review(p,{decision:'APPROVE',reviewer:actor,reason:'no'}),/cannot approve/);});
test('explicit human approval records a decision',()=>{const p=packet('PROMOTE');P.review(p,{decision:'APPROVE',reviewer:actor,reason:'evidence passed'});assert.equal(p.status,'APPROVED');assert.equal(p.reviewer_decisions.length,1);});
