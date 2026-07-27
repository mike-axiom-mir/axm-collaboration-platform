'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const TEXT_EXTENSIONS = new Set(['.js','.cjs','.mjs','.html','.css','.json','.txt','.md','.ps1','.bat','.cmd','.sh','.yml','.yaml','.xml','.csv','.tsv']);
const ROOTS = ['tools','shared','hub','launcher','docs','projects','prompts','assets','worlds','mobile','museum','pocket','skins'];
const ROOT_FILES = ['README.md','START_HERE.txt','package.json','verify.config.json','TRUST_CHARTER.txt','TEMPLATE_SEAMS.txt'];
const DENIED_NAMES = /(?:^|[-_.])(secret|token|credential|private[-_]?key|\.env)(?:$|[-_.])/i;
const CODE_RECIPE_PACK_REL = 'tools/code-recipe-foundry/catalog/code-cheats-1000.code-recipes.json';
const CODE_RECIPE_AUDIT_REL = 'tools/code-recipe-foundry/catalog/code-cheats-1000.syntax-audit.json';

function boundedText(value, max) { return String(value == null ? '' : value).replace(/\0/g, ' ').slice(0, max); }

function codeRecipeEntries(root) {
  const packFile = path.join(root, ...CODE_RECIPE_PACK_REL.split('/'));
  if (!fs.existsSync(packFile)) return { status:'ABSENT', entries:[], packPath:CODE_RECIPE_PACK_REL, reason:null };
  const stat = fs.statSync(packFile);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('code-recipe pack exceeds the structured-provider boundary');
  const pack = JSON.parse(fs.readFileSync(packFile, 'utf8'));
  if (!pack || pack.schema !== 'axm.code-recipe-pack/v1' || !Array.isArray(pack.recipes) || !pack.recipes.length || pack.recipes.length > 5000) throw new Error('code-recipe pack contract is invalid');
  const packSha256 = U.fileSha256(packFile), seen = new Set();
  const auditFile = path.join(root, ...CODE_RECIPE_AUDIT_REL.split('/'));
  let syntaxBySourceId = new Map(), auditSha256 = null;
  if (fs.existsSync(auditFile) && fs.statSync(auditFile).isFile() && fs.statSync(auditFile).size <= 5 * 1024 * 1024) {
    const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    if (audit && audit.schema === 'axm.code-recipe-syntax-audit/v1' && Array.isArray(audit.results)) {
      audit.results.slice(0, 5000).forEach(row => { if (row && row.sourceId) syntaxBySourceId.set(String(row.sourceId), String(row.status || 'UNKNOWN')); });
      auditSha256 = U.fileSha256(auditFile);
    }
  }
  const entries = pack.recipes.map((recipe, index) => {
    const sourceId = boundedText(recipe && recipe.sourceId, 80);
    if (!/^CC-\d{4}$/.test(sourceId) || seen.has(sourceId)) throw new Error('code-recipe source identity is invalid or duplicated at row ' + (index + 1));
    seen.add(sourceId);
    const reviewState = recipe.reviewState === 'STRUCTURE_HOLD' ? 'STRUCTURE_HOLD' : 'SOURCE_REVIEW_REQUIRED';
    const fields = [sourceId, recipe.title, recipe.description, recipe.primaryLanguage, recipe.domain, recipe.familyKey, recipe.difficulty, recipe.platform]
      .concat(Array.isArray(recipe.tags) ? recipe.tags : [])
      .concat(recipe.notesSafety || []);
    if (reviewState === 'STRUCTURE_HOLD') fields.push('REVIEW HOLD', ...(Array.isArray(recipe.holdReasons) ? recipe.holdReasons : []));
    else fields.push(recipe.snippet);
    const serialized = JSON.stringify(recipe), syntaxStatus = syntaxBySourceId.get(sourceId) || 'NOT_AUDITED';
    return {
      path:'tools/code-recipe-foundry/recipes/' + sourceId, name:sourceId + '.code-recipe', extension:'.code-recipe',
      bytes:Buffer.byteLength(serialized), modifiedAt:stat.mtime.toISOString(), sha256:U.sha256(serialized), kind:'structured-code-recipe',
      content:boundedText(fields.join('\n'), 12000), title:boundedText(recipe.title, 180),
      provider:'code-recipe-foundry', sourceId, reviewState, syntaxStatus,
      parentPath:CODE_RECIPE_PACK_REL, parentSha256:packSha256, auditPath:auditSha256 ? CODE_RECIPE_AUDIT_REL : null, auditSha256
    };
  });
  return { status:'INDEXED', entries, packPath:CODE_RECIPE_PACK_REL, packSha256, auditPath:auditSha256 ? CODE_RECIPE_AUDIT_REL : null, auditSha256, reason:null };
}

