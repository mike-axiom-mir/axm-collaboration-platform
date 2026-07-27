'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Core = require('./recipe-core');
const Bundle = require('./bundle-ingest');
const Syntax = require('./syntax-audit');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); checks += 1; }

check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product' && manifest.status === 'TEST', 'manifest declares a TEST product');
check(manifest.id === 'code-recipe-foundry' && manifest.entry === 'index.html', 'manifest identity and entry are exact');
check(Array.isArray(manifest.uses) && Array.isArray(manifest.permissions), 'uses and permissions are declared');
check(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
check(contract.boundaries.refuses.includes('snippet-execution') && contract.boundaries.refuses.includes('automatic-network-fetch'), 'execution and fetch boundaries are explicit');
check(contract.boundaries.refuses.includes('popularity-as-correctness-proof') && contract.boundaries.refuses.includes('source-url-as-license-proof'), 'evidence substitutions are refused');
check(contract.boundaries.refuses.includes('review-hold-as-ready') && contract.boundaries.refuses.includes('review-hold-clipboard-copy'), 'review holds cannot masquerade as quick recipes');

const csv = [
  'rank,title,snippet,description,primaryLanguage,domain,tags,sourceUrl,popularityIndicator,popularityScope,familyKey',
  '1,Parse JSON,"const value = JSON.parse(text);",Parse trusted JSON text,JavaScript,web,"json,parse",https://example.com/js-json,ecosystem signal,ecosystem,json_parse',
  '2,Parse JSON,"value = json.loads(text)",Parse trusted JSON text,Python,web,"json,parse",https://example.com/py-json,source signal,source,json_parse',
  '3,Read two lines,"first = read()\nsecond = read()",Quoted multiline CSV works,Python,io,"file|read",https://example.com/read,unknown signal,unknown,read_text_file',
  '4,Parse JSON,"const value = JSON.parse(text);",Exact duplicate,JavaScript,web,json,https://example.com/js-json,ecosystem signal,ecosystem,json_parse',
  '5,Bad URL,"noop()",Rejected URL,Python,test,test,javascript:alert(1),none,unknown,bad_url',
  '6,Seven lines,"1\n2\n3\n4\n5\n6\n7",Too many lines,Text,test,test,https://example.com/long,none,unknown,too_long'
].join('\n');

const result = Core.ingest(csv, { format: 'csv' });
check(result.summary.rawRows === 6 && result.summary.accepted === 3, 'valid rows are accepted and invalid rows are bounded out');
check(result.summary.rejectedRows === 3 && result.summary.exactDuplicates === 1, 'invalid and exact duplicate rows remain counted');
check(result.summary.families === 2 && result.families.find(row => row.familyKey === 'json_parse').languages.length === 2, 'language variants remain in one declared family');
check(result.issues.some(row => row.code === 'SOURCE_URL_INVALID'), 'invalid source URL is visible');
check(result.issues.some(row => row.code === 'SNIPPET_TOO_MANY_LINES'), 'six-line contract is enforced');
check(result.issues.some(row => row.code === 'DUPLICATE_EXACT'), 'exact duplicate is visible');
check(result.recipes.every(row => row.reviewState === 'SOURCE_REVIEW_REQUIRED'), 'structure does not claim source verification');
check(result.recipes.find(row => row.familyKey === 'read_text_file').snippet.split('\n').length === 2, 'quoted multiline snippet survives CSV parsing');

const derived = Core.ingest(JSON.stringify([{rank:1,title:'Map values',snippet:'items.map(fn)',description:'Map items.',primaryLanguage:'JavaScript',tags:['array'],sourceUrl:'https://example.com/map',popularityIndicator:'repository signal'}]), { format: 'json' });
check(derived.summary.accepted === 1 && derived.recipes[0].familyKeySource === 'DERIVED_TITLE', 'missing family key is visibly derived');
check(derived.issues.some(row => row.code === 'FAMILY_KEY_DERIVED') && derived.issues.some(row => row.code === 'POPULARITY_SCOPE_UNKNOWN'), 'derived family and unknown popularity scope are warned');

const longForm = Core.ingest(JSON.stringify([{
  rank: 1, title: 'Long review sample', snippet: '1\n2\n3\n4\n5\n6\n7', description: 'Preserve for review.',
  primaryLanguage: 'Text', tags: ['review'], sourceUrl: 'https://example.com/long-review',
  popularityIndicator: 'Popularity not measured.', popularityScope: 'not-measured',
  rankingBasis: 'EDITORIAL_NOT_POPULARITY_MEASURED', familyKey: 'long_review_sample'
}]), { format: 'json', maxSnippetLines: 20, reviewPolicy: 'LONG_FORM_HOLD' });
check(longForm.summary.accepted === 1 && longForm.summary.held === 1 && longForm.summary.reviewReady === 0, 'explicit long-form policy retains an over-six-line recipe only as a hold');
check(longForm.recipes[0].holdReasons.includes('SNIPPET_OVER_SIX_LINES') && longForm.issues.some(row => row.code === 'SNIPPET_LONG_FORM_HOLD'), 'long-form hold reason remains machine-visible');
throws(() => Core.ingest(JSON.stringify(longForm.recipes), { format: 'json', maxSnippetLines: 20 }), /explicit LONG_FORM_HOLD/, 'a relaxed line limit without the hold policy is refused');

const transformed = Bundle.transformRow({
  id:'CC-TEST', rank:982, category:'Security-Safe Patterns', category_rank:22,
  title:'Use least-privilege database roles', snippet:'REVOKE ALL ON DATABASE app FROM app_user;',
  what_it_does:'Reduces database privileges.', notes_safety:'', difficulty:'Advanced', platform:'PostgreSQL',
  tags:'database,security', version_basis:'PostgreSQL current', source_url:'https://example.com/database-roles',
  research_date:'2026-07-23', verification:'Source review required'
});
const consequential = Core.ingest(JSON.stringify([transformed]), { format:'json', maxSnippetLines:20, reviewPolicy:'LONG_FORM_HOLD' });
check(consequential.summary.held === 1 && consequential.recipes[0].holdReasons.includes('SAFETY_NOTE_MISSING_FOR_CONSEQUENTIAL_COMMAND'), 'a consequential command without a safety note is held visibly');
check(consequential.recipes[0].sourceId === 'CC-TEST' && consequential.recipes[0].rankingBasis === 'EDITORIAL_NOT_POPULARITY_MEASURED', 'bundle transformation preserves source identity and honest editorial ranking');

check(Syntax.parseJavaScript({sourceId:'CC-JS',snippet:'const value = await Promise.resolve(1);'}).status === 'SYNTAX_PASS', 'JavaScript parse-only adapter accepts async-context syntax without execution');
check(Syntax.parseJavaScript({sourceId:'CC-MODULE',snippet:'export const value = 1;'}).status === 'CONTEXT_UNSUPPORTED', 'module fragments remain context-unsupported instead of receiving a false syntax failure');
check(Syntax.parseJavaScript({sourceId:'CC-BAD',snippet:'const = ;'}).status === 'SYNTAX_FAIL', 'JavaScript parse-only adapter reports invalid syntax');
check(Syntax.parseStructuredJson({snippet:'{"safe":true}'}).status === 'SYNTAX_PASS' && Syntax.parseStructuredJson({snippet:'jq . data.json'}).status === 'CONTEXT_UNSUPPORTED', 'mixed data category routes only standalone JSON to JSON.parse');
const syntaxFixture = { schema:'axm.code-recipe-pack/v1', truth:{recipeSetSha256:'fixture'}, recipes:[
  {id:'r1',sourceId:'CC-1001',primaryLanguage:'JavaScript',title:'JS',snippet:'const x = 1;',reviewState:'SOURCE_REVIEW_REQUIRED'},
  {id:'r2',sourceId:'CC-1002',primaryLanguage:'Python',title:'Python',snippet:'x = 1',reviewState:'SOURCE_REVIEW_REQUIRED'},
  {id:'r3',sourceId:'CC-1003',primaryLanguage:'PowerShell',title:'PS',snippet:'$x = 1',reviewState:'SOURCE_REVIEW_REQUIRED'},
  {id:'r4',sourceId:'CC-1004',primaryLanguage:'JSON, jq & YAML',title:'JSON',snippet:'{"x":1}',reviewState:'SOURCE_REVIEW_REQUIRED'},
  {id:'r5',sourceId:'CC-1005',primaryLanguage:'Go',title:'Go',snippet:'x := 1',reviewState:'SOURCE_REVIEW_REQUIRED'},
  {id:'r6',sourceId:'CC-1006',primaryLanguage:'Security-Safe Patterns',title:'Held',snippet:'noop',reviewState:'STRUCTURE_HOLD'},
  {id:'r7',sourceId:'CC-1007',primaryLanguage:'Python',title:'Python CLI',snippet:'python -m pytest',reviewState:'SOURCE_REVIEW_REQUIRED'}
]};
function fixtureBatch(recipes) { return {available:true,value:{version:'fixture',results:recipes.map(recipe=>({sourceId:recipe.sourceId,status:'SYNTAX_PASS',message:'fixture parse only'}))}}; }
const syntaxResult = Syntax.auditPack(syntaxFixture,{generatedAt:'2026-07-24T00:00:00.000Z',parsePythonBatch:fixtureBatch,parsePowerShellBatch:fixtureBatch});
check(syntaxResult.summary.syntaxPass === 4 && syntaxResult.summary.reviewHold === 1 && syntaxResult.summary.notProven === 2, 'syntax audit separates parser passes, holds, CLI context, and unavailable runtimes');
check(syntaxResult.truth.snippetsExecuted === false && syntaxResult.truth.syntaxPassIsRuntimeProof === false, 'syntax audit truth refuses execution and runtime-proof substitution');

const pack = Core.buildPack(result, { label: 'fixture.csv', generatedAt: '2026-07-24T00:00:00.000Z' });
check(pack.schema === 'axm.code-recipe-pack/v1' && pack.recipes.length === 3, 'versioned pack is emitted');
check(pack.truth.snippetsExecuted === false && pack.truth.sourceClaimsVerified === false && pack.truth.canon === false, 'pack preserves truth boundaries');
const roundTrip = Core.ingest(JSON.stringify(pack), { format: 'json' });
check(roundTrip.summary.accepted === 3, 'exported pack can be re-ingested');

const receipt = Core.buildReceipt(result, { label: 'fixture.csv', observedAt: '2026-07-24T00:00:00.000Z' });
check(receipt.schema === 'axm.code-recipe-intake-receipt/v1' && receipt.issues.length === result.issues.length, 'row-level intake receipt is emitted');
check(receipt.boundaries.snippetsExecuted === false && receipt.boundaries.invalidRowsHidden === false, 'receipt makes inert and visible-reject behavior explicit');
check(Core.search(result.recipes, 'json', '', '').length === 2, 'local text search works');
check(Core.search(result.recipes, '', 'Python', 'json_parse').length === 1, 'language and family filters compose');
check(Core.search(consequential.recipes, 'CC-TEST', '', '', 'STRUCTURE_HOLD', 'Advanced').length === 1, 'source-id, hold-state, and difficulty filters compose');
check(Core.stableId('same') === Core.stableId('same') && Core.stableId('same') !== Core.stableId('different'), 'recipe ids are deterministic');
check(Core.stableStringify({b:1,a:2}) === '{"a":2,"b":1}', 'canonical serialization is stable');
check(Core.utf8Length('é') === 2, 'intake size is measured as UTF-8 bytes');

throws(() => Core.parseCsv('a,b\n"open,b'), /unterminated/, 'unterminated CSV quote is refused');
throws(() => Core.parseCsv('a,a\n1,2'), /duplicate header/, 'duplicate CSV headers are refused');
throws(() => Core.parseInput('x', 'xlsx'), /Only CSV and JSON/, 'XLSX is not silently accepted without a real parser');
throws(() => Core.parseInput(JSON.stringify(Array.from({length:5001}, () => ({x:1}))), 'json'), /5,000-row/, 'row bound is enforced');
throws(() => Core.parseInput('é'.repeat(Math.floor(Core.LIMITS.maxBytes / 2) + 1), 'csv'), /5 MiB/, 'multibyte byte bound is enforced');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
check(/<html\b[^>]*\blang=/i.test(html) && /name=["']viewport["']/i.test(html), 'page language and viewport are declared');
check(/:focus-visible/.test(fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8')), 'keyboard focus is visible');
check(html.includes('recipe-core.js') && html.includes('app.js'), 'page loads the inert core before the UI adapter');
check(!/\beval\s*\(|new\s+Function\s*\(/.test(fs.readFileSync(path.join(__dirname, 'recipe-core.js'), 'utf8') + app), 'implementation contains no dynamic code execution');
check(app.includes('textContent') && !app.includes('innerHTML'), 'imported content is rendered as text, not HTML');
check(html.includes('loadInstalledButton') && html.includes('reviewFilter') && html.includes('syntaxFilter') && html.includes('showMoreButton'), 'installed catalog, hold and syntax filtering, and bounded pagination controls are present');
check(app.includes('copy.disabled = held') && app.includes("fetch('catalog/code-cheats-1000.code-recipes.json'") && app.includes("fetch('catalog/code-cheats-1000.syntax-audit.json'"), 'review-hold copy is disabled and catalog plus syntax evidence loads are explicit');
check(JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'code-recipe.schema.json'), 'utf8')).$id === 'axm.code-recipe/v1', 'recipe schema is present');
check(JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'code-recipe-pack.schema.json'), 'utf8')).$id === 'axm.code-recipe-pack/v1', 'pack schema is present');
const installedPack = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog', 'code-cheats-1000.code-recipes.json'), 'utf8'));
const installedReceipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog', 'code-cheats-1000.intake-receipt.json'), 'utf8'));
const installedSyntax = JSON.parse(fs.readFileSync(path.join(__dirname, 'catalog', 'code-cheats-1000.syntax-audit.json'), 'utf8'));
check(installedPack.recipes.length === 1000 && installedPack.summary.reviewReady === 937 && installedPack.summary.held === 63, 'installed catalog pins 1,000 rows as 937 quick recipes plus 63 holds');
check(installedPack.summary.longFormHolds === 62 && installedPack.summary.safetyNoteHolds === 1, 'installed hold classes are counted exactly');
check(installedPack.source.bundleSha256 === '891ca35986b786844266ed89b18271d230c90848a87036098236400d1a1f8d4b' && installedPack.truth.recipeSetSha256 === '008368d22758baa0796262b9520b47e0f330700ed1e7bec5a29d1ed3e6067cd1', 'bundle and canonical recipe-set digests are pinned');
check(installedReceipt.bundleChecks.jsonCsvRowsMatched === 1000 && installedReceipt.bundleChecks.priorNarrativeMatchesBundle === false, 'receipt proves the cross-check and preserves the narrative mismatch');
check(installedSyntax.summary.recipes === 1000 && installedSyntax.summary.syntaxPass === 111 && installedSyntax.summary.syntaxFail === 0 && installedSyntax.summary.reviewHold === 63, 'installed parse-only audit records 111 passes, zero syntax failures, and preserves all 63 holds');
check(installedSyntax.resultSetSha256 === 'b92d3848af55c73daa13e53282197dd6d20e6b6ade9dab79aaec76e2f6f0ade6' && installedSyntax.truth.syntaxPassIsCorrectnessProof === false, 'syntax result-set digest and evidence boundary are pinned');
const installedRoundTrip = Core.ingest(JSON.stringify(installedPack), { format:'json', maxSnippetLines:20, reviewPolicy:'LONG_FORM_HOLD' });
check(installedRoundTrip.summary.accepted === 1000 && installedRoundTrip.summary.held === 63, 'installed catalog revalidates without losing holds');
const intakeHistory = fs.readFileSync(path.join(__dirname, 'WORKSHOP_INTAKE_RECEIPT.md'), 'utf8');
check(intakeHistory.includes('Recovered later') && intakeHistory.includes('111 entries') && intakeHistory.includes('Workshop Search'), 'recovered-bundle intake and safe-integration history remains documented');

console.log('Code Recipe Foundry selftest: PASS - ' + checks + ' checks');
