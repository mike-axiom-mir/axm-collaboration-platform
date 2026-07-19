'use strict';
const vm=require('vm');
const {now,safeId,sha256,text,clone}=require('./utils');

const LANGUAGE_PROFILES={
  javascript:{syntax:'native_parse',comment:'//',danger:['child_process','process.env','require("fs")',"require('fs')",'require("net")',"require('net')",'eval(','new function','fetch(','xmlhttprequest','websocket']},
  python:{syntax:'static_basic',comment:'#',danger:['import os','import subprocess','from os','from subprocess','eval(','exec(','__import__','shell=true','socket.']},
  html_css:{syntax:'static_basic',comment:'<!--',danger:['<script','javascript:','onerror=','onload=','data:text/html']},
  generic:{syntax:'static_basic',comment:'',danger:['eval(','exec(','child_process','powershell -enc','rm -rf','curl http','wget http']}
};
function balanced(code){
  const pairs={')':'(',']':'[','}':'{'};const stack=[];let quote=null,escape=false;
  for(let i=0;i<code.length;i++){
    const ch=code[i];if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}
    if(quote){if(ch===quote)quote=null;continue;}if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if('([{'.includes(ch))stack.push(ch);else if(')]}'.includes(ch)&&stack.pop()!==pairs[ch])return false;
  }return !quote&&stack.length===0;
}
function syntaxCheck(language,code){
  if(language==='javascript')try{new vm.Script(code,{filename:'mirror-coding-submission.js'});return{pass:true,mode:'native_parse'};}catch(e){return{pass:false,mode:'native_parse',error:text(e.message,800)};}
  return{pass:balanced(code),mode:'static_basic',error:balanced(code)?null:'unbalanced brackets or quotes'};
}
function dangerHits(language,code,extra=[]){
  const s=code.toLowerCase(),patterns=[...(LANGUAGE_PROFILES[language]||LANGUAGE_PROFILES.generic).danger,...extra.map(x=>String(x).toLowerCase())];
  return [...new Set(patterns.filter(p=>s.includes(p)))];
}
function grade(input={}){
  const language=LANGUAGE_PROFILES[input.language]?input.language:'generic',code=String(input.code||''),contract=input.contract||{};
  const syntax=syntaxCheck(language,code),danger=dangerHits(language,code,contract.forbidden_patterns||[]),issues=[];
  if(!code.trim())issues.push({kind:'empty_submission',severity:'critical'});
  if(code.split(/\r?\n/).length>Number(contract.max_lines||500))issues.push({kind:'line_limit',severity:'high'});
  for(const fn of contract.expected_functions||[]){
    const found=language==='javascript'?new RegExp('(?:function\\s+'+fn+'\\s*\\(|(?:const|let|var)\\s+'+fn+'\\s*=|'+fn+'\\s*\\([^)]*\\)\\s*\\{)','i').test(code):language==='python'?new RegExp('def\\s+'+fn+'\\s*\\(','i').test(code):code.includes(fn);
    if(!found)issues.push({kind:'missing_function',name:fn,severity:'high'});
  }
  for(const p of contract.required_patterns||[])if(!new RegExp(p,'i').test(code))issues.push({kind:'missing_pattern',pattern:p,severity:'medium'});
  for(const p of contract.forbidden_patterns||[])if(new RegExp(p,'i').test(code))issues.push({kind:'forbidden_pattern',pattern:p,severity:'critical'});
  if(contract.require_tests&&!(code.match(/\b(test|assert|expect)\b/i)||Array.isArray(input.test_descriptions)&&input.test_descriptions.length))issues.push({kind:'missing_tests',severity:'high'});
  if(contract.require_error_handling&&!/\b(try|catch|throw|raise|except|if\s*\()/i.test(code))issues.push({kind:'missing_error_handling',severity:'medium'});
  if(contract.require_explicit_return&&!/\breturn\b/i.test(code))issues.push({kind:'missing_return',severity:'high'});
  const safety={pass:danger.length===0,hits:danger};
  const verdict=!syntax.pass||danger.length||issues.some(x=>x.severity==='critical')?'REJECT':issues.some(x=>x.severity==='high')?'REPAIR':'PASS';
  const report={schema:'axm.mirror.coding-grade/v1',grade_id:safeId('coding-grade'),track:'coding_foundations',language,syntax,safety,contract:{issues,pass:!issues.some(x=>['high','critical'].includes(x.severity))},tests:{descriptions:(input.test_descriptions||[]).map(x=>text(x,1000)),executed:false,reason:'v0.3 is static-first; arbitrary code execution is not authority.'},verdict,truth_boundary:'Code remains an action proposal until an explicit execution gate runs it.',created_at:now()};
  report.hash=sha256({...report,hash:undefined});return clone(report);
}
function curriculum(){return[
  {level:1,skill:'read_code',goal:'Identify inputs, outputs, state and side effects.'},
  {level:2,skill:'explain_code',goal:'Explain behavior without inventing execution results.'},
  {level:3,skill:'write_function',goal:'Write one bounded pure function from a contract.'},
  {level:4,skill:'write_test',goal:'Create normal, edge and failure tests.'},
  {level:5,skill:'repair_bug',goal:'Preserve the failing case, repair it and rerun the same test.'},
  {level:6,skill:'state_transition',goal:'Implement explicit, legal transitions with invalid-transition refusal.'},
  {level:7,skill:'adapter_contract',goal:'Translate between systems without taking their authority.'},
  {level:8,skill:'security_boundary',goal:'Recognize permission, data and execution boundaries.'},
  {level:9,skill:'version_migration',goal:'Evolve schemas while preserving old readable history.'}
];}
module.exports={grade,curriculum,LANGUAGE_PROFILES,syntaxCheck,dangerHits,balanced};
