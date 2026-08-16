'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Hardware=require('../../shared/hardware-research-registry');
const manifest=require('./manifest.json');
const contract=require('./module.contract.json');
const coreContract=require('../../shared/hardware-research-registry/module.contract.json');
const computeManifest=require('../compute-substrate-lab/manifest.json');

let checks=0;function ok(value,message){assert.ok(value,message);checks+=1;}
const schemaDir=path.join(__dirname,'..','..','shared','hardware-research-registry','schemas');
const schemas=fs.readdirSync(schemaDir).map(file=>JSON.parse(fs.readFileSync(path.join(schemaDir,file),'utf8')));
ok(manifest.id===contract.id&&manifest.version===contract.version,'tool identity is coherent');
ok(coreContract.id==='hardware-research-registry-core'&&contract.consumes.includes('service:hardware-research-registry-core'),'tool consumes the separate hardware core');
ok(schemas.some(item=>item.$id===Hardware.INTAKE_SCHEMA)&&schemas.some(item=>item.$id===Hardware.PACKAGE_SCHEMA)&&schemas.some(item=>item.$id===Hardware.SNAPSHOT_SCHEMA),'tracked schemas match runtime identifiers');
ok(contract.boundaries.refuses.includes('physical-hardware-execution')&&coreContract.boundaries.refuses.includes('automatic-safety-approval'),'hardware authority ceiling is declared at both layers');
ok(manifest.accepts.includes('axm.compute-hardware-reference/v1')&&computeManifest.accepts.includes('axm.compute-hardware-reference/v1'),'compute and hardware share a typed reference seam');
ok(computeManifest.id!==manifest.id&&computeManifest.tags.includes('hybrid-compute'),'compute remains a separate module and field');
ok(manifest.tags.includes('robotica')&&manifest.tags.includes('candidate-only'),'Robotica hardware research is routed as candidate-only');
console.log('Hardware Research Registry discovery seam passed '+checks+' checks.');
