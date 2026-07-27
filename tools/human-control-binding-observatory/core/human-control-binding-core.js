'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'axm.human-control-binding-map/v1';
const REVIEW_SCHEMA = 'axm.human-control-binding-review-request/v1';
const GRAPH_SCHEMA = 'axm.entry-resource-graph/v1';
const CONTAINER_TAGS = new Set(['button', 'a', 'select', 'textarea', 'summary', 'details', 'form']);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function plainText(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function maskNonMarkupRegions(html) {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, block => block.replace(/[^\r\n]/g, ' '))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, block => block.replace(/[^\r\n]/g, ' '));
}

function parseAttributes(raw) {
  const attrs = {};
  const pattern = /([:@A-Za-z_][:@A-Za-z0-9_.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(raw))) {
    attrs[match[1].toLowerCase()] = match[2] === undefined
      ? (match[3] === undefined ? (match[4] === undefined ? true : match[4]) : match[3])
      : match[2];
  }
  return attrs;
}

function controlName(tag, attrs, innerText) {
  const candidates = [
    attrs['aria-label'],
    tag === 'input' ? attrs.value : null,
    innerText,
    attrs.placeholder,
    attrs.title,
    attrs.name
  ];
  const selected = candidates.find(value => typeof value === 'string' && value.trim());
  return selected ? selected.trim() : null;
}

function nativeAction(tag, attrs) {
  if (tag === 'a' && typeof attrs.href === 'string' && attrs.href.trim() && attrs.href.trim() !== '#') {
    return 'NATIVE_LINK_DESTINATION_DECLARED';
  }
  if (tag === 'form' && typeof attrs.action === 'string' && attrs.action.trim()) return 'NATIVE_FORM_ACTION_DECLARED';
  if (tag === 'input' && ['submit', 'reset'].includes(String(attrs.type || '').toLowerCase())) return 'NATIVE_INPUT_ACTION';
  if (tag === 'details' || tag === 'summary') return 'NATIVE_DISCLOSURE_ACTION';
  return null;
}

function inlineBindings(attrs) {
  return Object.keys(attrs).filter(name => /^on[a-z]+$/.test(name)).sort();
}

function parseControls(html, entryPath) {
  const sourceText = maskNonMarkupRegions(html);
  const controls = [];
  const container = /<(button|a|select|textarea|summary|details|form)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  let match;
  while ((match = container.exec(sourceText))) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2]);
    const innerText = plainText(match[3]);
    controls.push({
      tag,
      id: typeof attrs.id === 'string' ? attrs.id : null,
      name: typeof attrs.name === 'string' ? attrs.name : null,
      type: typeof attrs.type === 'string' ? attrs.type.toLowerCase() : null,
      accessibleNameObservation: controlName(tag, attrs, innerText),
      inlineBindings: inlineBindings(attrs),
      nativeAction: nativeAction(tag, attrs),
      disabledDeclared: Object.prototype.hasOwnProperty.call(attrs, 'disabled'),
      hiddenDeclared: Object.prototype.hasOwnProperty.call(attrs, 'hidden') || String(attrs['aria-hidden']).toLowerCase() === 'true',
      hrefDeclared: tag === 'a' && typeof attrs.href === 'string' ? attrs.href : null,
      entryPath,
      line: lineAt(sourceText, match.index)
    });
  }
  const input = /<input\b([^>]*)>/gi;
  while ((match = input.exec(sourceText))) {
    const attrs = parseAttributes(match[1]);
    controls.push({
      tag: 'input',
      id: typeof attrs.id === 'string' ? attrs.id : null,
      name: typeof attrs.name === 'string' ? attrs.name : null,
      type: typeof attrs.type === 'string' ? attrs.type.toLowerCase() : 'text',
      accessibleNameObservation: controlName('input', attrs, null),
      inlineBindings: inlineBindings(attrs),
      nativeAction: nativeAction('input', attrs),
      disabledDeclared: Object.prototype.hasOwnProperty.call(attrs, 'disabled'),
      hiddenDeclared: Object.prototype.hasOwnProperty.call(attrs, 'hidden') || String(attrs['aria-hidden']).toLowerCase() === 'true' || String(attrs.type).toLowerCase() === 'hidden',
      hrefDeclared: null,
      entryPath,
      line: lineAt(sourceText, match.index)
    });
  }
  return controls.sort((left, right) => left.line - right.line || left.tag.localeCompare(right.tag));
}

