#!/usr/bin/env node
'use strict';
const assert=require('assert');
const Hands=require('./asset-hands'),PdfX=require('./pdfx-codec'),Schemas=require('./artifact-schema-catalog');

const createdAt='2026-07-19T00:00:00Z';
const host={capabilities:['json'],permissions:[],accepts:[Hands.RESULT_SCHEMA,'application/pdf','application/json','image/svg+xml']};
function brief(overrides){
  return Object.assign({
    id:'pdfx-poster',title:'Bounded press poster',kind:'poster',intended_use:'poster',
    target_canvas:{
      medium:'print',dimensions:{width:210,height:297,unit:'mm'},
      colour:{space:'cmyk',transparency:'opaque',printable_colours:true,profile:'Chemical proof',rendering_intent:'relative-colorimetric'},
      physical:{bleed:3,minimum_stroke:.25},behaviour:['static'],
      performance:{max_file_bytes:3000000},
      print:{safe_margin:5,crop_marks:true,registration_marks:true,output_condition:'Chemical proof'},
      intended_use:'poster'
    },
    required_outputs:['application/pdf'],
    editable_recipe_formats:['axm.pdfx-production-recipe/v1'],
    quality_requirements:{require_preview:true,require_validation:true,require_editable_source:true}
  },overrides||{});
}
function artifact(result,id){const value=result.artifacts.find(item=>item.id===id);assert(value,'missing '+id);return value;}

(async function(){
  const installed=Hands.list(),installedIds=installed.map(hand=>hand.id),missing=Hands.listMissingHands();
  assert(installed.length>=21,'PDF/X requires the original catalog while allowing additive Hands');
  assert.equal(new Set(installedIds).size,installedIds.length,'installed Hand IDs must remain unique');
  assert(missing.length<=13,'implemented Hands may reduce the missing catalog');
  assert(!Hands.getMissingHand('pdfx-press-production'));

  const profile=await PdfX.loadProfile();
  assert.equal(profile.bytes.length,961644);
  assert.equal(profile.sha256,PdfX.PROFILE_SHA256);
  assert(profile.inspection.pass);
  assert.equal(profile.inspection.deviceClass,'prtr');
  assert.equal(profile.inspection.colourSpace,'CMYK');
  assert.equal(profile.inspection.description,'Chemical proof');

  const result=await Hands.createAsync('pdfx-press-production',brief(),{seed:'pdfx-seed',createdAt,host});
  assert.equal(result.status,'READY');
  assert(result.technical.pass);
  const pdfArtifact=artifact(result,'pdfx-document');
  assert.equal(pdfArtifact.mime,'application/pdf');
  assert.equal(pdfArtifact.format,'PDF/X-4');
  assert(!pdfArtifact.text);
  const bytes=PdfX.bytesFromDataUrl(pdfArtifact.dataUrl);
  const inspection=PdfX.inspect(bytes,{profileBytes:profile.bytes});
  assert(inspection.pass,inspection.errors.join(', '));
  assert.equal(inspection.pdfXVersion,'PDF/X-4');
  assert(inspection.outputIntent);
  assert(inspection.noFonts);
  assert(inspection.noActiveContent);
  assert.equal(inspection.icc.description,'Chemical proof');

  const recipe=JSON.parse(artifact(result,'pdfx-recipe').text);
  const report=JSON.parse(artifact(result,'pdfx-validation').text);
  assert(Schemas.validate(recipe.schema,recipe).pass);
  assert(Schemas.validate(report.schema,report).pass);
  assert.equal(recipe.target_canvas.physical.bleed,3);
  assert.equal(recipe.target_canvas.print.output_condition,'Chemical proof');
  assert.equal(recipe.profile.sha256,PdfX.PROFILE_SHA256);
  assert.equal(recipe.safety.automatic_print,false);
  assert.equal(report.status,'PASS');
  assert.equal(report.output_intent.profile_sha256,PdfX.PROFILE_SHA256);

  const deterministic=await Hands.verifyDeterminismAsync('pdfx-press-production',brief(),{seed:'pdfx-seed',createdAt,host});
  assert(deterministic.pass,JSON.stringify(deterministic));

  const brokenXref=bytes.slice();
  const xrefMarker=Buffer.from(brokenXref).lastIndexOf(Buffer.from('startxref\n'));
  assert(xrefMarker>0);
  brokenXref[xrefMarker+10]=48;
  assert(!PdfX.inspect(brokenXref,{profileBytes:profile.bytes}).pass);

  const brokenProfile=bytes.slice();
  const profileStart=Buffer.from(brokenProfile).indexOf(Buffer.from('6 0 obj\n'));
  const streamStart=Buffer.from(brokenProfile).indexOf(Buffer.from('stream\n'),profileStart)+7;
  assert(streamStart>7);
  brokenProfile[streamStart+200]^=1;
  assert(!PdfX.inspect(brokenProfile,{profileBytes:profile.bytes}).pass);

  const validationBrief=brief({
    id:'validate-pdfx',operation_mode:'validate',
    source_artifacts:[{id:'source-pdfx',mime:'application/pdf',format:'PDF/X-4',dataUrl:'data:application/pdf;base64,'+Buffer.from(brokenProfile).toString('base64'),digest:'tampered-pdf'}]
  });
  const validated=await Hands.createAsync('pdfx-press-production',validationBrief,{seed:'validate',createdAt,host});
  assert.notEqual(validated.status,'READY');
  assert(validated.technical.errors.some(error=>/output intent|container|profile|validation/i.test(error)));

  await assert.rejects(()=>PdfX.encode({widthMm:210,heightMm:297,outputCondition:'FOGRA39'}),/supports only the exact Chemical proof/);

  const legacyCanvas=JSON.parse(JSON.stringify(brief().target_canvas));
  delete legacyCanvas.colour.profile;
  delete legacyCanvas.print.output_condition;
  const legacy=Hands.create('production-print',brief({id:'legacy-print',target_canvas:legacyCanvas,required_outputs:['application/pdf'],editable_recipe_formats:['axm.production-print-recipe/v1']}),{seed:'legacy',createdAt,host});
  assert(legacy.technical.pass);
  const legacyPdf=legacy.artifacts.find(item=>item.mime==='application/pdf');
  assert(legacyPdf);
  assert.notEqual(legacyPdf.format,'PDF/X-4');

  console.log('Asset Hands PDF/X selftest PASS (real PDF/X-4 structure, exact CMYK ICC, canvas boxes, schemas, tamper, determinism, honest limits, legacy PDF)');
}()).catch(function(error){console.error(error);process.exit(1);});
