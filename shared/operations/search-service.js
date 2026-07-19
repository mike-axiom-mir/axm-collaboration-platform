'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');

const TEXT_EXTENSIONS = new Set(['.js','.cjs','.mjs','.html','.css','.json','.txt','.md','.ps1','.bat','.cmd','.sh','.yml','.yaml','.xml','.csv','.tsv']);
const ROOTS = ['tools','shared','hub','launcher','docs','projects','prompts','assets','worlds','mobile','museum','pocket','skins'];
const ROOT_FILES = ['README.md','START_HERE.txt','package.json','verify.config.json','TRUST_CHARTER.txt','TEMPLATE_SEAMS.txt'];
const DENIED_NAMES = /(?:^|[-_.])(secret|token|credential|private[-_]?key|\.env)(?:$|[-_.])/i;

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
        for (const file of scan.files) if (!DENIED_NAMES.test(file.relative)) entries.push(entryFor(file.absolute, relRoot + '/' + file.relative));
      }
      for (const rel of ROOT_FILES) { const file = path.join(root, rel); if (fs.existsSync(file) && fs.statSync(file).isFile()) entries.push(entryFor(file, rel)); }
      memory = { schema: 'axm.workshop-search-index/v1', builtAt: U.now(), entryCount: entries.length, roots: ROOTS.slice(), boundaries: { privateStateExcluded: true, logsExcluded: true, backupsExcluded: true, bridgeExcluded: true, maxTextBytesPerFile: 512 * 1024 }, entries };
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
      if (score) results.push({ path: item.path, name: item.name, title: item.title, kind: item.kind, extension: item.extension, bytes: item.bytes, modifiedAt: item.modifiedAt, sha256: item.sha256, score, matched: Array.from(new Set(matched)), snippet: item.content ? snippet(item.content, matched[0] || tokens[0]) : '' });
    }
    results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)); return { query, total: results.length, results: results.slice(0, limit), indexBuiltAt: index().builtAt };
  }
  function summary() { const value = index(); return { builtAt: value.builtAt, entryCount: value.entryCount, roots: value.roots, building, boundaries: value.boundaries }; }
  return { build, search, summary, indexFile };
}

module.exports = { TEXT_EXTENSIONS, ROOTS, create };

