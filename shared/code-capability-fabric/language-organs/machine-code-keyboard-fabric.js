'use strict';
const crypto=require('crypto');
const registry=require('./registry.js');
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});
const VERSION='1.0.0';
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(canon(v)).digest('hex')}
function key(id,actionId,category,opcode,argumentSchema,nativeBindings=[],extra={}){return{keyId:id,actionId,category,opcode,argumentSchema,nativeBindings:[...nativeBindings],availability:extra.availability||'AVAILABLE_INTENT_ONLY',requiresRenderer:extra.requiresRenderer!==false,invalidates:extra.invalidates||[],verificationHints:extra.verificationHints||[],sourceCode:null,authority:'NONE'}}
function constructSlot(i,profile){const binding=(profile.grammar.constructs||[])[i]||null;return key(`K${String(4+i).padStart(2,'0')}`,`insert-native-construct-${String(i+1).padStart(2,'0')}`,'STRUCTURE','INSERT_NATIVE_CONSTRUCT',{fields:['targetRef','arguments']},binding?[binding]:[],{availability:binding?'AVAILABLE_INTENT_ONLY':'DISABLED_NO_NATIVE_BINDING',invalidates:['parse','symbols','dependencies','types-state','control-effects']})}
function dependencySlot(i,profile){const binding=(profile.grammar.dependencyForms||[])[i]||null;return key(`K${String(12+i).padStart(2,'0')}`,`insert-native-dependency-${String(i+1).padStart(2,'0')}`,'DEPENDENCY','INSERT_NATIVE_DEPENDENCY',{fields:['targetRef','dependencyRef','arguments']},binding?[binding]:[],{availability:binding?'AVAILABLE_INTENT_ONLY':'DISABLED_NO_NATIVE_BINDING',invalidates:['dependencies','impact','verification']})}
function buildBank(languageId){
 const organ=registry.getByLanguageId(languageId),profile=registry.grammarProfile(languageId);if(!organ||!profile)return null;
 const keys=[];
 keys.push(key('K01','create-native-unit','STRUCTURE','CREATE_NATIVE_UNIT',{fields:['unitName','targetRef']},[profile.grammar.compilationOrDocumentUnit],{invalidates:['parse','symbols','dependencies','architecture']}));
 keys.push(key('K02','enter-scope','STRUCTURE','ENTER_SCOPE',{fields:['targetRef']},[profile.grammar.scopeModel],{invalidates:['symbols','scope']}));
 keys.push(key('K03','leave-scope','STRUCTURE','LEAVE_SCOPE',{fields:['targetRef']},[profile.grammar.scopeModel],{invalidates:['symbols','scope']}));
 for(let i=0;i<8;i++)keys.push(constructSlot(i,profile));
 for(let i=0;i<3;i++)keys.push(dependencySlot(i,profile));
 keys.push(key('K15','remove-dependency','DEPENDENCY','REMOVE_DEPENDENCY',{fields:['targetRef','dependencyRef']},profile.grammar.dependencyForms||[],{invalidates:['dependencies','impact','verification']}));
 keys.push(key('K16','declare-symbol','SYMBOL','DECLARE_SYMBOL',{fields:['targetRef','symbol','kind']},profile.analysis.symbolInventory||[],{invalidates:['symbols','dependencies','types-state']}));
 keys.push(key('K17','reference-symbol','SYMBOL','REFERENCE_SYMBOL',{fields:['targetRef','symbol']},profile.analysis.symbolInventory||[],{invalidates:['symbols','dependencies']}));
 keys.push(key('K18','rename-symbol','SYMBOL','RENAME_SYMBOL',{fields:['targetRef','symbol','newSymbol']},[],{invalidates:['symbols','dependencies','api','tests']}));
 keys.push(key('K19','move-symbol','SYMBOL','MOVE_SYMBOL',{fields:['targetRef','destinationRef']},[profile.grammar.scopeModel],{invalidates:['symbols','dependencies','architecture','tests']}));
 keys.push(key('K20','bind-type-or-shape','TYPE_STATE','BIND_TYPE_OR_SHAPE',{fields:['targetRef','typeOrShape']},[profile.grammar.typeModel],{invalidates:['types-state','api','verification']}));
 keys.push(key('K21','bind-value','TYPE_STATE','BIND_VALUE',{fields:['targetRef','valueRef']},[profile.grammar.typeModel],{invalidates:['types-state','control-effects']}));
 keys.push(key('K22','add-state','TYPE_STATE','ADD_STATE',{fields:['targetRef','stateName','initialValue']},[profile.grammar.mutationModel],{invalidates:['types-state','control-effects','tests']}));
 keys.push(key('K23','mutate-state','TYPE_STATE','MUTATE_STATE',{fields:['targetRef','stateRef','valueRef']},[profile.grammar.mutationModel],{invalidates:['types-state','control-effects','tests']}));
 keys.push(key('K24','add-branch','CONTROL','ADD_BRANCH',{fields:['targetRef','conditionRef']},[profile.grammar.controlModel],{invalidates:['control-effects','tests']}));
 keys.push(key('K25','add-loop','CONTROL','ADD_LOOP',{fields:['targetRef','conditionOrIterator']},[profile.grammar.controlModel],{invalidates:['control-effects','performance','tests']}));
 keys.push(key('K26','add-call','CONTROL','ADD_CALL',{fields:['targetRef','calleeRef','arguments']},[profile.grammar.controlModel],{invalidates:['dependencies','control-effects','tests']}));
 keys.push(key('K27','add-return-result','CONTROL','ADD_RETURN_RESULT',{fields:['targetRef','valueRef']},[profile.grammar.controlModel],{invalidates:['control-effects','api','tests']}));
 keys.push(key('K28','add-error-path','CONTROL','ADD_ERROR_PATH',{fields:['targetRef','errorRef','handling']},[profile.grammar.controlModel],{invalidates:['control-effects','tests']}));
 keys.push(key('K29','add-effect-boundary','EFFECT','ADD_EFFECT_BOUNDARY',{fields:['targetRef','effectRef']},[profile.grammar.effectModel],{invalidates:['control-effects','architecture','tests']}));
 keys.push(key('K30','bind-route-boundary','INTEROP','BIND_ROUTE_BOUNDARY',{fields:['targetRef','routeClass','contractRef']},[],{invalidates:['dependencies','architecture','verification']}));
 keys.push(key('K31','bind-schema-contract','INTEROP','BIND_SCHEMA_OR_CONTRACT',{fields:['targetRef','schemaRef']},[],{invalidates:['api','dependencies','verification']}));
 keys.push(key('K32','bind-resource','INTEROP','BIND_RESOURCE',{fields:['targetRef','resourceRef','binding']},[],{invalidates:['dependencies','control-effects','verification']}));
 keys.push(key('K33','apply-verified-template','TEMPLATE','APPLY_VERIFIED_TEMPLATE',{fields:['templateId','bindings','targetRef']},[],{invalidates:['parse','symbols','dependencies','types-state','control-effects','verification']}));
 keys.push(key('K34','instantiate-template','TEMPLATE','INSTANTIATE_TEMPLATE',{fields:['templateId','bindings']},[],{invalidates:['parse','symbols','dependencies','verification']}));
 keys.push(key('K35','extract-unit','REFACTOR','EXTRACT_UNIT',{fields:['targetRef','newUnitName']},[profile.grammar.compilationOrDocumentUnit],{invalidates:['symbols','dependencies','architecture','tests']}));
 keys.push(key('K36','inline-unit','REFACTOR','INLINE_UNIT',{fields:['targetRef']},[],{invalidates:['symbols','dependencies','control-effects','tests']}));
 keys.push(key('K37','wrap-node','REFACTOR','WRAP_NODE',{fields:['targetRef','wrapperKind']},profile.grammar.constructs||[],{invalidates:['parse','symbols','control-effects']}));
 keys.push(key('K38','replace-node','REFACTOR','REPLACE_NODE',{fields:['targetRef','replacementIntent']},[],{invalidates:['parse','symbols','dependencies','types-state','control-effects','tests']}));
 keys.push(key('K39','remove-node','REFACTOR','REMOVE_NODE',{fields:['targetRef']},[],{invalidates:['parse','symbols','dependencies','types-state','control-effects','tests']}));
 keys.push(key('K40','add-assertion','VERIFY','ADD_ASSERTION',{fields:['targetRef','predicateRef']},profile.verification.focus||[],{verificationHints:profile.verification.focus||[]}));
 keys.push(key('K41','add-negative-case','VERIFY','ADD_NEGATIVE_CASE',{fields:['targetRef','caseRef']},profile.verification.focus||[],{verificationHints:profile.verification.focus||[]}));
 keys.push(key('K42','add-fixture','VERIFY','ADD_FIXTURE',{fields:['fixtureRef','targetRef']},profile.verification.focus||[],{verificationHints:profile.verification.focus||[]}));
 keys.push(key('K43','request-native-validation','VERIFY','REQUEST_NATIVE_VALIDATION',{fields:['candidateRef']},profile.verification.focus||[],{requiresRenderer:false,verificationHints:profile.verification.focus||[]}));
 keys.push(key('K44','request-static-analysis','VERIFY','REQUEST_STATIC_ANALYSIS',{fields:['candidateRef']},profile.verification.focus||[],{requiresRenderer:false,verificationHints:profile.verification.focus||[]}));
 keys.push(key('K45','request-tests','VERIFY','REQUEST_TESTS',{fields:['candidateRef','testScope']},profile.verification.focus||[],{requiresRenderer:false,verificationHints:profile.verification.focus||[]}));
 keys.push(key('K46','trace-symbol-dependency','INSPECT','TRACE_SYMBOL_DEPENDENCY',{fields:['targetRef','symbolOrDependency']},[...(profile.analysis.dependencyAnchors||[]),...(profile.analysis.symbolInventory||[])],{requiresRenderer:false}));
 keys.push(key('K47','request-admission','GOVERNANCE','REQUEST_ADMISSION',{fields:['candidateDigest','mode']},profile.verification.focus||[],{requiresRenderer:false,verificationHints:profile.verification.focus||[]}));
 keys.push(key('K48','hold-mark-unknown','GOVERNANCE','HOLD_MARK_UNKNOWN',{fields:['reason','targetRef']},profile.analysis.semanticHazards||[],{requiresRenderer:false}));
 if(keys.length!==48)throw Error(`MACHINE_KEYBOARD_KEY_COUNT:${languageId}:${keys.length}`);
 const core={schema:'axm.code.machine-keyboard-bank.v1',version:VERSION,status:'TEST',languageId:organ.languageId,organId:organ.organId,organDigest:organ.sha256,grammarProfileDigest:profile.profileSha256,family:organ.family,kind:organ.kind,nativePalette:{compilationOrDocumentUnit:profile.grammar.compilationOrDocumentUnit,constructs:[...profile.grammar.constructs],dependencyForms:[...profile.grammar.dependencyForms],scopeModel:profile.grammar.scopeModel,typeModel:profile.grammar.typeModel,mutationModel:profile.grammar.mutationModel,controlModel:profile.grammar.controlModel,effectModel:profile.grammar.effectModel,semanticHazards:[...profile.analysis.semanticHazards],verifierCandidates:[...profile.verification.focus]},keys,truth:{semanticKeyboardNotTextKeyboard:true,keyAvailabilityIsNotRendererProof:true,keyPressIsEditIntentNotSource:true,sourceRendererRequiredForSourceMutations:true,admissionRequiredAfterRendering:true},authority:AUTHORITY};return{...core,keyboardSha256:hash(core)}}
function all(){return registry.all().map(o=>buildBank(o.languageId))}
function snapshot(){const banks=all().map(b=>({languageId:b.languageId,keyboardSha256:b.keyboardSha256,keyCount:b.keys.length}));const body={schema:'axm.code.machine-keyboard-snapshot.v1',version:VERSION,bankCount:banks.length,keysPerBank:48,totalStableKeyCount:banks.length*48,banks,authority:'NONE'};return{...body,snapshotSha256:hash(body)}}
module.exports={VERSION,buildBank,all,snapshot,canon,hash};
