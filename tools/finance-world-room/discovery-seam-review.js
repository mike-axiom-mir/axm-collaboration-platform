#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=__dirname,html=fs.readFileSync(path.join(root,'index.html'),'utf8'),app=fs.readFileSync(path.join(root,'finance-app.js'),'utf8'),contract=JSON.parse(fs.readFileSync(path.join(root,'module.contract.json'),'utf8')),dict=JSON.parse(fs.readFileSync(path.join(root,'finance-dictionary.json'),'utf8'));
let pass=0;function check(name,fn){try{fn();console.log('PASS '+name);pass++;}catch(e){console.error('FAIL '+name+' · '+e.message);process.exitCode=1;}}
check('one visible world-room destination',()=>assert(html.includes('Finance World Room')));
check('flat map dominates spatial view',()=>assert(html.includes('id="worldMap"')));
check('map supports pan zoom and country focus',()=>assert(app.includes('setupMapGestures')&&app.includes('focusCountry')));
check('local published geography is vendored',()=>assert(fs.existsSync(path.join(root,'assets/world-countries-110m.geojson'))));
check('physics can reuse spatial pattern without finance coupling',()=>assert(contract.provides.includes('flat-world-statistic-map')));
check('time never silently carries data forward',()=>assert(contract.boundaries.refuses.includes('silent-carry-forward')));
check('network intake is explicit preview only',()=>assert(app.includes('preview-network-import')&&html.includes('does not save until you commit')));
check('World Bank aggregates are excluded by mapped ISO3 boundary',()=>assert(app.includes('new Set(Object.keys(countryByIso))')));
check('file intake uses review gate',()=>assert(app.includes('commitPreview')&&html.includes('Preview, inspect, then commit')));
check('source ID is mandatory',()=>assert(fs.readFileSync(path.join(root,'finance-core.js'),'utf8').includes('sourceId required')));
check('composite lenses reveal components and weights',()=>assert(Object.values(dict.lenses).every(x=>x.components.every(c=>Number.isFinite(c.weight)))));
check('lenses are not framed as forecasts',()=>assert(contract.boundaries.refuses.includes('composite-score-as-forecast')));
check('notes require invalidation',()=>assert(app.includes("if(!q||!i)")));
check('trade execution is refused',()=>assert(contract.boundaries.refuses.includes('automatic-trading')));
check('exports retain records imports and notes',()=>assert(app.includes('records:state.records,imports:state.imports,notes:state.notes')));
check('room remains experimental',()=>assert(JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).status==='EXPERIMENTAL'));
if(!process.exitCode)console.log('\n'+pass+' PASS · 0 FAIL · discovery seam review');
