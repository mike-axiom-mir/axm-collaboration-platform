#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const core=require('./market-core');
const sources=require('./source-adapters');
const dictionary=JSON.parse(fs.readFileSync(path.join(__dirname,'market-dictionary.json'),'utf8'));
let pass=0;
function test(name,fn){try{fn();console.log('PASS '+name);pass++;}catch(e){console.error('FAIL '+name+'\n  '+e.stack);process.exitCode=1;}}

const base={itemId:'coffee',itemName:'Coffee',category:'food',geography:'NL',observedAt:'2026-07-01',price:18,currency:'EUR',unit:'kg',quantity:1,seller:'A',availability:'in_stock',sourceId:'source-a',sourceType:'official-statistics',marketplaceActivity:80,searchInterest:70,sellerGrowth:60,tradeMovement:50,pricePressure:40};

test('valid observation passes',()=>{const r=core.validateObservation(base,dictionary);assert.equal(r.pass,true);assert.equal(r.record.unitPriceEur,18);});
test('grams normalize to kilograms',()=>{const r=core.validateObservation({...base,price:2,unit:'g',quantity:100},dictionary).record;assert.equal(r.baseUnit,'kg');assert.equal(r.unitPriceEur,20);});
test('non-EUR row stays incomparable without explicit FX',()=>{const r=core.validateObservation({...base,currency:'USD'},dictionary);assert.equal(r.record.unitPriceEur,null);assert(r.warnings.some(x=>x.includes('fxRateToEur')));});
test('explicit FX enables comparison',()=>{const r=core.validateObservation({...base,currency:'USD',fxRateToEur:.9},dictionary).record;assert.equal(r.unitPriceEur,16.2);});
test('duplicates are refused',()=>{const first=core.importRows([base],dictionary,[]);const second=core.importRows([base],dictionary,first.accepted);assert.equal(second.accepted.length,0);assert.equal(second.duplicates.length,1);});
test('CSV parser preserves headers and values',()=>{const rows=sources.parseCsv('itemId,itemName\ncoffee,"Coffee beans"\n');assert.deepEqual(rows,[{itemId:'coffee',itemName:'Coffee beans'}]);});
test('popularity weights are transparent and deterministic',()=>{const p=core.popularityScore({marketplaceActivity:100,searchInterest:0,sellerGrowth:0,tradeMovement:0,pricePressure:0},dictionary.popularityWeights);assert.equal(Math.round(p.score),30);assert.equal(p.coverage,1);});
test('ranking stays source bounded',()=>{const rows=[base,{...base,itemId:'copper',itemName:'Copper',category:'materials',sourceId:'source-b',marketplaceActivity:90,searchInterest:90,sellerGrowth:90,tradeMovement:90,pricePressure:90}];const imported=core.importRows(rows,dictionary,[]).accepted;const rank=core.rankPopularity(imported,dictionary,'2026-07','ALL');assert.equal(rank.length,2);assert.equal(rank[0].itemId,'copper');});
test('geographic comparison separates NL and HR',()=>{const rows=[base,{...base,geography:'HR',sourceId:'source-hr',price:16}];const imported=core.importRows(rows,dictionary,[]).accepted;const cmp=core.compareGeographies(imported,dictionary,'coffee','2026-07',['NL','HR']);assert.equal(cmp.length,2);assert.equal(cmp[0].geography,'HR');});
test('report labels coverage honestly',()=>{const imported=core.importRows([base],dictionary,[]).accepted;const report=core.buildReport(imported,dictionary,{month:'2026-07',geography:'NL'});assert.equal(report.evidence.observations,1);assert(report.noFakeDone.includes('only imported observations'));});

if(!process.exitCode)console.log('\n'+pass+' PASS · 0 FAIL · market-core '+core.VERSION);
