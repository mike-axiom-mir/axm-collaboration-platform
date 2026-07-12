#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const core=require('./market-core');
const insights=require('./market-insights');
const sources=require('./source-adapters');
const dictionary=JSON.parse(fs.readFileSync(path.join(__dirname,'market-dictionary.json'),'utf8'));
let pass=0;
function test(name,fn){try{fn();console.log('PASS '+name);pass++;}catch(e){console.error('FAIL '+name+'\n  '+e.stack);process.exitCode=1;}}

const base={itemId:'coffee',itemName:'Coffee',category:'food',geography:'NL',observedAt:'2026-07-01',price:18,currency:'EUR',unit:'kg',quantity:1,seller:'A',availability:'in_stock',sourceId:'source-a',sourceType:'official-statistics',sourceUrl:'https://example.test',marketplaceActivity:80,searchInterest:70,sellerGrowth:60,tradeMovement:50,pricePressure:40};

test('valid observation passes',()=>{const r=core.validateObservation(base,dictionary);assert.equal(r.pass,true);assert.equal(r.record.unitPriceEur,18);});
test('grams normalize to kilograms',()=>{const r=core.validateObservation({...base,price:2,unit:'g',quantity:100},dictionary).record;assert.equal(r.baseUnit,'kg');assert.equal(r.unitPriceEur,20);});
test('non-EUR row stays incomparable without explicit FX',()=>{const r=core.validateObservation({...base,currency:'USD'},dictionary);assert.equal(r.record.unitPriceEur,null);assert(r.warnings.some(x=>x.includes('fxRateToEur')));});
test('explicit FX enables comparison',()=>{const r=core.validateObservation({...base,currency:'USD',fxRateToEur:.9},dictionary).record;assert.equal(r.unitPriceEur,16.2);});
test('duplicates are refused',()=>{const first=core.importRows([base],dictionary,[]);const second=core.importRows([base],dictionary,first.accepted);assert.equal(second.accepted.length,0);assert.equal(second.duplicates.length,1);});
test('CSV parser preserves headers and values',()=>{const rows=sources.parseCsv('itemId,itemName\ncoffee,"Coffee beans"\n');assert.deepEqual(rows,[{itemId:'coffee',itemName:'Coffee beans'}]);});
test('nested popularity survives evidence re-import',()=>{const first=core.validateObservation({...base,popularity:{marketplaceActivity:77},marketplaceActivity:undefined},dictionary).record;const second=core.validateObservation(first,dictionary).record;assert.equal(second.popularity.marketplaceActivity,77);});
test('popularity weights are transparent and deterministic',()=>{const p=core.popularityScore({marketplaceActivity:100,searchInterest:0,sellerGrowth:0,tradeMovement:0,pricePressure:0},dictionary.popularityWeights);assert.equal(Math.round(p.score),30);assert.equal(p.coverage,1);});
test('ranking stays source bounded',()=>{const rows=[base,{...base,itemId:'copper',itemName:'Copper',category:'materials',sourceId:'source-b',marketplaceActivity:90,searchInterest:90,sellerGrowth:90,tradeMovement:90,pricePressure:90}];const imported=core.importRows(rows,dictionary,[]).accepted;const rank=core.rankPopularity(imported,dictionary,'2026-07','ALL');assert.equal(rank.length,2);assert.equal(rank[0].itemId,'copper');});
test('geographic comparison separates NL and HR',()=>{const rows=[base,{...base,geography:'HR',sourceId:'source-hr',price:16}];const imported=core.importRows(rows,dictionary,[]).accepted;const cmp=core.compareGeographies(imported,dictionary,'coffee','2026-07',['NL','HR']);assert.equal(cmp.length,2);assert.equal(cmp[0].geography,'HR');});
test('report labels coverage honestly',()=>{const imported=core.importRows([base],dictionary,[]).accepted;const report=core.buildReport(imported,dictionary,{month:'2026-07',geography:'NL'});assert.equal(report.evidence.observations,1);assert(report.noFakeDone.includes('only imported observations'));});