function duplicateIds(html, entryPath) {
  const sourceText = maskNonMarkupRegions(html);
  const byId = new Map();
  const pattern = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/gi;
  let match;
  while ((match = pattern.exec(sourceText))) {
    const id = match[1] === undefined ? (match[2] === undefined ? match[3] : match[2]) : match[1];
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ entryPath, line: lineAt(sourceText, match.index) });
  }
  return Array.from(byId.entries()).filter(([, locations]) => locations.length > 1).map(([id, locations]) => ({ id, locations }));
}

function escapePattern(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function staticEvidenceFor(control, sources) {
  const evidence = [];
  if (control.inlineBindings.length) {
    evidence.push({ kind: 'INLINE_HANDLER_DECLARED', detail: control.inlineBindings.join(', '), path: control.entryPath, line: control.line });
  }
  if (control.nativeAction) {
    evidence.push({ kind: control.nativeAction, detail: control.hrefDeclared || control.type || control.tag, path: control.entryPath, line: control.line });
  }
  if (!control.id) return evidence;
  const escaped = escapePattern(control.id);
  const selectors = [
    new RegExp("getElementById\\s*\\(\\s*([\"'])" + escaped + '\\1\\s*\\)', 'g'),
    new RegExp("querySelector\\s*\\(\\s*([\"'])#" + escaped + '\\1\\s*\\)', 'g')
  ];
  for (const source of sources) {
    for (const selector of selectors) {
      selector.lastIndex = 0;
      let match;
      while ((match = selector.exec(source.text))) {
        const tail = source.text.slice(selector.lastIndex, selector.lastIndex + 320);
        const statementTail = tail.split(';', 1)[0];
        const before = source.text.slice(Math.max(0, match.index - 90), match.index);
        let kind = 'SELECTOR_REFERENCE_ONLY';
        if (/^[\s\S]{0,220}\.\s*addEventListener\s*\(/.test(statementTail)) kind = 'STATIC_EVENT_BINDING_EVIDENCE';
        else if (/^[\s\S]{0,180}\.\s*on[a-z]+\s*=/.test(statementTail)) kind = 'STATIC_HANDLER_ASSIGNMENT_EVIDENCE';
        else if (/\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*$/.test(before)) kind = 'SELECTOR_REFERENCE_ONLY';
        evidence.push({ kind, detail: match[0], path: source.path, line: lineAt(source.text, match.index) });
      }
    }
  }
  const unique = new Map();
  for (const item of evidence) unique.set([item.kind, item.path, item.line, item.detail].join('|'), item);
  return Array.from(unique.values()).sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
}

function bindingState(control, evidence) {
  if (control.disabledDeclared || control.hiddenDeclared) return 'DECLARED_NON_INTERACTIVE_STATE';
  if (evidence.some(item => ['INLINE_HANDLER_DECLARED', 'STATIC_EVENT_BINDING_EVIDENCE', 'STATIC_HANDLER_ASSIGNMENT_EVIDENCE'].includes(item.kind))) {
    return 'STATIC_BINDING_EVIDENCE';
  }
  if (evidence.some(item => item.kind.startsWith('NATIVE_'))) return 'NATIVE_SEMANTIC_ACTION';
  if (evidence.some(item => item.kind === 'SELECTOR_REFERENCE_ONLY')) return 'SELECTOR_REFERENCE_ONLY';
  if (!control.id) return 'NO_ID_FOR_STATIC_MATCH';
  return 'NO_STATIC_BINDING_EVIDENCE';
}

function sourceOwner(relativePath, folders) {
  const parts = String(relativePath).split('/');
  return parts[0] === 'tools' && parts.length > 2 && folders.has(parts[1]) ? folders.get(parts[1]) : null;
}

function collectUniqueSources(graph) {
  const folders = new Map((graph.modules || []).map(module => [module.folder, module.id]));
  const byPath = new Map();
  for (const module of graph.modules || []) {
    for (const node of module.nodes || []) {
      if (!node.bodyRead || !['HTML', 'JAVASCRIPT'].includes(node.kind)) continue;
      if (!byPath.has(node.path)) {
        byPath.set(node.path, {
          path: node.path,
          kind: node.kind,
          bytes: node.bytes,
          sha256: node.sha256,
          sourceOwner: sourceOwner(node.path, folders),
          consumingModules: []
        });
      }
      byPath.get(node.path).consumingModules.push(module.id);
    }
  }
  return Array.from(byPath.values()).map(source => Object.assign(source, {
    consumingModules: Array.from(new Set(source.consumingModules)).sort()
  })).sort((left, right) => left.path.localeCompare(right.path));
}

function readGraphSource(root, source) {
  const absolute = path.resolve(root, source.path);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(prefix)) return { state: 'UNSAFE_GRAPH_PATH', text: null };
  if (!fs.existsSync(absolute)) return { state: 'SOURCE_MISSING_AFTER_GRAPH', text: null };
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) return { state: 'SOURCE_TYPE_DRIFT', text: null };
  const bytes = fs.readFileSync(absolute);
  const observedSha256 = sha256(bytes);
  if (observedSha256 !== source.sha256) return { state: 'SOURCE_HASH_DRIFT', text: null, observedSha256, bytes: bytes.length };
  return { state: 'VERIFIED_GRAPH_SOURCE', text: bytes.toString('utf8'), bytes: bytes.length };
}

