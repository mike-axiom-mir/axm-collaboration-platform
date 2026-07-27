#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Core = require('./recipe-core');

const SCHEMA = 'axm.code-recipe-syntax-audit/v1';
const PACK_FILE = path.join(__dirname, 'catalog', 'code-cheats-1000.code-recipes.json');
const OUTPUT_FILE = path.join(__dirname, 'catalog', 'code-cheats-1000.syntax-audit.json');

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function cleanMessage(value) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300); }

function nodeVersion() { return process.version; }

function parseJavaScript(recipe) {
  if (/^\s*(?:import|export)\b/m.test(recipe.snippet)) {
    return { status:'CONTEXT_UNSUPPORTED', verifier:'NODE_VM_ASYNC_FUNCTION_PARSE', message:'Module import/export fragments need a real module fixture; function-context parsing would be misleading.' };
  }
  try {
    new vm.Script('(async function axmRecipeSyntaxOnly(){\n' + recipe.snippet + '\n})', { filename:recipe.sourceId + '.js' });
    return { status:'SYNTAX_PASS', verifier:'NODE_VM_ASYNC_FUNCTION_PARSE', message:'Parsed inside an uncalled async function; snippet was not executed.' };
  } catch (error) {
    return { status:'SYNTAX_FAIL', verifier:'NODE_VM_ASYNC_FUNCTION_PARSE', message:cleanMessage(error && error.message) };
  }
}

function runJsonParser(command, args, input) {
  const run = childProcess.spawnSync(command, args, {
    cwd:__dirname, input:JSON.stringify(input), encoding:'utf8', windowsHide:true,
    maxBuffer:4 * 1024 * 1024, timeout:30000
  });
  if (run.error || run.status !== 0) return { available:false, error:cleanMessage(run.error && run.error.message || run.stderr || run.stdout) };
  try { return { available:true, value:JSON.parse(run.stdout) }; }
  catch (error) { return { available:false, error:'parser adapter returned invalid JSON: ' + cleanMessage(error.message) }; }
}

function parsePythonBatch(recipes) {
  const script = [
    'import ast, json, sys',
    'rows=json.load(sys.stdin)',
    'out=[]',
    'for row in rows:',
    '  try:',
    '    ast.parse(row["snippet"], filename=row["sourceId"]+".py", mode="exec")',
    '    out.append({"sourceId":row["sourceId"],"status":"SYNTAX_PASS","message":"Python AST parsed; snippet was not executed."})',
    '  except SyntaxError as exc:',
    '    out.append({"sourceId":row["sourceId"],"status":"SYNTAX_FAIL","message":str(exc)[:300]})',
    'print(json.dumps({"version":sys.version.split()[0],"results":out}))'
  ].join('\n');
  return runJsonParser('python', ['-I', '-c', script], recipes.map(recipe => ({ sourceId:recipe.sourceId, snippet:recipe.snippet })));
}

