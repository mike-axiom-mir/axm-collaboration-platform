'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Compute=require('../../shared/compute-substrate-lab');
const Hardware=require('../../shared/hardware-research-registry');
const manifest=require('./manifest.json');
const contract=require('./module.contract.json');
const coreContract=require('../../shared/compute-substrate-lab/module.contract.json');
const hardwareManifest=require('../hardware-research-registry/manifest.json');

let checks=0;function ok(value,message){assert.ok(value,message);checks+=1;}
const schemaDir=path.join(__dirname,'..','..','shared','compute-substrate-lab','schemas');
const schemas=fs.readdirSync(schemaDir).map(file=>JSON.parse(fs.readFileSync(path.join(schemaDir,file),'utf8')));
const ids=new Set(schemas.map(item=>item.$id));
ok(manifest.id===contract.id&&manifest.version===contract.version,'tool identity is coherent');
ok(coreContract.id==='compute-substrate-lab-core'&&contract.consumes.includes('service:compute-substrate-lab-core'),'tool consumes the separate compute core');
ok([Compute.INTAKE_SCHEMA,Compute.PACKAGE_SCHEMA,Compute.ROOT_PROPOSAL_SCHEMA,Compute.ROOT_DECISION_SCHEMA,Compute.SNAPSHOT_SCHEMA].every(id=>ids.has(id)),'tracked schemas match runtime identifiers');
ok(Compute.knownStart.selectedRoot.year===1837&&Compute.knownStart.selectedRoot.status==='PROVISIONAL','tracked known-start selects provisional 1837');
ok(Compute.knownStart.earlierCandidates.some(item=>item.year===1834)&&Compute.knownStart.policy.preserveSupersededRoot,'earlier candidate and supersession preservation are explicit');
ok(contract.boundaries.refuses.includes('automatic-root-change')&&coreContract.boundaries.refuses.includes('automatic-canon'),'root automation and CANON are refused at both layers');
ok(manifest.accepts.includes('axm.compute-hardware-reference/v1')&&hardwareManifest.accepts.includes('axm.compute-hardware-reference/v1'),'hardware reference seam is shared');
const hardwarePackage=Hardware.compile({schema:Hardware.INTAKE_SCHEMA,title:'family check',objective:'family check'});
const computePackage=Compute.compile({schema:Compute.INTAKE_SCHEMA,title:'family check',objective:'family check'});
ok(hardwarePackage.family===computePackage.family&&hardwarePackage.defaultField==='HARDWARE'&&computePackage.defaultField==='COMPUTE','modules share one family with different default fields');
ok(hardwarePackage.domain!==computePackage.domain,'hardware and compute retain distinct domains');
console.log('Compute Substrate Lab discovery seam passed '+checks+' checks.');