function analyzeWorkshop(rootInput, graph, options = {}) {
  if (!graph || graph.schema !== GRAPH_SCHEMA) throw new Error('human control analysis requires an ' + GRAPH_SCHEMA + ' graph');
  const root = path.resolve(rootInput || process.cwd());
  const uniqueSources = collectUniqueSources(graph);
  const loadedByPath = new Map();
  const sourceReceipts = [];
  const readIssues = [];
  for (const source of uniqueSources) {
    const loaded = readGraphSource(root, source);
    sourceReceipts.push({
      path: source.path,
      graphSha256: source.sha256,
      state: loaded.state,
      observedSha256: loaded.observedSha256 || source.sha256,
      bytes: loaded.bytes === undefined ? source.bytes : loaded.bytes
    });
    if (!loaded.text) readIssues.push({ path: source.path, code: loaded.state });
    else loadedByPath.set(source.path, Object.assign({}, source, { text: loaded.text }));
  }

  const modules = [];
  for (const module of graph.modules || []) {
    const entryPath = module.entry && module.entry.state === 'PRESENT_HTML'
      ? (module.nodes || []).find(node => node.kind === 'HTML' && node.depth === 0 && node.bodyRead && node.sha256 === module.entry.sha256)?.path
      : null;
    if (!entryPath || !loadedByPath.has(entryPath)) {
      modules.push({
        id: module.id,
        folder: module.folder,
        entryPath,
        state: 'ENTRY_HTML_NOT_AVAILABLE',
        controls: [],
        duplicateIds: [],
        summary: { controls: 0, staticBindings: 0, nativeActions: 0, selectorOnly: 0, noStaticBindingEvidence: 0, unnamed: 0, duplicateIds: 0 }
      });
      continue;
    }
    const entry = loadedByPath.get(entryPath);
    const relevantSources = (module.nodes || [])
      .map(node => loadedByPath.get(node.path))
      .filter(Boolean)
      .filter((source, index, array) => array.findIndex(item => item.path === source.path) === index);
    const controls = parseControls(entry.text, entryPath).map((control, index) => {
      const evidence = staticEvidenceFor(control, relevantSources);
      return Object.assign({}, control, {
        controlId: sha256(Buffer.from([module.id, entryPath, control.line, control.tag, control.id || '', index].join('|'))).slice(0, 20),
        evidence,
        bindingState: bindingState(control, evidence),
        runtimeInteractionProven: false,
        accessibleNameAdequacyProven: false
      });
    });
    const duplicates = duplicateIds(entry.text, entryPath);
    modules.push({
      id: module.id,
      folder: module.folder,
      entryPath,
      state: 'STATIC_ENTRY_ANALYZED',
      controls,
      duplicateIds: duplicates,
      summary: {
        controls: controls.length,
        staticBindings: controls.filter(item => item.bindingState === 'STATIC_BINDING_EVIDENCE').length,
        nativeActions: controls.filter(item => item.bindingState === 'NATIVE_SEMANTIC_ACTION').length,
        selectorOnly: controls.filter(item => item.bindingState === 'SELECTOR_REFERENCE_ONLY').length,
        noStaticBindingEvidence: controls.filter(item => ['NO_STATIC_BINDING_EVIDENCE', 'NO_ID_FOR_STATIC_MATCH'].includes(item.bindingState)).length,
        unnamed: controls.filter(item => !item.accessibleNameObservation && !item.hiddenDeclared).length,
        duplicateIds: duplicates.length
      }
    });
  }
  const reviewModules = modules.filter(module => (
    module.summary.noStaticBindingEvidence > 0
    || module.summary.unnamed > 0
    || module.summary.duplicateIds > 0
  )).map(module => ({
    id: sha256(Buffer.from(module.id)).slice(0, 20),
    moduleId: module.id,
    entryPath: module.entryPath,
    state: 'STATIC_HUMAN_CONTROL_REVIEW',
    noStaticBindingEvidence: module.summary.noStaticBindingEvidence,
    unnamedControlObservations: module.summary.unnamed,
    duplicateIdGroups: module.summary.duplicateIds,
    controlIds: module.controls.filter(control => (
      ['NO_STATIC_BINDING_EVIDENCE', 'NO_ID_FOR_STATIC_MATCH'].includes(control.bindingState)
      || !control.accessibleNameObservation
    )).map(control => control.controlId)
  }));
  const measuredAt = options.now || new Date().toISOString();
  const fingerprintMaterial = {
    graphFingerprint: graph.source && graph.source.fingerprint,
    sourceReceipts,
    modules,
    reviewModules,
    readIssues
  };
  const allControls = modules.flatMap(module => module.controls);
  return {
    schema: SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: graph.freshnessTtlMs,
    source: {
      label: graph.source && graph.source.label,
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      graphSchema: graph.schema,
      graphFingerprint: graph.source && graph.source.fingerprint,
      uniqueTextSources: uniqueSources.length,
      sourceBodiesReadAfterHashMatch: sourceReceipts.filter(item => item.state === 'VERIFIED_GRAPH_SOURCE').length,
      symlinksFollowed: false
    },
    summary: {
      modulesInGraph: graph.summary && graph.summary.modules,
      modulesAnalyzed: modules.filter(module => module.state === 'STATIC_ENTRY_ANALYZED').length,
      modulesWithoutEntryText: modules.filter(module => module.state !== 'STATIC_ENTRY_ANALYZED').length,
      controls: allControls.length,
      staticBindings: allControls.filter(item => item.bindingState === 'STATIC_BINDING_EVIDENCE').length,
      nativeActions: allControls.filter(item => item.bindingState === 'NATIVE_SEMANTIC_ACTION').length,
      selectorOnly: allControls.filter(item => item.bindingState === 'SELECTOR_REFERENCE_ONLY').length,
      noStaticBindingEvidence: allControls.filter(item => ['NO_STATIC_BINDING_EVIDENCE', 'NO_ID_FOR_STATIC_MATCH'].includes(item.bindingState)).length,
      unnamedControlObservations: allControls.filter(item => !item.accessibleNameObservation && !item.hiddenDeclared).length,
      duplicateIdGroups: modules.reduce((sum, module) => sum + module.summary.duplicateIds, 0),
      reviewModules: reviewModules.length,
      readIssues: readIssues.length
    },
    modules,
    reviewModules,
    sourceReceipts,
    readIssues,
    scopeBoundary: 'Entry HTML controls and exact selector/inline/native patterns are observed only from graph-bounded HTML and JavaScript whose hash still matches. Regex evidence is not DOM parsing, accessibility judgment, click proof, route proof, or runtime behavior. Missing static evidence is a review question, not proof that a control is broken.',
    preservedOwners: {
      runtimeInteraction: 'Browser, LAN and Hardware QA Lab',
      accessibilityJudgment: 'Browser, LAN and Hardware QA Lab plus human review',
      routeBehavior: 'Route and route owners',
      visualQuality: 'human visual review',
      permissions: 'Authority Surface and permission owners',
      sourceScope: 'Entry Resource Closure Observatory',
      readiness: 'Technical Glasses'
    },
    truth: {
      sourceTextPatternRead: true,
      htmlParsedCompletely: false,
      javascriptParsedCompletely: false,
      browserLoaded: false,
      domConstructed: false,
      controlClicked: false,
      runtimeInteractionProven: false,
      accessibilityAdequacyProven: false,
      routeBehaviorProven: false,
      visualQualityApproved: false,
      sourceMutationPerformed: false,
      permissionGranted: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function createReviewRequest(map, reviewIdInput, options = {}) {
  if (!map || map.schema !== SCHEMA) throw new Error('review request requires an ' + SCHEMA + ' map');
  const reviewId = typeof reviewIdInput === 'string' ? reviewIdInput.trim() : '';
  const review = map.reviewModules.find(item => item.id === reviewId);
  if (!review) throw new Error('module review seam is not present: ' + reviewId);
  const module = map.modules.find(item => item.id === review.moduleId);
  const questions = [
    'CONFIRM_EACH_REVIEWED_ELEMENT_IS_INTENDED_AS_A_HUMAN_CONTROL',
    'VERIFY_INTERACTION_IN_BROWSER_QA_AND_ATTACH_VISIBLE_EVIDENCE',
    'CHECK_ACCESSIBLE_NAME_KEYBOARD_AND_FOCUS_BEHAVIOR_WITH_HUMAN_JUDGMENT',
    'RECORD_KEEP_BIND_REMOVE_OR_REDESIGN_DECISION_WITH_ROUTE_AND_PERMISSION_BOUNDARIES'
  ].map(id => ({ id, state: 'REQUEST_NOT_RUN', answer: null, evidence: null }));
  const selectedControls = module.controls.filter(control => review.controlIds.includes(control.controlId));
  const generatedAt = options.now || new Date().toISOString();
  const material = { schema: REVIEW_SCHEMA, mapFingerprint: map.source.fingerprint, review, selectedControls, questions };
  return {
    schema: REVIEW_SCHEMA,
    version: 'v0.1',
    generatedAt,
    fingerprint: sha256(Buffer.from(stableJson(material))),
    sourceObservation: {
      schema: map.schema,
      measuredAt: map.measuredAt,
      freshnessTtlMs: map.freshnessTtlMs,
      fingerprint: map.source.fingerprint
    },
    selectedModule: review,
    selectedControls,
    questions,
    summary: { modulesSelected: 1, controlsSelected: selectedControls.length, questionsRequested: questions.length, questionsAnswered: 0 },
    scopeBoundary: 'This packet asks existing module, browser QA, route, accessibility, visual, and permission owners to inspect one module. It clicks nothing, changes no source, grants no permission, and makes no accessibility or broken-control verdict.',
    truth: {
      requestOnly: true,
      browserLoaded: false,
      controlClicked: false,
      runtimeInteractionProven: false,
      accessibilityAdequacyProven: false,
      routeBehaviorProven: false,
      sourceChanged: false,
      permissionChanged: false,
      installationPerformed: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  SCHEMA,
  REVIEW_SCHEMA,
  GRAPH_SCHEMA,
  parseAttributes,
  maskNonMarkupRegions,
  parseControls,
  duplicateIds,
  staticEvidenceFor,
  bindingState,
  collectUniqueSources,
  readGraphSource,
  analyzeWorkshop,
  createReviewRequest
};
