#!/usr/bin/env node
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');
const Fabric = require('../shared/capability-fabric/index.js');

const catalog=Fabric.loadCatalog();
const recipe=catalog.recipes.find(function(row){return row.id==='svg-status-badge';});
const run=Fabric.build(Fabric.sealRequest(recipe.exampleRequest,true),catalog);
if(run.status!=='COMPLETE')throw new Error('SVG proof candidate did not build.');
const candidate=run.candidates[0],verification=Fabric.verifyCandidate(candidate);
if(!verification.ok)throw new Error('SVG proof candidate failed package verification.');
const sandbox={module:{exports:{}},exports:{}};
vm.runInNewContext(candidate.files['capability.js'],sandbox,{timeout:1000,filename:'verified-svg-status-badge-capability.js'});
const rendered=sandbox.module.exports.render({label:'CAPABILITY',value:'EXPERIMENTAL'});
if(!rendered.ok||rendered.mimeType!=='image/svg+xml')throw new Error('SVG proof render failed.');
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capability Fabric SVG proof</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#071018}svg{width:min(90vw,480px);height:auto}</style><main>'+rendered.svg+'</main></html>';
const fixture=fs.readFileSync(path.join(__dirname,'fixtures','capability-fabric-svg-proof.html'),'utf8').trim();
if(fixture!==html)throw new Error('Static SVG fixture drifted from the trusted VM render output.');
process.stdout.write('PASS trusted VM SVG render exactly matches static fixture; browser appearance remains UNKNOWN · '+candidate.package.packageDigest+'\n');
