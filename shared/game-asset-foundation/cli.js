#!/usr/bin/env node
'use strict';

const path = require('path');
const Foundation = require('./game-asset-foundation');
const Writer = require('./pack-writer');

function help() {
  return [
    'AXM Game Asset Foundation',
    '',
    'Usage:',
    '  node shared/game-asset-foundation/cli.js --out <new-or-empty-directory> [--full] [--zip] [--seed <text>]',
    '',
    '--full  PBR-bake every static visible asset; default bakes one representative per static family.',
    '--zip   Also create an uncompressed dependency-free ZIP beside the output directory.',
    '',
    'Every result is candidate-only. Native engine import and human art review remain separate gates.'
  ].join('\n');
}

function argument(name) { const index=process.argv.indexOf(name); return index>=0?process.argv[index+1]:null; }

(async function main(){
  if(process.argv.includes('--help')||process.argv.includes('-h')){console.log(help());return;}
  const out=argument('--out');if(!out)throw new Error('--out is required\n\n'+help());
  const result=await Foundation.build({seed:argument('--seed')||'urban-starter',bakeMode:process.argv.includes('--full')?'all':'representative'});
  const receipt=Writer.writePack(path.resolve(out),result,{zip:process.argv.includes('--zip')});
  console.log(JSON.stringify({status:receipt.status,output:receipt.output,files:receipt.files,bytes:receipt.bytes,archive:receipt.archive&&receipt.archive.file,technicalStatus:result.report.status,assets:result.manifest.assets.length},null,2));
}()).catch(error=>{console.error(String(error&&error.stack||error));process.exit(1);});