function parsePowerShellBatch(recipes) {
  const script = [
    "$ErrorActionPreference='Stop'",
    "[Console]::OutputEncoding=[Text.Encoding]::UTF8",
    '$rows=([Console]::In.ReadToEnd()|ConvertFrom-Json)',
    '$out=@()',
    'foreach($row in $rows){',
    '  $tokens=$null;$errors=$null',
    '  [void][Management.Automation.Language.Parser]::ParseInput([string]$row.snippet,[ref]$tokens,[ref]$errors)',
    "  if($errors.Count -eq 0){$out += [ordered]@{sourceId=[string]$row.sourceId;status='SYNTAX_PASS';message='PowerShell AST parsed; snippet was not executed.'}}",
    "  else{$message=([string]$errors[0].Message);if($message.Length -gt 300){$message=$message.Substring(0,300)};$out += [ordered]@{sourceId=[string]$row.sourceId;status='SYNTAX_FAIL';message=$message}}",
    '}',
    "[ordered]@{version=[string]$PSVersionTable.PSVersion;results=$out}|ConvertTo-Json -Depth 5 -Compress"
  ].join('\n');
  return runJsonParser('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], recipes.map(recipe => ({ sourceId:recipe.sourceId, snippet:recipe.snippet })));
}

function parseStructuredJson(recipe) {
  try {
    JSON.parse(recipe.snippet);
    return { status:'SYNTAX_PASS', verifier:'JSON_PARSE', message:'Parsed as JSON data; no command or expression was executed.' };
  } catch (_) {
    return { status:'CONTEXT_UNSUPPORTED', verifier:'MIXED_JSON_JQ_YAML_ROUTER', message:'This mixed category entry is not standalone JSON; jq and YAML parsers are unavailable.' };
  }
}

function resultRow(recipe, result) {
  return {
    sourceId:recipe.sourceId, recipeId:recipe.id, category:recipe.primaryLanguage, title:recipe.title,
    reviewState:recipe.reviewState, status:result.status, verifier:result.verifier, message:cleanMessage(result.message)
  };
}

function auditPack(pack, options) {
  options = options || {};
  if (!pack || pack.schema !== 'axm.code-recipe-pack/v1' || !Array.isArray(pack.recipes)) throw new Error('axm.code-recipe-pack/v1 is required');
  if (pack.recipes.length > 5000) throw new Error('syntax audit is bounded to 5,000 recipes');
  const recipes = pack.recipes, results = [], byId = new Map();
  const eligible = recipes.filter(recipe => recipe.reviewState !== 'STRUCTURE_HOLD');

  const pythonCli = eligible.filter(recipe => recipe.primaryLanguage === 'Python' && /^\s*python(?:\.exe)?\s+-m\b/i.test(recipe.snippet));
  const pythonCliIds = new Set(pythonCli.map(recipe => recipe.sourceId));
  const python = (options.parsePythonBatch || parsePythonBatch)(eligible.filter(recipe => recipe.primaryLanguage === 'Python' && !pythonCliIds.has(recipe.sourceId)));
  const powershell = (options.parsePowerShellBatch || parsePowerShellBatch)(eligible.filter(recipe => recipe.primaryLanguage === 'PowerShell'));
  if (python.available) python.value.results.forEach(row => byId.set(row.sourceId, { status:row.status, verifier:'PYTHON_AST_PARSE', message:row.message }));
  if (powershell.available) powershell.value.results.forEach(row => byId.set(row.sourceId, { status:row.status, verifier:'POWERSHELL_AST_PARSE', message:row.message }));

  recipes.forEach(recipe => {
    let result;
    if (recipe.reviewState === 'STRUCTURE_HOLD') result = { status:'REVIEW_HOLD', verifier:'NOT_RUN', message:'Existing structural hold takes precedence over syntax screening.' };
    else if (recipe.primaryLanguage === 'JavaScript') result = parseJavaScript(recipe);
    else if (recipe.primaryLanguage === 'Python' && pythonCliIds.has(recipe.sourceId)) result = { status:'CONTEXT_UNSUPPORTED', verifier:'PYTHON_CLI_NOT_AST', message:'This Python-category entry is a command-line invocation, not Python source code; it was not executed.' };
    else if (recipe.primaryLanguage === 'Python') result = byId.get(recipe.sourceId) || { status:'VERIFIER_UNAVAILABLE', verifier:'PYTHON_AST_PARSE', message:python.error || 'Python parser unavailable.' };
    else if (recipe.primaryLanguage === 'PowerShell') result = byId.get(recipe.sourceId) || { status:'VERIFIER_UNAVAILABLE', verifier:'POWERSHELL_AST_PARSE', message:powershell.error || 'PowerShell parser unavailable.' };
    else if (recipe.primaryLanguage === 'JSON, jq & YAML') result = parseStructuredJson(recipe);
    else result = { status:'VERIFIER_UNAVAILABLE', verifier:'NOT_AVAILABLE_FOR_CATEGORY', message:'No non-executing native parser is available for this category on the current host.' };
    results.push(resultRow(recipe, result));
  });

  const statuses = results.reduce((out, row) => { out[row.status] = Number(out[row.status] || 0) + 1; return out; }, {});
  const generatedAt = options.generatedAt || new Date().toISOString();
  const report = {
    schema:SCHEMA, generatedAt,
    source:{ packPath:'catalog/code-cheats-1000.code-recipes.json', packSha256:sha256(Core.stableStringify(pack)), recipeSetSha256:pack.truth && pack.truth.recipeSetSha256 || null },
    host:{ node:nodeVersion(), python:python.available ? python.value.version : null, powershell:powershell.available ? powershell.value.version : null },
    summary:{ recipes:recipes.length, statuses, syntaxPass:Number(statuses.SYNTAX_PASS || 0), syntaxFail:Number(statuses.SYNTAX_FAIL || 0), reviewHold:Number(statuses.REVIEW_HOLD || 0), notProven:Number(statuses.CONTEXT_UNSUPPORTED || 0) + Number(statuses.VERIFIER_UNAVAILABLE || 0) },
    results,
    truth:{ snippetsExecuted:false, parseOnly:true, syntaxPassIsRuntimeProof:false, syntaxPassIsCorrectnessProof:false, syntaxPassIsSafetyProof:false, unsupportedCategoriesRemainUnverified:true, reviewHoldsPreserved:true, automaticPromotion:false, canon:false }
  };
  report.resultSetSha256 = sha256(Core.stableStringify(report.results));
  return report;
}

function main() {
  const write = process.argv.includes('--write');
  const pack = JSON.parse(fs.readFileSync(PACK_FILE, 'utf8'));
  const report = auditPack(pack);
  if (write) fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ schema:SCHEMA, mode:write ? 'WRITE' : 'DRY_RUN', output:write ? path.relative(__dirname, OUTPUT_FILE).replace(/\\/g, '/') : null, summary:report.summary, host:report.host, resultSetSha256:report.resultSetSha256 }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { SCHEMA, PACK_FILE, OUTPUT_FILE, parseJavaScript, parsePythonBatch, parsePowerShellBatch, parseStructuredJson, auditPack };
