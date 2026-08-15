'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ORGAN_ID = 'axm.mirror.organ/code-clone-renewable-curiosity-frontier-v1';
const PHASES = Object.freeze(['SEARCH', 'OBSERVE_RESULTS', 'NAVIGATE_SOURCE', 'OBSERVE_SOURCE', 'FORGE_ORGAN']);
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'state', 'evidence', 'substrates', 'proposals', 'experimental-curiosity', 'native-agency-heartbeat-sessions', 'native-agency-supervisor-sessions', 'native-curiosity-agency-sessions']);
const SOURCE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.md', '.html', '.css']);
const STOP_WORDS = new Set(['index', 'test', 'tests', 'organ', 'script', 'mirror', 'workshop', 'native', 'clone', 'code', 'with', 'from', 'into', 'this', 'that']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonical(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex'); }
function slash(value) { return String(value).split(path.sep).join('/'); }

function inside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(target);
  const left = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  const right = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
  return left !== right && left.startsWith(right + path.sep);
}

function sourceFiles(root, maximum = 256) {
  const output = [];
  const queue = [path.resolve(root)];
  while (queue.length && output.length < maximum) {
    const current = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)); }
    catch { continue; }
    for (const entry of entries) {
      if (output.length >= maximum) break;
      const absolute = path.join(current, entry.name);
      if (!inside(root, absolute)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) queue.push(absolute);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      let stat;
      try { stat = fs.lstatSync(absolute); } catch { continue; }
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) continue;
      output.push({ absolute, relativePath: slash(path.relative(root, absolute)), bytes: stat.size, modifiedMs: Math.floor(stat.mtimeMs) });
    }
  }
  return output;
}