function imported(rows){return core.importRows(rows,dictionary,[]).accepted;}
const patternRows=imported([
  base,
  {...base,geography:'HR',price:14,sourceId:'source-hr',seller:'B',availability:'low_stock',marketplaceActivity:84,searchInterest:83,sellerGrowth:74,tradeMovement:72,pricePressure:75},
  {...base,geography:'EU',price:16,sourceId:'source-eu',seller:'C',marketplaceActivity:82,searchInterest:80,sellerGrowth:73,tradeMovement:71,pricePressure:74}
]);

test('quality report counts source-bounded evidence',()=>{const q=insights.qualityReport(patternRows,dictionary,{month:'2026-07',geography:'ALL',now:new Date('2026-07-12').getTime()});assert.equal(q.metrics.rows,3);assert.equal(q.metrics.sources,3);});
test('official evidence produces official share',()=>{const q=insights.qualityReport(patternRows,dictionary,{now:new Date('2026-07-12').getTime()});assert.equal(q.metrics.officialShare,1);});
test('demo evidence is a critical quality issue',()=>{const rows=imported([{...base,sourceType:'demo',sourceId:'demo-one'}]);const q=insights.qualityReport(rows,dictionary,{now:new Date('2026-07-12').getTime()});assert(q.issues.some(x=>x.code==='synthetic-demo'&&x.severity==='critical'));});
test('geographic price gap candidate is detected',()=>{const p=insights.detectPatterns(patternRows,dictionary,{month:'2026-07',geography:'ALL'});assert(p.some(x=>x.type==='geographic-price-gap'));});
test('demand and constrained availability candidate is detected',()=>{const rows=imported([{...base,availability:'low_stock',marketplaceActivity:90,searchInterest:90},{...base,sourceId:'source-b',availability:'out_of_stock',marketplaceActivity:88,searchInterest:92}]);const p=insights.detectPatterns(rows,dictionary,{month:'2026-07'});assert(p.some(x=>x.type==='demand-supply-pressure'));});
test('aligned multi-signal candidate is detected',()=>{const rows=imported([{...base,marketplaceActivity:85,searchInterest:84,sellerGrowth:82,tradeMovement:80,pricePressure:79}]);const p=insights.detectPatterns(rows,dictionary,{month:'2026-07'});assert(p.some(x=>x.type==='signal-alignment'));});
test('monthly price movement candidate is detected',()=>{const rows=imported([{...base,observedAt:'2026-06-01',sourceId:'june',price:10},{...base,observedAt:'2026-07-01',sourceId:'july',price:12}]);const p=insights.detectPatterns(rows,dictionary,{});assert(p.some(x=>x.type==='monthly-price-move'));});
test('timeline separates geography and month',()=>{const rows=imported([base,{...base,observedAt:'2026-06-01',sourceId:'old'},{...base,geography:'HR',sourceId:'hr'}]);const x=insights.timeline(rows,'coffee',['NL','HR']);assert(x.length>=3);});
test('source coverage groups source types',()=>{const x=insights.sourceCoverage(patternRows,dictionary,{});assert.equal(x[0].sourceType,'official-statistics');assert.equal(x[0].rows,3);});

test('polished shell references modular UI files',()=>{const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');['market-ui.css','market-app.js','market-insights.js'].forEach(file=>assert(html.includes(file),file+' missing from shell'));});
test('market app DOM references exist in the shell',()=>{const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');const app=fs.readFileSync(path.join(__dirname,'market-app.js'),'utf8');const ids=new Set(Array.from(html.matchAll(/id="([\w-]+)"/g),m=>m[1]));const used=new Set(Array.from(app.matchAll(/\$\('([\w-]+)'\)/g),m=>m[1]));const missing=Array.from(used).filter(id=>!ids.has(id));assert.deepEqual(missing,[]);});
test('source catalog distinguishes built import from planned adapters',()=>{const catalog=dictionary.sourceCatalog||[];assert(catalog.length>=6);assert.equal(catalog.filter(x=>x.status==='import-ready').length,1);assert(catalog.filter(x=>x.status==='adapter-planned').length>=5);});

if(!process.exitCode)console.log('\n'+pass+' PASS · 0 FAIL · market-core '+core.VERSION+' · insights '+insights.VERSION);
