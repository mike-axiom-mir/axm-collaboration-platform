'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('./recipe-evidence-bridge-v1');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }

const recipes = [
  {
    id:'recipe-1111111111111111', sourceId:'CC-001', title:'Parse JSON safely', snippet:'const value = JSON.parse(text);',
    description:'Parse JSON text into a value.', primaryLanguage:'JavaScript', domain:'data', tags:['json','parse'],
    sourceUrl:'https://example.com/json', popularityIndicator:'editorial', popularityScope:'not-measured', rankingBasis:'EDITORIAL_NOT_POPULARITY_MEASURED',
    familyKey:'parse_json', familyKeySource:'DECLARED', reviewState:'SOURCE_REVIEW_REQUIRED', holdReasons:[], notesSafety:'Parse data only.', difficulty:'Beginner', platform:'Node.js', versionBasis:'ECMAScript current'
  },
  {
    id:'recipe-2222222222222222', sourceId:'CC-002', title:'Parse JSON in Python', snippet:'value = json.loads(text)',
    description:'Parse JSON text with Python.', primaryLanguage:'Python', domain:'data', tags:['json','parse'],
    sourceUrl:'https://example.com/py-json', popularityIndicator:'editorial', popularityScope:'not-measured', rankingBasis:'EDITORIAL_NOT_POPULARITY_MEASURED',
    familyKey:'parse_json', familyKeySource:'DECLARED', reviewState:'STRUCTURE_VALIDATED', holdReasons:[], notesSafety:'Parse trusted-size text.', difficulty:'Beginner', platform:'CPython', versionBasis:'Python 3'
  },
  {
    id:'recipe-3333333333333333', sourceId:'CC-003', title:'Dangerous cleanup example', snippet:'rm -rf /',
    description:'Held destructive example.', primaryLanguage:'Shell', domain:'filesystem', tags:['cleanup'],
    sourceUrl:'https://example.com/held', popularityIndicator:'editorial', popularityScope:'not-measured', rankingBasis:'EDITORIAL_NOT_POPULARITY_MEASURED',
    familyKey:'cleanup', familyKeySource:'DECLARED', reviewState:'STRUCTURE_HOLD', holdReasons:['CONSEQUENTIAL_COMMAND'], notesSafety:null, difficulty:'Advanced', platform:'POSIX', versionBasis:'unknown'
  }
];
const pack = {
  schema:'axm.code-recipe-pack/v1', generatedAt:'2026-08-23T00:00:00Z', source:{label:'fixture'}, summary:{}, recipes, families:[],
  truth:{recipeSetSha256:'fixture-set', sourceClaimsVerified:false, canon:false, snippetsExecuted:false}
};
const audit = {schema:'axm.code-recipe-syntax-audit/v1', results:[
  {sourceId:'CC-001', recipeId:'recipe-1111111111111111', status:'SYNTAX_PASS', verifier:'node-parse-only', message:'Parsed in synthetic context.'},
  {sourceId:'CC-002', recipeId:'recipe-2222222222222222', status:'NOT_PROVEN', verifier:null, message:'Runtime unavailable.'}
]};

const packet = Bridge.buildEvidencePacket(pack, {terms:'parse json', maxResults:8}, {syntaxAudit:audit, generatedAt:'2026-08-23T10:00:00Z'});
check(packet.schema === 'axm.code-recipe-evidence-packet/v1' && packet.status === 'EVIDENCE_ONLY', 'packet schema and evidence-only state are explicit');
check(packet.summary.eligibleMatches === 2 && packet.candidates.length === 2, 'two non-held parse-json recipes are returned');
check(packet.candidates[0].match.popularityUsedForScoring === false && packet.candidates[0].match.semanticInferenceUsed === false, 'matching is mechanical and not popularity/semantic inference');
check(packet.candidates.some(row => row.recipe.syntaxEvidence.status === 'SYNTAX_PASS'), 'identity-bound parse-only syntax evidence can be attached');
check(packet.boundaries.syntaxPassIsCorrectnessProof === false && packet.boundaries.recipeIsProvider === false, 'syntax and provider truth boundaries are explicit');
check(packet.candidates.every(row => row.recipe.snippetRef.bytesIncluded === false), 'snippet bytes are omitted from candidate records');
check(!JSON.stringify(packet).includes('const value = JSON.parse(text);'), 'quick-recipe code is not copied into the evidence packet');
check(Bridge.verifyPacket(packet).pass, 'packet digest verifies');
const replay = Bridge.buildEvidencePacket(pack, {terms:'parse json', maxResults:8}, {syntaxAudit:audit, generatedAt:'2026-08-23T10:00:00Z'});
check(replay.packetSha256 === packet.packetSha256, 'same explicit inputs replay to the same packet digest');

const held = Bridge.buildEvidencePacket(pack, {terms:'dangerous cleanup'}, {generatedAt:'2026-08-23T10:00:00Z'});
check(held.candidates.length === 0 && held.heldMatches.length === 1, 'held recipes remain visible but cannot enter candidates');
check(!JSON.stringify(held).includes('rm -rf /'), 'held code is not copied into the packet');
check(held.heldMatches[0].recipe.holdReasons.includes('CONSEQUENTIAL_COMMAND'), 'hold reasons remain visible');