function sourceSignals(file) {
  let text = '';
  try { text = fs.readFileSync(file.absolute, 'utf8').slice(0, 32768); } catch {}
  const imports = [];
  for (const match of text.matchAll(/(?:require\s*\(\s*|from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
    const value = match[1].replace(/^node:/, '');
    if (/^[A-Za-z0-9@][A-Za-z0-9@._/-]{0,120}$/.test(value) && !value.startsWith('.')) imports.push(value);
  }
  const words = path.basename(file.relativePath, path.extname(file.relativePath)).toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !STOP_WORDS.has(word));
  const questions = [];
  if (/\b(?:TODO|FIXME|UNKNOWN|NEEDS_REVIEW|KNOWN_FAIL)\b/i.test(text)) questions.push('unresolved-state');
  if (/\b(?:browser|fetch|http|url|network)\b/i.test(text)) questions.push('network-observation');
  if (/\b(?:memory|heartbeat|pulse|resource|cpu)\b/i.test(text)) questions.push('resource-behavior');
  if (/\b(?:test|verify|assert|receipt|evidence)\b/i.test(text)) questions.push('verification-pattern');
  return stable({ imports: Array.from(new Set(imports)).sort().slice(0, 8), words: Array.from(new Set(words)).sort().slice(0, 8), questions: Array.from(new Set(questions)).sort(), sourceDigest: sha256(text) });
}

function candidate(rootKind, root, file) {
  const signals = sourceSignals(file);
  const basis = { rootKind, relativePath: file.relativePath, sourceDigest: signals.sourceDigest };
  const candidateId = sha256(basis).slice(0, 16);
  const concepts = Array.from(new Set(signals.imports.concat(signals.questions, signals.words))).slice(0, 10);
  const topic = concepts.length ? concepts.join(' ') : path.basename(file.relativePath, path.extname(file.relativePath));
  return stable({
    candidateId,
    rootKind,
    relativePath: file.relativePath,
    absolutePath: file.absolute,
    sourceDigest: signals.sourceDigest,
    imports: signals.imports,
    concepts,
    question: `What useful pattern or capability connects ${file.relativePath} with ${topic}?`,
    query: `${topic} official documentation source examples`,
    evidence: { bytes: file.bytes, modifiedMs: file.modifiedMs, root: path.resolve(root) }
  });
}

function worldSnapshot(roots) {
  const mirror = sourceFiles(roots.mirrorRoot).map(file => candidate('MIRROR', roots.mirrorRoot, file));
  const workshop = sourceFiles(roots.workshopRoot).map(file => candidate('WORKSHOP', roots.workshopRoot, file));
  const candidates = mirror.concat(workshop).sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const basis = candidates.map(item => ({ candidateId: item.candidateId, rootKind: item.rootKind, relativePath: item.relativePath, sourceDigest: item.sourceDigest }));
  return stable({ schema: 'axm.mirror.code-clone-renewable-curiosity-world/v1', organId: ORGAN_ID, state: candidates.length ? 'FRONTIER_AVAILABLE' : 'NO_BOUNDED_SOURCE_FRONTIER', candidates, worldDigest: sha256(basis), limits: { sourceFilesPerRoot: 256, sourceBytesPerFile: 32768 } });
}

function tags(rows) { return new Set((rows || []).map(row => String(row.planTag || ''))); }
function tag(candidateId, phase) { return `explore-${candidateId}-${phase.toLowerCase().replace(/_/g, '-')}`; }

function currentCandidate(world, rows) {
  const seen = tags(rows);
  const unfinished = world.candidates.find(item => PHASES.some(phase => seen.has(tag(item.candidateId, phase))) && !seen.has(tag(item.candidateId, 'FORGE_ORGAN')) && !seen.has(tag(item.candidateId, 'abandon')));
  if (unfinished) return unfinished;
  return world.candidates.find(item => !seen.has(tag(item.candidateId, 'FORGE_ORGAN')) && !seen.has(tag(item.candidateId, 'abandon'))) || null;
}

function latestConsequence(frame) {
  const refs = frame && frame.frame && Array.isArray(frame.frame.recentOutcomeRefs) ? frame.frame.recentOutcomeRefs : [];
  const row = refs.slice().reverse().find(item => item && item.kind === 'RECENT_AGENCY_OUTCOMES' && item.consequence);
  return row ? row.consequence : null;
}

function observedPage(consequence) {
  const result = consequence && consequence.action === 'BROWSER' && consequence.effect && consequence.effect.result;
  const page = result && result.page;
  if (!page || typeof page !== 'object') return null;
  return stable({
    url: typeof page.url === 'string' ? page.url.slice(0, 8192) : null,
    title: typeof page.title === 'string' ? page.title.slice(0, 500) : '',
    text: typeof page.text === 'string' ? page.text.slice(0, 12000) : '',
    textSha256: typeof page.text === 'string' ? sha256(page.text) : null,
    links: Array.isArray(page.links) ? page.links.slice(0, 32).map(item => ({ text: String(item.text || '').slice(0, 500), href: String(item.href || '').slice(0, 8192) })) : []
  });
}

function usefulSource(page) {
  if (!page) return null;
  const preferred = /^(?:https?):\/\/(?:[^/]+\.)?(?:nodejs\.org|developer\.mozilla\.org|github\.com|docs\.npmjs\.com|npmjs\.com)\//i;
  const valid = (page.links || []).filter(item => /^https?:\/\//i.test(item.href) && !/[?&](?:ad|click|utm_)/i.test(item.href));
  return (valid.find(item => preferred.test(item.href)) || valid[0] || null);
}

function select(frame, roots, rows) {
  const world = worldSnapshot(roots);
  const selected = currentCandidate(world, rows);
  if (!selected) return stable({ state: 'NO_NEW_FRONTIER', world, candidate: null, phase: null, planTag: null, page: null, source: null });
  const seen = tags(rows);
  let phase = PHASES.find(item => !seen.has(tag(selected.candidateId, item)));
  const consequence = latestConsequence(frame);
  const page = observedPage(consequence);
  let source = null;
  if (phase === 'NAVIGATE_SOURCE') {
    source = usefulSource(page);
    if (!source) phase = 'FORGE_ORGAN';
  }
  if (phase === 'FORGE_ORGAN' && !page) phase = 'ABANDON';
  return stable({ state: phase === 'ABANDON' ? 'FRONTIER_OBSERVATION_MISSING' : 'FRONTIER_STEP_SELECTED', world: { ...world, candidates: undefined }, candidate: selected, phase, planTag: tag(selected.candidateId, phase), page, source });
}

module.exports = { ORGAN_ID, PHASES, stable, sha256, sourceFiles, sourceSignals, worldSnapshot, tag, latestConsequence, observedPage, usefulSource, select };
