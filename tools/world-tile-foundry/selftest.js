'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Foundry = require('./world-tile-foundry');
const BlankWorld = require('./scripts/generate-blank-world');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
assert.equal(ContractVerifier.validateContract(contract, manifest).pass, true, 'module contract must validate');
assert.equal(manifest.status, 'TEST');
assert.deepEqual(manifest.permissions, []);
['canonical-world-write','raster-as-authority','runtime-state-import','automatic-game-install','automatic-promotion','visual-quality-approval','base-digest-mismatch'].forEach(value => assert.ok(contract.boundaries.refuses.includes(value), value));
['index.html','styles.css','app.js','world-tile-foundry.js','README.md'].forEach(file => assert.ok(fs.existsSync(path.join(root, file)), file + ' must exist'));

const generated = BlankWorld.generate();
assert.equal(generated.source.chunking.possibleCount, 100, 'blank world must expose 100 possible loading chunks');
assert.equal(generated.source.chunking.count, 0, 'blank world must materialize no empty chunks');
assert.equal(generated.raster.grid.possibleCount, 100, 'blank world raster must expose 100 possible loading regions');
assert.equal(generated.raster.grid.count, 0, 'blank world must store no empty raster tiles');
assert.equal(generated.raster.tiles.length, 0, 'blank world raster manifest must stay sparse');
assert.equal(generated.verification.features.total, 0, 'blank world must have no authored features');
const blankSource = JSON.parse(fs.readFileSync(path.join(BlankWorld.OUTPUT,'world-source.json'),'utf8'));
const blankRaster = JSON.parse(fs.readFileSync(path.join(BlankWorld.OUTPUT,'raster-manifest.json'),'utf8'));
const blankVerification = JSON.parse(fs.readFileSync(path.join(BlankWorld.OUTPUT,'verification.json'),'utf8'));
assert.equal(blankSource.contentPolicy.transparentSubstrateOnly, true);
assert.equal(blankVerification.result, 'PASS');
assert.equal(blankSource.world.width,10000);
assert.equal(blankSource.world.height,10000);
assert.equal(blankSource.world.canonicalUnit,'metre');
assert.equal(blankSource.buildRegion.shape,'circle');
assert.equal(blankSource.canvasModes.flat2d.assetCellPixels.width,128);
assert.equal(blankSource.canvasModes.spatial3d.placementCellMetres.height,.5);
assert.equal(blankSource.canvasModes.spatial3d.heightPolicyMetres.playableMaximum,20);
assert.equal(blankSource.canvasModes.spatial3d.heightPolicyMetres.reservedMaximum,50);
assert.equal(blankSource.canvasModes.spatial3d.heightPolicyMetres.playableMinimum,-0.5);
assert.equal(blankSource.canvasModes.spatial3d.heightPolicyMetres.reservedMinimum,-10);
assert.equal(blankSource.canvasModes.spatial3d.authoringSectorMetres.playableDepthLayers,1);
assert.equal(blankSource.canvasModes.spatial3d.authoringSectorMetres.reservedDepthLayers,20);
assert.equal(blankSource.creativeGrid.count,10000);
const blankChunks = blankSource.chunking.chunks.map(entry => JSON.parse(fs.readFileSync(path.join(BlankWorld.OUTPUT,entry.file),'utf8')));
assert.equal(Foundry.flattenChunks(blankSource,blankChunks).length, 0, 'blank chunks must stay empty');
assert.equal(fs.existsSync(path.join(BlankWorld.OUTPUT,'tiles')),false,'implicit empty raster must create no tile directory');
assert.equal(fs.existsSync(path.join(BlankWorld.OUTPUT,'chunks')),false,'implicit empty source must create no chunk directory');
assert.equal(Foundry.rectInsideBuildRegion({x:4950,y:4950,width:100,height:100},blankSource),true,'centre geometry must fit the circular world');
assert.equal(Foundry.rectInsideBuildRegion({x:100,y:100,width:100,height:100},blankSource),false,'outer square corner must stay frame-only');
let blankProject=Foundry.createProject(blankSource,'Sparse circle test');
blankProject=Foundry.addFeature(blankProject,blankSource,{layer:'building',geometry:{world:{x:4900,y:4900,width:100,height:100}},heightMetres:2});
assert.equal(Foundry.validateProject(blankProject,blankSource).ok,true);
assert.throws(() => Foundry.addFeature(blankProject,blankSource,{layer:'building',geometry:{world:{x:100,y:100,width:100,height:100}},heightMetres:2}),/buildable world region/);
const tooTall=JSON.parse(JSON.stringify(blankProject));tooTall.additions[0].heightMetres=21;
assert.equal(Foundry.validateProject(tooTall,blankSource).ok,false,'reserved height must not silently become playable');
const tooDeep=JSON.parse(JSON.stringify(blankProject));tooDeep.additions[0].elevationMetres=-1;
assert.equal(Foundry.validateProject(tooDeep,blankSource).ok,false,'reserved underground layers must not silently become playable');