const pythonOnly = Bridge.buildEvidencePacket(pack, {tags:['json','parse'], languages:['Python']}, {generatedAt:'2026-08-23T10:00:00Z'});
check(pythonOnly.candidates.length === 1 && pythonOnly.candidates[0].recipe.primaryLanguage === 'Python', 'language and tag filters compose exactly');
check(pythonOnly.candidates[0].recipe.evidenceClass === 'STRUCTURE_VALIDATED_SOURCE_UNPROVEN', 'structural validation does not become source verification');

throws(() => Bridge.buildEvidencePacket(pack, {}, {}), /criterion/, 'empty broad scans are refused');
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json', maxResults:33}, {}), /between 1 and 32/, 'result bound is enforced');
throws(() => Bridge.buildEvidencePacket({...pack, schema:'wrong'}, {terms:'json'}, {}), /axm.code-recipe-pack\/v1/, 'wrong pack schema is refused');
throws(() => Bridge.buildEvidencePacket(pack, {terms:7}, {}), /terms must be a string/, 'terms are not silently coerced');
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json', maxResults:'4'}, {}), /integer/, 'explicit invalid result bounds are not silently defaulted');
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json', surprise:true}, {}), /Unknown query field/, 'unknown query fields are refused');
throws(() => Bridge.buildEvidencePacket(pack, {tags:[{}]}, {}), /must be a string/, 'non-string filters are refused');
throws(() => Bridge.buildEvidencePacket(pack, {tags:['---']}, {}), /empty value/, 'filters that normalize to empty are refused');

const duplicatePack = JSON.parse(JSON.stringify(pack));
duplicatePack.recipes.push(JSON.parse(JSON.stringify(pack.recipes[0])));
throws(() => Bridge.buildEvidencePacket(duplicatePack, {terms:'json'}, {}), /duplicate recipe id/, 'duplicate recipe identities are refused');
const malformedPack = JSON.parse(JSON.stringify(pack));
delete malformedPack.recipes[0].title;
throws(() => Bridge.buildEvidencePacket(malformedPack, {terms:'json'}, {}), /\.title must be a string/, 'malformed recipe records fail closed instead of disappearing');
const duplicateAudit = {schema:'axm.code-recipe-syntax-audit/v1', results:[audit.results[0], audit.results[0]]};
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json'}, {syntaxAudit:duplicateAudit}), /duplicate recipeId/, 'ambiguous duplicate syntax identities are refused');
const mismatchedAudit = {schema:'axm.code-recipe-syntax-audit/v1', results:[{sourceId:'CC-001', recipeId:'recipe-2222222222222222', status:'SYNTAX_PASS'}]};
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json'}, {syntaxAudit:mismatchedAudit}), /identity conflict|recipeId mismatch/, 'syntax evidence cannot cross recipe identities');
throws(() => Bridge.buildEvidencePacket(pack, {terms:'json'}, {syntaxAudit:{schema:'wrong', results:[]}}), /Syntax audit must use/, 'wrong syntax-audit schema is refused');

const source = fs.readFileSync(path.join(__dirname, 'recipe-evidence-bridge-v1.js'), 'utf8');
check(!/\beval\s*\(|new\s+Function\s*\(/.test(source), 'bridge contains no dynamic code execution');
check(!/child_process|\bexec\s*\(|\bspawn\s*\(/.test(source), 'bridge contains no process execution path');
check(!/\bfetch\s*\(|https\.request|http\.request/.test(source), 'bridge contains no network fetch path');

const installedPath = path.join(__dirname, '..', '..', 'tools', 'code-recipe-foundry', 'catalog', 'code-cheats-1000.code-recipes.json');
const installedAuditPath = path.join(__dirname, '..', '..', 'tools', 'code-recipe-foundry', 'catalog', 'code-cheats-1000.syntax-audit.json');
if (fs.existsSync(installedPath)) {
  const installedPack = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
  const installedAudit = fs.existsSync(installedAuditPath) ? JSON.parse(fs.readFileSync(installedAuditPath, 'utf8')) : null;
  check(installedPack.recipes.length === 1000, 'repository integration fixture is the installed 1,000-recipe pack');
  const probeTitle = installedPack.recipes[0] && installedPack.recipes[0].title;
  check(Boolean(probeTitle), 'installed catalog exposes a title for deterministic probe selection');
  const installedPacket = Bridge.buildEvidencePacket(installedPack, {terms:probeTitle, maxResults:4}, {syntaxAudit:installedAudit, generatedAt:'2026-08-23T10:00:00Z'});
  check(installedPacket.summary.recipesScanned === 1000, 'bridge validates and scans the complete installed catalog');
  check(installedPacket.summary.eligibleMatches + installedPacket.summary.heldMatches >= 1, 'installed-catalog probe returns visible evidence or a visible hold');
  check(installedPacket.candidates.every(row => row.recipe.snippetRef.bytesIncluded === false) && installedPacket.heldMatches.every(row => row.recipe.snippetRef.bytesIncluded === false), 'installed-catalog evidence never copies snippet bytes');
}

console.log('Recipe evidence bridge v1: PASS (' + checks + ' checks)');
