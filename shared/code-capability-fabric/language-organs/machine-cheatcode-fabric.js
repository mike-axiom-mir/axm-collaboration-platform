'use strict';
const crypto=require('crypto');
const grammar=require('./grammar-profile-registry.js');
const eyes=require('./specialist-eye-registry.js');

const PHASES=Object.freeze(['parse','symbols','dependencies','types-state','control-effects','rewrite-safety','verification','performance-build','debugging','discovery']);
const RULES_PER_PHASE=5;
const RULE_COUNT=PHASES.length*RULES_PER_PHASE;
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});

function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
function arr(v){return Array.isArray(v)?v.filter(x=>x!==null&&x!==undefined&&String(x).length):[]}
function uniq(xs){return [...new Set(arr(xs).map(x=>String(x)))];}
function take(xs,n,fallback){const u=uniq(xs);if(!u.length)u.push(fallback);const out=[];for(let i=0;i<n;i++)out.push(u[i%u.length]);return out}
function norm(v){return String(v).trim().toLowerCase()}
function observationSignals(o){const out=[];for(const [k,v] of Object.entries(o||{})){if(k==='activeLanguages')continue;if(Array.isArray(v))for(const x of v)out.push(norm(x));else if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')out.push(norm(v));}return new Set(out.filter(Boolean))}
function curatedDiscoverySignals(e){const native=new Set([...arr(e.perspective.seesFirst),...arr(e.perspective.semanticHazards),e.perspective.paradigm,e.perspective.nativeUnit].map(norm));return uniq(arr(e.perspective.opportunitySignals).filter(x=>!native.has(norm(x))));}
function verifierSet(g,e){return uniq([...arr(e.perspective.verifierInstincts),...arr(g.verification.focus)]);}

function makeRule(ctx,phase,index,opcode,nativeBindings,trigger,emits,invalidates,next){
  const rank=PHASES.indexOf(phase)*RULES_PER_PHASE+index+1;
  return freeze({
    schema:'axm.code.machine-cheatcode-rule.v1',
    id:`code.cheat.${ctx.languageId}.${phase}.${String(index+1).padStart(2,'0')}`,
    rank,
    phase,
    opcode,
    nativeBindings:uniq(nativeBindings),
    trigger,
    reads:uniq(trigger.reads||[]),
    emits,
    falsifiers:uniq(trigger.falsifiers||[]),
    invalidates:uniq(invalidates),
    verifierCandidates:uniq(ctx.verifiers),
    next,
    mutationAuthority:false,
    authority:'NONE'
  });
}

function build(languageId){
  const g=grammar.getByLanguageId(languageId),e=eyes.getByLanguageId(languageId);
  if(!g||!e)return null;
  const constructs=take(g.grammar.constructs,8,'UNKNOWN_CONSTRUCT');
  const deps=take(g.grammar.dependencyForms,4,'NO_DECLARED_DEPENDENCY_FORM');
  const hazards=take(g.analysis.semanticHazards,5,'UNKNOWN_SEMANTIC_HAZARD');
  const dialects=take(g.grammar.dialectsOrVariants,3,'UNSPECIFIED_DIALECT');
  const verifiers=verifierSet(g,e);
  const discovery=curatedDiscoverySignals(e);
  const ctx={languageId:g.languageId,unit:g.grammar.compilationOrDocumentUnit,paradigm:g.grammar.paradigm,scope:g.grammar.scopeModel,typeModel:g.grammar.typeModel,mutation:g.grammar.mutationModel,control:g.grammar.controlModel,effects:g.grammar.effectModel,constructs,deps,hazards,dialects,verifiers,discovery,organId:g.organId,organDigest:g.organDigest,grammarProfileDigest:g.profileSha256,eyeId:e.eyeId,eyeDigest:e.eyeSha256};
  const r=[];
  const add=(p,i,op,b,t,em,inv,next)=>r.push(makeRule(ctx,p,i,op,b,{...t,reads:arr(t.reads),falsifiers:arr(t.falsifiers)},em,inv,next));

  add('parse',0,'BIND_DIALECT',[...dialects,ctx.unit],{mode:'ACTIVE_OR_NATIVE',nativeSignals:dialects,factCodes:['DIALECT_UNBOUND'],reads:['declaredDialect','activeLanguages'],falsifiers:['DECLARED_DIALECT_NOT_IN_PROFILE']},'DIALECT_BINDING_FACT',['parse-tree','symbol-index','type-facts'],'CACHE_OR_HOLD');
  add('parse',1,'HOLD_ON_PARSE_ERROR',[ctx.unit,constructs[0]],{mode:'ACTIVE_FACT',factCodes:['PARSE_ERROR','ERROR_NODE'],reads:['factCodes'],falsifiers:['CLEAN_REPARSE']},'PARSE_BLOCKER',['all-derived-facts'],'HOLD');
  add('parse',2,'CHECK_NATIVE_UNIT',[ctx.unit],{mode:'ACTIVE_OR_NATIVE',nativeSignals:[ctx.unit],factCodes:['UNIT_BOUNDARY_CHANGED'],reads:['changedUnits','factCodes'],falsifiers:['UNIT_BOUNDARY_UNCHANGED']},'UNIT_BOUNDARY_FACT',['dependency-facts','public-surface-facts'],'CACHE_FACT');
  add('parse',3,'INDEX_NATIVE_CONSTRUCTS',constructs.slice(0,5),{mode:'ACTIVE_OR_NATIVE',nativeSignals:constructs.slice(0,5),factCodes:['CONSTRUCT_CHANGED'],reads:['presentConstructs','changedConstructs'],falsifiers:['CONSTRUCT_NOT_PRESENT']},'STRUCTURAL_CHUNK_FACT',['symbol-index'],'CACHE_FACT');
  add('parse',4,'REFUSE_UNKNOWN_GRAMMAR_NODE',[constructs[5],constructs[6],constructs[7]],{mode:'ACTIVE_FACT',factCodes:['UNKNOWN_GRAMMAR_NODE','RECOVERY_NODE'],reads:['factCodes'],falsifiers:['KNOWN_NODE_AFTER_REPARSE']},'GRAMMAR_UNKNOWN_HOLD',['all-derived-facts'],'HOLD');

  add('symbols',0,'BUILD_DECLARATION_INVENTORY',constructs.slice(0,4),{mode:'ACTIVE_ALWAYS',reads:['presentConstructs'],falsifiers:['DECLARATION_SET_EMPTY']},'SYMBOL_INVENTORY',['symbol-index'],'CACHE_FACT');
  add('symbols',1,'TRACE_UNRESOLVED_SYMBOL',[ctx.scope,constructs[1]],{mode:'ACTIVE_FACT',factCodes:['UNRESOLVED_SYMBOL','UNBOUND_REFERENCE'],reads:['factCodes','symbolSignals'],falsifiers:['REFERENCE_RESOLVED']},'UNRESOLVED_SYMBOL_EDGE',['dependency-facts','impact-facts'],'REQUEST_EVIDENCE');
  add('symbols',2,'SCOPE_CROSSING_REVIEW',[ctx.scope,constructs[2]],{mode:'ACTIVE_FACT',factCodes:['SCOPE_BOUNDARY_CHANGED','CAPTURE_SET_CHANGED'],reads:['factCodes','scopeSignals'],falsifiers:['SCOPE_EQUIVALENT']},'SCOPE_IMPACT_FACT',['symbol-index','type-facts','effect-facts'],'RECHECK_NATIVE_SCOPE');
  add('symbols',3,'PUBLIC_SURFACE_DELTA',[ctx.unit,constructs[3]],{mode:'ACTIVE_FACT',factCodes:['PUBLIC_SURFACE_CHANGED','EXPORT_CHANGED','API_CHANGED'],reads:['factCodes','publicSurfaceSignals'],falsifiers:['PUBLIC_SURFACE_STABLE']},'PUBLIC_SURFACE_DELTA',['dependency-facts','compatibility-facts'],'RUN_VERIFIER_IF_AUTHORIZED');
  add('symbols',4,'AMBIGUOUS_BINDING_REVIEW',[ctx.scope,constructs[4]],{mode:'ACTIVE_FACT',factCodes:['SHADOWING','AMBIGUOUS_BINDING','OVERLOAD_AMBIGUITY'],reads:['factCodes','symbolSignals'],falsifiers:['BINDING_UNIQUE']},'BINDING_AMBIGUITY',['symbol-index','type-facts'],'REQUEST_EVIDENCE');

  add('dependencies',0,'INDEX_NATIVE_DEPENDENCY_FORMS',deps,{mode:'ACTIVE_OR_NATIVE',nativeSignals:deps,factCodes:['DEPENDENCY_CHANGED'],reads:['dependencyForms','dependencySignals'],falsifiers:['DEPENDENCY_SET_STABLE']},'DEPENDENCY_EDGE_FACT',['dependency-facts'],'CACHE_FACT');
  add('dependencies',1,'TRACE_UNRESOLVED_DEPENDENCY',[deps[0],ctx.unit],{mode:'ACTIVE_FACT',factCodes:['UNRESOLVED_DEPENDENCY','MISSING_MODULE','MISSING_SCHEMA_REF'],reads:['factCodes','dependencySignals'],falsifiers:['DEPENDENCY_RESOLVED']},'DEPENDENCY_GAP',['build-facts','impact-facts'],'REQUEST_EVIDENCE');
  add('dependencies',2,'CYCLE_SUSPICION',[deps[1],ctx.unit],{mode:'ACTIVE_FACT',factCodes:['DEPENDENCY_CYCLE','RECURSIVE_REFERENCE'],reads:['factCodes','dependencySignals'],falsifiers:['ACYCLIC_GRAPH']},'CYCLE_CANDIDATE',['dependency-order-facts'],'RUN_GRAPH_CHECK_IF_AUTHORIZED');
  add('dependencies',3,'TRANSITIVE_IMPACT',[deps[2],ctx.unit],{mode:'ACTIVE_FACT',factCodes:['TRANSITIVE_DEPENDENT_CHANGED','CALLER_SET_CHANGED','CONSUMER_SET_CHANGED'],reads:['factCodes','dependencySignals'],falsifiers:['NO_TRANSITIVE_CONSUMERS']},'TRANSITIVE_IMPACT_FACT',['test-selection-facts','compatibility-facts'],'EXPAND_AFFECTED_TESTS');
  add('dependencies',4,'GENERATED_OR_EXTERNAL_BOUNDARY',[deps[3],ctx.effects],{mode:'ACTIVE_FACT',factCodes:['GENERATED_SOURCE','EXTERNAL_CONSUMER','FOREIGN_INTERFACE'],reads:['factCodes','dependencySignals'],falsifiers:['BOUNDARY_NOT_PRESENT']},'BOUNDARY_PROVENANCE_FACT',['rewrite-safety-facts'],'HOLD_CROSS_BOUNDARY_REWRITE');

  add('types-state',0,'TYPE_MODEL_BOUNDARY',[ctx.typeModel,constructs[5]],{mode:'ACTIVE_FACT',factCodes:['TYPE_CHANGED','SCHEMA_CHANGED','REPRESENTATION_CHANGED'],reads:['factCodes','typeSignals'],falsifiers:['TYPE_EQUIVALENT']},'TYPE_MODEL_DELTA',['type-facts','compatibility-facts'],'RUN_TYPE_VERIFIER_IF_AUTHORIZED');
  add('types-state',1,'MUTATION_MODEL_BOUNDARY',[ctx.mutation,constructs[6]],{mode:'ACTIVE_FACT',factCodes:['STATE_WRITE_CHANGED','MUTABILITY_CHANGED','STORAGE_CHANGED'],reads:['factCodes','stateSignals'],falsifiers:['STATE_TRANSITION_EQUIVALENT']},'STATE_MODEL_DELTA',['effect-facts','alias-facts'],'RECOMPUTE_STATE_FACTS');
  add('types-state',2,'ABSENCE_SENTINEL_SEMANTICS',[ctx.typeModel,hazards[0]],{mode:'ACTIVE_FACT',factCodes:['NULL_SEMANTICS','NIL_SEMANTICS','BLANK_SEMANTICS','NA_SEMANTICS','OPTIONALITY_CHANGED'],reads:['factCodes','typeSignals'],falsifiers:['ABSENCE_BEHAVIOR_EQUIVALENT']},'ABSENCE_SEMANTICS_FACT',['branch-facts','query-facts'],'GENERATE_NEGATIVE_FIXTURE');
  add('types-state',3,'WIDENING_OR_COERCION',[ctx.typeModel,hazards[1]],{mode:'ACTIVE_FACT',factCodes:['IMPLICIT_CAST','TYPE_WIDENING','COERCION_CHANGED','PRECISION_CHANGED'],reads:['factCodes','typeSignals'],falsifiers:['NO_COERCION_DELTA']},'COERCION_RISK',['type-facts','value-range-facts'],'RUN_NATIVE_TYPE_CHECK');
  add('types-state',4,'ALIAS_OWNERSHIP_RELATION',[ctx.mutation,hazards[2]],{mode:'ACTIVE_FACT',factCodes:['ALIAS_SET_CHANGED','OWNERSHIP_CHANGED','LIFETIME_CHANGED','REFERENCE_IDENTITY_CHANGED'],reads:['factCodes','stateSignals'],falsifiers:['ALIAS_RELATION_STABLE']},'ALIAS_OWNERSHIP_FACT',['effect-facts','lifetime-facts'],'RECHECK_STATE_INVARIANTS');

  add('control-effects',0,'CONTROL_STRUCTURE_DELTA',[ctx.control,constructs[7]],{mode:'ACTIVE_FACT',factCodes:['CONTROL_FLOW_CHANGED','BRANCH_CHANGED','LOOP_CHANGED','PATTERN_FLOW_CHANGED'],reads:['factCodes','controlSignals'],falsifiers:['CONTROL_EQUIVALENT']},'CONTROL_FLOW_DELTA',['reachability-facts','path-facts'],'RECOMPUTE_CONTROL_FACTS');
  add('control-effects',1,'EFFECT_BOUNDARY_DELTA',[ctx.effects,hazards[3]],{mode:'ACTIVE_FACT',factCodes:['EFFECT_CHANGED','IO_BOUNDARY_CHANGED','FOREIGN_EFFECT_CHANGED','QUERY_EFFECT_CHANGED'],reads:['factCodes','effectSignals'],falsifiers:['EFFECT_SET_STABLE']},'EFFECT_DELTA',['effect-facts','ordering-facts'],'EXPAND_EFFECT_VERIFICATION');
  add('control-effects',2,'CONCURRENCY_TRANSACTION_BOUNDARY',[ctx.control,ctx.effects],{mode:'ACTIVE_FACT',factCodes:['ASYNC_BOUNDARY_CHANGED','CONCURRENCY_CHANGED','TRANSACTION_CHANGED','CLOCK_DOMAIN_CHANGED'],reads:['factCodes','controlSignals','effectSignals'],falsifiers:['CONCURRENCY_OR_TRANSACTION_EQUIVALENT']},'CONCURRENCY_TRANSACTION_RISK',['ordering-facts','race-facts'],'RUN_CONCURRENCY_OR_TRANSACTION_CHECK');
  add('control-effects',3,'ERROR_RESULT_PATH',[ctx.control,hazards[4]],{mode:'ACTIVE_FACT',factCodes:['ERROR_PATH_CHANGED','EXCEPTION_CHANGED','REVERT_CHANGED','RESULT_PATH_CHANGED'],reads:['factCodes','controlSignals'],falsifiers:['ERROR_BEHAVIOR_EQUIVALENT']},'ERROR_PATH_DELTA',['path-facts','cleanup-facts'],'GENERATE_FAILURE_FIXTURE');
  add('control-effects',4,'ORDER_LIFECYCLE_EDGE',[ctx.effects,ctx.unit],{mode:'ACTIVE_FACT',factCodes:['ORDERING_CHANGED','LIFECYCLE_CHANGED','INITIALIZATION_CHANGED','TEARDOWN_CHANGED'],reads:['factCodes','effectSignals'],falsifiers:['ORDERING_EQUIVALENT']},'ORDERING_DELTA',['lifecycle-facts','cache-facts'],'RECHECK_ORDER_SENSITIVE_FACTS');

  for(let i=0;i<5;i++)add('rewrite-safety',i,'SEMANTIC_HAZARD_GUARD',[hazards[i]],{mode:'ACTIVE_OR_NATIVE',nativeSignals:[hazards[i]],factCodes:['HIGH_RISK_TRANSFORM','SEMANTIC_HAZARD'],reads:['semanticSignals','changedConstructs','factCodes'],falsifiers:[`HAZARD_NOT_RELEVANT:${hazards[i]}`]},'REWRITE_HAZARD',['rewrite-safety-facts','semantic-facts'],'HOLD_OR_PROVE_EQUIVALENCE');

  add('verification',0,'REQUIRE_NATIVE_VERIFIER',[verifiers[0]||'NATIVE_VERIFIER'],{mode:'ACTIVE_FACT',factCodes:['VERIFIER_MISSING','VERIFICATION_REQUIRED'],reads:['factCodes','verifierSignals'],falsifiers:['VERIFIER_PASS_PRESENT']},'VERIFICATION_GAP',[],'RUN_CHEAPEST_NATIVE_VERIFIER_IF_AUTHORIZED');
  add('verification',1,'VERIFIER_DISAGREEMENT',[verifiers[1]||verifiers[0]||'SECOND_VERIFIER'],{mode:'ACTIVE_FACT',factCodes:['VERIFIER_DISAGREEMENT','PARSE_COMPILE_DISAGREEMENT'],reads:['factCodes','verifierSignals'],falsifiers:['VERIFIERS_AGREE']},'EVIDENCE_CONFLICT',['verification-summary'],'HOLD_FOR_COUNTERCHECK');
  add('verification',2,'NEGATIVE_FIXTURE_REQUIRED',[hazards[0],hazards[1]],{mode:'ACTIVE_FACT',factCodes:['NEGATIVE_FIXTURE_MISSING','EDGE_CASE_UNTESTED'],reads:['factCodes','testSignals'],falsifiers:['NEGATIVE_FIXTURE_PASS']},'TEST_GAP',[],'GENERATE_BOUNDED_NEGATIVE_FIXTURE');
  add('verification',3,'SYNTAX_PASS_NOT_SEMANTIC_PROOF',[ctx.paradigm,verifiers[0]||'PARSER'],{mode:'ACTIVE_FACT',factCodes:['SYNTAX_ONLY_PASS','STRUCTURAL_ONLY_PASS'],reads:['factCodes','verifierSignals'],falsifiers:['SEMANTIC_OR_RUNTIME_EVIDENCE_PRESENT']},'EVIDENCE_LEVEL_WARNING',[],'REQUEST_STRONGER_EVIDENCE');
  add('verification',4,'CHEAPEST_FALSIFIER_FIRST',verifiers.slice(0,3),{mode:'ACTIVE_ALWAYS',reads:['verifierSignals','factCodes'],falsifiers:['NO_NATIVE_VERIFIER_DECLARED']},'VERIFIER_PRIORITY_FACT',[],'CHOOSE_LOWEST_COST_FALSIFIER');

  add('performance-build',0,'HOT_PATH_SPECIALIZATION',[ctx.paradigm,hazards[0]],{mode:'ACTIVE_FACT',factCodes:['HOT_PATH','PERFORMANCE_REGRESSION','LATENCY_BUDGET'],reads:['factCodes','performanceSignals'],falsifiers:['NOT_HOT_PATH']},'PERFORMANCE_ATTENTION',[],'MEASURE_BEFORE_TRANSFORM');
  add('performance-build',1,'ALLOCATION_COPY_PRESSURE',[ctx.typeModel,ctx.mutation],{mode:'ACTIVE_FACT',factCodes:['ALLOCATION_PRESSURE','COPY_PRESSURE','SERIALIZATION_PRESSURE'],reads:['factCodes','performanceSignals'],falsifiers:['NO_MEASURED_PRESSURE']},'REPRESENTATION_COST_CANDIDATE',[],'MEASURE_REPRESENTATION_COST');
  add('performance-build',2,'BUILD_GRAPH_INVALIDATION',[ctx.unit,deps[0]],{mode:'ACTIVE_FACT',factCodes:['BUILD_GRAPH_CHANGED','CACHE_MISS_SURGE','INCREMENTAL_BUILD_REGRESSION'],reads:['factCodes','buildSignals'],falsifiers:['BUILD_GRAPH_STABLE']},'BUILD_INVALIDATION_FACT',['build-cache-facts'],'RECOMPUTE_ONLY_INVALIDATED_ANALYSES');
  add('performance-build',3,'ANALYSIS_CACHE_INVALIDATION',[ctx.unit,ctx.scope],{mode:'ACTIVE_FACT',factCodes:['ANALYSIS_INVALIDATED','AST_CHANGED','SYMBOL_GRAPH_CHANGED'],reads:['factCodes','buildSignals'],falsifiers:['ANALYSIS_PRESERVED']},'ANALYSIS_INVALIDATION_SET',['cached-analysis'],'DROP_ONLY_INVALID_FACTS');
  add('performance-build',4,'LOWERING_GENERATED_OUTPUT',[ctx.effects,ctx.unit],{mode:'ACTIVE_FACT',factCodes:['LOWERING_CHANGED','GENERATED_OUTPUT_CHANGED','ABI_CHANGED','WIRE_FORMAT_CHANGED'],reads:['factCodes','buildSignals'],falsifiers:['OUTPUT_EQUIVALENT']},'LOWERING_DELTA',['generated-output-facts','compatibility-facts'],'VERIFY_GENERATED_BOUNDARY');

  add('debugging',0,'MINIMIZE_NATIVE_REPRO',[constructs[0],constructs[1],ctx.unit],{mode:'ACTIVE_FACT',factCodes:['BUG_REPRODUCED','FAILURE_PRESENT'],reads:['factCodes','debugSignals'],falsifiers:['FAILURE_NOT_REPRODUCED']},'MINIMIZATION_PLAN',[],'DELTA_DEBUG_NATIVE_UNIT');
  add('debugging',1,'DIALECT_VERSION_DIFFERENTIAL',dialects,{mode:'ACTIVE_FACT',factCodes:['VERSION_SENSITIVE','DIALECT_SENSITIVE','REGRESSION_AFTER_UPGRADE'],reads:['factCodes','debugSignals'],falsifiers:['VERSION_INVARIANT']},'VERSION_DIFFERENTIAL_PLAN',[],'COMPARE_PINNED_DIALECTS');
  add('debugging',2,'DEPENDENCY_ISOLATION',deps,{mode:'ACTIVE_FACT',factCodes:['DEPENDENCY_SUSPECT','INTEGRATION_FAILURE'],reads:['factCodes','debugSignals'],falsifiers:['FAILURE_PERSISTS_WITH_DEPENDENCY_REMOVED']},'DEPENDENCY_ISOLATION_PLAN',[],'ISOLATE_ONE_EDGE_AT_A_TIME');
  add('debugging',3,'STATE_CONTROL_TRACE',[ctx.mutation,ctx.control],{mode:'ACTIVE_FACT',factCodes:['STATE_DIVERGENCE','ORDERING_BUG','CONTROL_DIVERGENCE'],reads:['factCodes','debugSignals'],falsifiers:['TRACE_EQUIVALENT']},'TRACE_PLAN',[],'CAPTURE_MINIMAL_STATE_CONTROL_TRACE');
  add('debugging',4,'COMPETING_HYPOTHESIS',[hazards[0],hazards[1],hazards[2]],{mode:'ACTIVE_FACT',factCodes:['HYPOTHESIS_UNCONFIRMED','MULTIPLE_CAUSES'],reads:['factCodes','debugSignals'],falsifiers:['SINGLE_CAUSE_PROVEN']},'COUNTER_HYPOTHESIS_PLAN',[],'TEST_CHEAPEST_DISCRIMINATOR');

  add('discovery',0,'NATIVE_ABSTRACTION_GAP',[ctx.paradigm,...constructs.slice(0,3)],{mode:'ACTIVE_FACT',factCodes:['REPEATED_WORKAROUND','MISSING_NATIVE_ABSTRACTION','BOILERPLATE_CLUSTER'],reads:['factCodes','gaps','notes'],falsifiers:['NATIVE_ABSTRACTION_ALREADY_USED']},'NATIVE_CAPABILITY_GAP',[],'COMPARE_NATIVE_ABSTRACTION');
  add('discovery',1,'CROSS_LANGUAGE_OPPORTUNITY',discovery.length?discovery:[ctx.paradigm],{mode:'INACTIVE_NATIVE',nativeSignals:discovery.length?discovery:[ctx.paradigm],reads:['goals','capabilities','gaps','risks','constraints','notes','activeLanguages'],falsifiers:['NO_DOMAIN_SIGNAL_MATCH']},'CROSS_LANGUAGE_CANDIDATE',[],'DISCOVER_AND_COMPARE_ONLY');
  add('discovery',2,'WORKAROUND_PRESSURE',[ctx.paradigm,ctx.unit],{mode:'ACTIVE_FACT',factCodes:['REPEATED_WORKAROUND','ADAPTER_CHAIN_GROWING','ESCAPE_HATCH_REPEAT'],reads:['factCodes','gaps','notes'],falsifiers:['WORKAROUND_IS_INTENTIONAL_AND_BOUNDED']},'GRAMMAR_FIT_QUESTION',[],'COMPARE_ALTERNATIVE_GRAMMAR');
  add('discovery',3,'VERIFIER_AS_CAPABILITY',[...verifiers.slice(0,2),ctx.paradigm],{mode:'ACTIVE_FACT',factCodes:['VERIFIER_MISSING','UNCHECKED_INVARIANT'],reads:['factCodes','gaps','verifierSignals'],falsifiers:['EQUIVALENT_VERIFIER_PRESENT']},'VERIFIER_DISCOVERY_CANDIDATE',[],'DISCOVER_VERIFIER_WITHOUT_INSTALLING');
  add('discovery',4,'ALTERNATIVE_BEFORE_LOCK_IN',[...discovery.slice(0,3),ctx.paradigm],{mode:'INACTIVE_NATIVE',nativeSignals:discovery.length?discovery.slice(0,3):[ctx.paradigm],reads:['goals','requirements','constraints','activeLanguages'],falsifiers:['CURRENT_GRAMMAR_EXPLICITLY_REQUIRED']},'ALTERNATIVE_COMPARISON_CANDIDATE',[],'COMPARE_BEFORE_ARCHITECTURE_LOCK');

  if(r.length!==RULE_COUNT)throw Error(`CHEATCODE_RULE_COUNT_INVALID:${languageId}:${r.length}`);
  const body={schema:'axm.code.language-machine-cheatcode-bank.v1',version:'1.0.0',status:'TEST',languageId:g.languageId,organId:g.organId,organDigest:g.organDigest,grammarProfileDigest:g.profileSha256,eyeId:e.eyeId,eyeDigest:e.eyeSha256,ruleCount:r.length,phaseCount:PHASES.length,rules:r,truth:{semanticCorrectnessClaimed:false,runtimeCorrectnessClaimed:false,automaticAction:false,authority:'NONE'},authority:AUTHORITY};
  return freeze({...body,bankSha256:hash(canon(body))});
}

function all(){return freeze(eyes.all().map(e=>build(e.languageId)));}
function snapshot(){const banks=all().map(b=>({languageId:b.languageId,bankSha256:b.bankSha256,ruleCount:b.ruleCount}));const body={schema:'axm.code.machine-cheatcode-fabric-snapshot.v1',bankCount:banks.length,totalRuleCount:banks.reduce((n,b)=>n+b.ruleCount,0),banks};return freeze({...body,snapshotSha256:hash(canon(body))});}
function matchRule(rule,languageId,observation){const active=new Set(arr(observation.activeLanguages).map(norm)),isActive=active.has(norm(languageId)),facts=new Set(arr(observation.factCodes).map(x=>String(x).toUpperCase())),signals=observationSignals(observation),native=arr(rule.trigger.nativeSignals).map(norm),nativeHit=native.some(x=>signals.has(x)),factHit=arr(rule.trigger.factCodes).some(x=>facts.has(String(x).toUpperCase()));switch(rule.trigger.mode){case'ACTIVE_ALWAYS':return isActive;case'ACTIVE_FACT':return isActive&&factHit;case'ACTIVE_OR_NATIVE':return isActive&&(factHit||nativeHit||!native.length);case'INACTIVE_NATIVE':return !isActive&&nativeHit;default:return false;}}
function evaluate({languageId,observation={}}={}){const bank=build(languageId);if(!bank)return{result:'UNKNOWN_LANGUAGE_CHEATCODE_BANK',languageId:languageId||null};const matches=bank.rules.filter(r=>matchRule(r,languageId,observation)).map(r=>({ruleId:r.id,rank:r.rank,phase:r.phase,opcode:r.opcode,emits:r.emits,next:r.next,nativeBindings:r.nativeBindings,verifierCandidates:r.verifierCandidates,authority:'NONE'}));return freeze({schema:'axm.code.machine-cheatcode-evaluation.v1',result:'CHEATCODE_EVALUATION_READY_NO_ACTION',languageId,bankSha256:bank.bankSha256,matchCount:matches.length,matches,authority:AUTHORITY});}
function challenge(observation={}){const active=new Set(arr(observation.activeLanguages).map(norm));const reports=[];for(const e of eyes.all()){const out=evaluate({languageId:e.languageId,observation});if(out.matchCount)reports.push({languageId:e.languageId,active:active.has(norm(e.languageId)),bankSha256:out.bankSha256,matchCount:out.matchCount,matches:out.matches});}reports.sort((a,b)=>Number(b.active)-Number(a.active)||b.matchCount-a.matchCount||a.languageId.localeCompare(b.languageId));return freeze({schema:'axm.code.machine-cheatcode-challenge-report.v1',result:'CHALLENGE_REPORT_READY_NO_ACTION',bankCount:102,totalRuleUniverse:5100,matchedLanguageCount:reports.length,reports,authority:AUTHORITY});}

module.exports={PHASES,RULE_COUNT,build,all,snapshot,evaluate,challenge};
