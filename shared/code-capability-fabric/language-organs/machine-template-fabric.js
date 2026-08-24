'use strict';
const crypto=require('crypto');
const grammar=require('./grammar-profile-registry.js');
const eyes=require('./specialist-eye-registry.js');
const cheatcodes=require('./machine-cheatcode-fabric.js');

const TEMPLATE_COUNT=12;
const SKELETON_COUNT=8;
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});
const TEMPLATE_DEFS=Object.freeze([
  ['native-parse-snapshot','understand',['parse']],
  ['symbol-impact-map','impact',['symbols']],
  ['dependency-closure','dependencies',['dependencies']],
  ['type-state-boundary','impact',['types-state']],
  ['control-effect-boundary','impact',['control-effects']],
  ['rewrite-hazard-guard','refactor',['rewrite-safety']],
  ['native-verifier-ladder','verification',['verification']],
  ['measure-before-optimization','performance',['performance-build']],
  ['debug-hypothesis-pack','debug',['debugging']],
  ['cross-language-comparison','discovery',['discovery']],
  ['safe-refactor-preflight','refactor',['parse','symbols','dependencies','types-state','control-effects','rewrite-safety','verification']],
  ['regression-defense-pack','verification',['verification','debugging','performance-build']],
]);

function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(typeof v==='string'?v:canon(v)).digest('hex')}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
function uniq(xs){return [...new Set((xs||[]).filter(x=>x!==null&&x!==undefined).map(String))]}
function byPhase(bank){const out=new Map();for(const r of bank.rules){if(!out.has(r.phase))out.set(r.phase,[]);out.get(r.phase).push(r)}return out}
function holeTypes(g){
  const kind=g.kind;
  if(kind==='query-language')return ['SYMBOL','SCHEMA_OR_MODEL_REF','EXPRESSION','PREDICATE'];
  if(kind==='hardware-description-language')return ['SIGNAL_OR_PORT','WIDTH_OR_TYPE','CLOCK_OR_DOMAIN','EXPRESSION'];
  if(kind==='template-dsl')return ['VALUE_REF','TEMPLATE_SCOPE','RESOURCE_SHAPE','RENDER_TARGET'];
  if(kind==='build-dsl'||kind==='infrastructure-dsl'||kind==='configuration-language')return ['TARGET_OR_RESOURCE','DEPENDENCY_REF','VALUE','PATH_OR_SELECTOR'];
  if(kind==='pattern-language'||kind==='structural-pattern-dsl')return ['PATTERN_NODE','CAPTURE','PREDICATE','REPLACEMENT'];
  if(kind==='schema-language'||kind==='api-schema')return ['TYPE_OR_SCHEMA','FIELD_OR_MEMBER','REFERENCE','COMPATIBILITY_CASE'];
  return ['SYMBOL','TYPE_OR_SHAPE','EXPRESSION_OR_VALUE','DEPENDENCY_REF'];
}
function typedHoles(g){return holeTypes(g).map((type,i)=>({id:`H${i+1}`,type,required:i<2,source:'CALLER_OR_RENDER_ADAPTER',defaultAuthority:'NONE'}))}
function selectSteps(phaseMap,phases,offset){
  const out=[];
  for(let p=0;p<phases.length;p++){
    const rs=phaseMap.get(phases[p])||[];
    if(!rs.length)continue;
    const r=rs[(offset+p)%rs.length];
    out.push({ruleId:r.id,phase:r.phase,opcode:r.opcode,emits:r.emits,next:r.next});
  }
  return out;
}
function build(languageId){
  const g=grammar.getByLanguageId(languageId),e=eyes.getByLanguageId(languageId),c=cheatcodes.build(languageId);
  if(!g||!e||!c)return null;
  const phaseMap=byPhase(c);
  const holes=typedHoles(g);
  const templates=TEMPLATE_DEFS.map(([name,intent,phases],i)=>{
    const steps=selectSteps(phaseMap,phases,i);
    const nativeBindings=uniq(steps.flatMap(s=>{const r=c.rules.find(x=>x.id===s.ruleId);return r?r.nativeBindings:[]}));
    const body={
      schema:'axm.code.language-machine-template.v1',
      id:`code.template.${languageId}.${name}.v1`,
      lane:'VERIFIED_VAULT',
      templateClass:'MACHINE_RECIPE',
      languageId,
      intent,
      nativeBindings,
      preconditions:{languageIdExact:true,organDigest:g.organDigest,grammarProfileDigest:g.profileSha256,eyeDigest:e.eyeSha256,cheatcodeBankDigest:c.bankSha256},
      holes,
      steps,
      emits:'TEMPLATE_INSTANCE_PLAN',
      falsifiers:uniq(steps.flatMap(s=>{const r=c.rules.find(x=>x.id===s.ruleId);return r?r.falsifiers:[]})),
      verifierCandidates:uniq(e.perspective.verifierInstincts),
      evidence:{level:'MACHINE_RECIPE_GATE_VERIFIED',doesNotClaimSourceCorrectness:true,doesNotClaimRuntimeCorrectness:true},
      use:{normalMachine:'DETERMINISTIC_SELECT_AND_FILL_TYPED_HOLES',ai:'COMPACT_TEMPLATE_CAPSULE_FOR_PROPOSAL_AND_COUNTERCHECK',sourceRenderingWithoutAdapter:'HELD'},
      authority:'NONE'
    };
    return freeze({...body,templateSha256:hash(body)});
  });
  const constructs=uniq(g.grammar.constructs);
  const skeletons=[];
  for(let i=0;i<SKELETON_COUNT;i++){
    const construct=constructs[i%constructs.length]||'UNKNOWN_CONSTRUCT';
    const body={schema:'axm.code.language-structural-skeleton.v1',id:`code.skeleton.${languageId}.${String(i+1).padStart(2,'0')}.v1`,languageId,construct,nativeUnit:g.grammar.compilationOrDocumentUnit,shape:[{role:'ANCHOR',value:construct},{role:'HOLE',id:'H1'},{role:'HOLE',id:'H2'}],holeTypes:holes.slice(0,2),renderPolicy:'NO_SOURCE_EMIT_WITHOUT_LANGUAGE_RENDERER_OR_AI_PROPOSAL',verificationRequired:true,authority:'NONE'};
    skeletons.push(freeze({...body,skeletonSha256:hash(body)}));
  }
  const body={
    schema:'axm.code.language-template-bank.v1',version:'1.0.0',status:'TEST',languageId,organId:g.organId,organDigest:g.organDigest,grammarProfileDigest:g.profileSha256,eyeId:e.eyeId,eyeDigest:e.eyeSha256,cheatcodeBankDigest:c.bankSha256,
    lanes:{
      verifiedVault:{meaning:'Evidence-bound machine recipe templates. Verified refers to template mechanics/evidence binding, not arbitrary generated source correctness.',templateCount:templates.length,templates},
      patternNursery:{meaning:'Frequent structural or edit patterns mined from caller-supplied observations. Candidates never self-promote.',storedCandidates:[],automaticPromotion:false}
    },
    structuralSkeletons:skeletons,
    fastUse:{indexKeys:['languageId','intent','nativeBinding'],deterministicMachineUse:true,aiCapsuleUse:true,sourceRendererOptional:true},
    policy:{frequencyIsNotCorrectness:true,templateIsNotAuthority:true,minedCandidateIsNotVerifiedTemplate:true,automaticPromotion:false,automaticMutation:false,authority:'NONE'},
    authority:AUTHORITY
  };
  return freeze({...body,bankSha256:hash(body)});
}
function all(){return Object.freeze(grammar.all().map(g=>build(g.languageId)))}
function snapshot(){const entries=all().map(b=>({languageId:b.languageId,bankSha256:b.bankSha256,verifiedTemplateCount:b.lanes.verifiedVault.templateCount,skeletonCount:b.structuralSkeletons.length}));const body={schema:'axm.code.language-template-fabric-snapshot.v1',bankCount:entries.length,verifiedTemplateCount:entries.reduce((a,b)=>a+b.verifiedTemplateCount,0),skeletonCount:entries.reduce((a,b)=>a+b.skeletonCount,0),entries,authority:'NONE'};return freeze({...body,snapshotSha256:hash(body)})}
module.exports={TEMPLATE_COUNT,SKELETON_COUNT,build,all,snapshot,AUTHORITY};