function create(options) {
  const root = options.root, stateDir = path.join(options.stateRoot, 'workshop-search'), indexFile = path.join(stateDir, 'index.json');
  let memory = null, building = false;
  function entryFor(file, relative) {
    const ext = path.extname(file).toLowerCase(), stat = fs.statSync(file), item = { path: relative.replace(/\\/g, '/'), name: path.basename(file), extension: ext, bytes: stat.size, modifiedAt: stat.mtime.toISOString(), sha256: U.fileSha256(file), kind: TEXT_EXTENSIONS.has(ext) ? 'text' : 'binary', content: '' };
    if (item.kind === 'text' && stat.size <= 512 * 1024 && !DENIED_NAMES.test(item.name)) {
      const text = fs.readFileSync(file, 'utf8').replace(/\0/g, ' '); item.content = text.slice(0, 512 * 1024);
      const first = item.content.split(/\r?\n/).find(line => line.trim()); item.title = first ? first.replace(/^\s*[#/*=-]+\s*/, '').slice(0, 180) : item.name;
    } else item.title = item.name;
    return item;
  }
  function build() {
    if (building) throw new Error('search index is already building'); building = true;
    try {
      const entries = [];
      for (const relRoot of ROOTS) {
        const base = path.join(root, relRoot); if (!fs.existsSync(base)) continue;
        const scan = U.walk(base, { maxFiles: 15000, maxBytes: 500 * 1024 * 1024, excludedNames: ['node_modules','.git','exports','backups','logs','state','.restore-tests'] });
        for (const file of scan.files) if (!DENIED_NAMES.test(file.relative)) {
          const relative = relRoot + '/' + file.relative, entry = entryFor(file.absolute, relative);
          if (relative === CODE_RECIPE_PACK_REL || relative === CODE_RECIPE_AUDIT_REL) { entry.content = ''; entry.title = entry.name; }
          entries.push(entry);
        }
      }
      for (const rel of ROOT_FILES) { const file = path.join(root, rel); if (fs.existsSync(file) && fs.statSync(file).isFile()) entries.push(entryFor(file, rel)); }
      let codeRecipes;
      try { codeRecipes = codeRecipeEntries(root); entries.push(...codeRecipes.entries); }
      catch (error) { codeRecipes = { status:'HELD', entries:[], packPath:CODE_RECIPE_PACK_REL, reason:String(error.message || error).slice(0, 300) }; }
      memory = { schema: 'axm.workshop-search-index/v1', builtAt: U.now(), entryCount: entries.length, roots: ROOTS.slice(), structuredProviders:{ codeRecipes:Object.assign({}, codeRecipes, { entries:undefined, entryCount:codeRecipes.entries.length }) }, boundaries: { privateStateExcluded: true, logsExcluded: true, backupsExcluded: true, bridgeExcluded: true, maxTextBytesPerFile: 512 * 1024, structuredCodeRecipesExecute:false, heldRecipeSnippetIndexed:false }, entries };
      U.atomicJson(indexFile, memory); return summary();
    } finally { building = false; }
  }
  function index() { if (memory) return memory; memory = U.loadJson(indexFile, null); if (!memory || memory.schema !== 'axm.workshop-search-index/v1') build(); return memory; }
  function snippet(content, token) { const lower = content.toLowerCase(), at = lower.indexOf(token); if (at < 0) return ''; const start = Math.max(0, at - 100), end = Math.min(content.length, at + token.length + 180); return content.slice(start, end).replace(/\s+/g, ' ').trim(); }
  function search(query, opts) {
    query = String(query || '').trim().slice(0, 200); if (!query) return { query, total: 0, results: [] };
    const tokens = Array.from(new Set((query.toLowerCase().match(/[a-z0-9_-]{2,}/g) || []))).slice(0, 10); if (!tokens.length) return { query, total: 0, results: [] };
    const limit = Math.max(1, Math.min(100, Number(opts && opts.limit) || 30)), prefix = String(opts && opts.prefix || '').replace(/\\/g, '/');
    const results = [];
    for (const item of index().entries) {
      if (prefix && !item.path.startsWith(prefix)) continue;
      const name = (item.name + ' ' + item.path + ' ' + (item.title || '')).toLowerCase(), content = String(item.content || '').toLowerCase(); let score = 0, matched = [];
      for (const token of tokens) { if (name.includes(token)) { score += item.name.toLowerCase().includes(token) ? 8 : 4; matched.push(token); } if (content.includes(token)) { score += 1 + Math.min(5, content.split(token).length - 1); matched.push(token); } }
      if (score) results.push({ path: item.path, name: item.name, title: item.title, kind: item.kind, extension: item.extension, bytes: item.bytes, modifiedAt: item.modifiedAt, sha256: item.sha256, score, matched: Array.from(new Set(matched)), snippet: item.content ? snippet(item.content, matched[0] || tokens[0]) : '', provider:item.provider || null, sourceId:item.sourceId || null, reviewState:item.reviewState || null, syntaxStatus:item.syntaxStatus || null, parentPath:item.parentPath || null, parentSha256:item.parentSha256 || null, auditPath:item.auditPath || null, auditSha256:item.auditSha256 || null });
    }
    results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)); return { query, total: results.length, results: results.slice(0, limit), indexBuiltAt: index().builtAt };
  }
  function summary() { const value = index(); return { builtAt: value.builtAt, entryCount: value.entryCount, roots: value.roots, building, boundaries: value.boundaries, structuredProviders:value.structuredProviders || {} }; }
  return { build, search, summary, indexFile };
}

module.exports = { TEXT_EXTENSIONS, ROOTS, CODE_RECIPE_PACK_REL, CODE_RECIPE_AUDIT_REL, codeRecipeEntries, create };
