#!/usr/bin/env node
'use strict';

const childProcess=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const unit=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.js')).sort().map(name=>path.join('tests',name));
const commands=[
  [process.execPath,['--test',...unit],'unit/integration'],
  [process.execPath,['tests/cli-lifecycle-smoke.js'],'CLI lifecycle'],
  [process.execPath,['tests/game-hub-lifecycle-smoke.js'],'actual Game Hub lifecycle'],
  [process.execPath,['scripts/verify-package.js'],'package verifier']
];
for(const [command,args,label] of commands){
  console.log('\n=== '+label+' ===');
  const result=childProcess.spawnSync(command,args,{cwd:root,stdio:'inherit',env:process.env});
  if(result.status!==0){console.error('FAILED: '+label);process.exit(result.status==null?1:result.status)}
}
console.log('\nCIRCUITSEED FULL TEST COMMAND: PASS');