const source = {
  schema: Foundry.SOURCE_SCHEMA, id: 'test-world', world: {width: 100, height: 80},
  layers: {included: Foundry.LAYERS.slice()}, semanticChunksSha256: 'semantic-exact',
  rasterAlignment: {masterSha256: 'raster-exact'},
  chunking: {count: 1, chunks: [{id:'world-00-00',column:0,row:0}]}
};
const emptyLayers = Object.fromEntries(Foundry.LAYERS.map(layer => [layer, []]));
emptyLayers.ground.push({id:'ground-1',geometry:{type:'rect',world:{x:0,y:0,width:100,height:80},chunkLocal:{x:0,y:0,width:100,height:80}},material:'city_ground',role:'base',walkable:true,collidable:false,navigationPriority:1});
emptyLayers.building.push({id:'building-1',geometry:{type:'rect',world:{x:10,y:10,width:20,height:20},chunkLocal:{x:10,y:10,width:20,height:20}},material:'brick',role:'house',walkable:false,collidable:true,navigationPriority:100});
const chunk = {schema:Foundry.CHUNK_SCHEMA,column:0,row:0,bounds:{x:0,y:0,width:100,height:80},layers:emptyLayers};
const features = Foundry.flattenChunks(source,[chunk]);
assert.equal(features.length,2);

let project = Foundry.createProject(source,'Farm test');
project = Foundry.farmStarter(project);
project = Foundry.setOverride(project,'building-1',{material:'barn',role:'shared_barn'});
project = Foundry.addFeature(project,source,{layer:'park',geometry:{world:{x:40,y:40,width:20,height:10}},material:'crop_plot',role:'grow_zone'});
assert.equal(Foundry.validateProject(project,source).ok,true);
const applied = Foundry.applyProject(features,project);
assert.equal(applied.find(feature => feature.id === 'ground-1').material,'farm_grass');
assert.equal(applied.find(feature => feature.id === 'building-1').material,'barn');
assert.equal(applied.filter(feature => feature.editState === 'addition').length,1);
const receipt = Foundry.buildHandoff(source,project);
assert.equal(receipt.schema,Foundry.HANDOFF_SCHEMA);
assert.equal(receipt.truth.canonicalBaseChanged,false);
assert.equal(receipt.truth.rasterPixelsChanged,false);
assert.equal(receipt.truth.runtimeStateIncluded,false);
assert.equal(receipt.truth.automaticPromotion,false);
assert.equal(receipt.truth.humanPromotionRequired,true);
assert.equal(Foundry.buildHandoff(source,project).digest32,receipt.digest32,'handoff must be deterministic');
const mismatched = JSON.parse(JSON.stringify(project)); mismatched.base.rasterSha256='wrong';
assert.equal(Foundry.validateProject(mismatched,source).ok,false,'wrong raster binding must be blocked');

const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/BASE NEVER CHANGED/);
assert.match(html,/farm starter/i);
assert.match(html,/New blank transparent world/);
assert.match(html,/Open Tilburg reference instead/);
assert.match(html,/Download builder handoff/);
assert.match(html,/New game build in another tab/);
assert.match(html,/128 px per metre/);
assert.match(html,/Customize sparse world grid/);
assert.match(html,/Save self-made map component/);
assert.doesNotMatch(html,/Install game|Promote automatically/);
console.log('world-tile-foundry selftest: PASS · 100 virtual chunks · 0 stored tiles · dual metric canvases · circular sparse world');
