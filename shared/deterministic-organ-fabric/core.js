(function (root, factory) {
  const dependency = typeof module !== 'undefined' && module.exports
    ? require('../../tools/deterministic-json-core/index.js')
    : root.AXMDeterministicJson;
  const api = factory(dependency);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMDeterministicOrganFabric = api;
})(typeof self !== 'undefined' ? self : this, function (deterministicJson) {
  'use strict';

  if (!deterministicJson || typeof deterministicJson.canonicalJson !== 'function') {
    throw new Error('AXM deterministic JSON core is required');
  }

  const canonicalJson = deterministicJson.canonicalJson;
  const FACTORY_VERSION = '1.0.0';
  const RUNTIME_ID = 'axm.deterministic-organ-runtime';
  const RUNTIME_VERSION = '1.0.0';
  const RUNTIME_DIGEST = 'sha256:5bd480a2c3a0020b22cfaeb99003f02b918594011383e3db2fe47a970653ba09';
  const STRATEGIES = Object.freeze(['lean', 'balanced', 'guarded']);
  const LIMITS = Object.freeze({
    maxNodes: 64,
    maxDepth: 16,
    maxOperations: 1024,
    maxListItems: 256,
    maxInputBytes: 32768,
    maxOutputBytes: 32768,
    maxPackageFiles: 16,
    maxPackageBytes: 524288
  });
  const METRIC_PROFILE = Object.freeze({
    schema: 'axm.organ-metric-profile/v1',
    id: 'balanced-v1',
    digest: 'sha256:340f95a5bc16c407e1a973a8c57d659daa5ac1978f2b4081a82ed38b6b3cdd8d',
    integerArithmetic: true,
    weights: {
      functionalCoverage: 30,
      evidenceStrength: 20,
      failureContainment: 15,
      simplicityExplainability: 15,
      resourceMargin: 10,
      dependencyIndependence: 5,
      integrationFit: 5
    }
  });
  const ALLOWED_OPERATIONS = Object.freeze([
    'read', 'literal', 'lookup', 'equals', 'gte', 'and', 'or', 'not',
    'choose', 'clamp', 'stable_unique', 'stable_union', 'object',
    'transition', 'seeded_select'
  ]);
  const ORGAN_ARCHIVE_BRIDGE = Object.freeze({
    moduleId: 'ai-organ-archive',
    version: '0.9.0',
    status: 'TEST',
    contractSchema: 'axm.ai-native-module-contract/v1',
    contractFileSha256: '7c630f714a961a924a52bf9b2c0e251ba031e0934b75cc1a9562e348c97f36bf',
    contractCanonicalDigest: 'sha256:42a91fd899191dfb6ded2f54074d874cbc20c7d7a020c082a252775eaae254da',
    catalogSchema: 'axm.mirror.ai-organ-catalog/v3',
    portableLibrarySchema: 'axm.mirror.portable-ai-organ-library/v1',
    dormantComponentSchema: 'axm.mirror.dormant-organ-component/v1',
    sourceConvention: 'organs/*-organ.js'
  });

  function clone(value) { return JSON.parse(canonicalJson(value)); }
  function pretty(value) { return JSON.stringify(JSON.parse(canonicalJson(value)), null, 2) + '\n'; }
  function utf8Length(value) {
    const text = typeof value === 'string' ? value : canonicalJson(value);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    return Buffer.byteLength(text, 'utf8');
  }
  function hex32(value) { return ('00000000' + (value >>> 0).toString(16)).slice(-8); }
  function sha256(text) {
    const bytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(String(text))
      : Uint8Array.from(Buffer.from(String(text), 'utf8'));
    const words = [];
    const bitLength = bytes.length * 8;
    for (let i = 0; i < bytes.length; i += 1) words[i >> 2] = (words[i >> 2] || 0) | bytes[i] << (24 - (i % 4) * 8);
    words[bitLength >> 5] = (words[bitLength >> 5] || 0) | 0x80 << (24 - bitLength % 32);
    words[((bitLength + 64 >> 9) << 4) + 15] = bitLength;
    const k = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    function rr(x, n) { return x >>> n | x << 32 - n; }
    for (let offset = 0; offset < words.length; offset += 16) {
      const w = new Array(64);
      for (let i = 0; i < 16; i += 1) w[i] = words[offset + i] || 0;
      for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = rr(a, 7) ^ rr(a, 18) ^ a >>> 3;
        const s1 = rr(b, 17) ^ rr(b, 19) ^ b >>> 10;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
      for (let i = 0; i < 64; i += 1) {
        const s1 = rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g);
        const t1=(hh+s1+ch+k[i]+w[i])|0, s0=rr(a,2)^rr(a,13)^rr(a,22), maj=(a&b)^(a&c)^(b&c), t2=(s0+maj)|0;
        hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      h=[(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
    }
    return h.map(hex32).join('');
  }
  function digest(value) { return 'sha256:' + sha256(typeof value === 'string' ? value : canonicalJson(value)); }
  function seededIndex(value, length) {
    let hash = 2166136261;
    const text = canonicalJson(value);
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0) % length;
  }
  function withoutKey(value, key) {
    const copy = clone(value);
    delete copy[key];
    return copy;
  }
  function issue(code, path, message, details) {
    const row = { code: code, path: path, message: message };
    if (details !== undefined) row.details = details;
    return row;
  }
  function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
  function isPlain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
  function allowedKeys(value, keys, path, errors) {
    if (!isPlain(value)) { errors.push(issue('TYPE_OBJECT_REQUIRED', path, 'Expected an object.')); return false; }
    Object.keys(value).forEach(function (key) {
      if (keys.indexOf(key) < 0) errors.push(issue('UNKNOWN_FIELD', path + '.' + key, 'Closed schema refuses this field.'));
    });
    return true;
  }
  function required(value, keys, path, errors) {
    keys.forEach(function (key) { if (!own(value, key)) errors.push(issue('REQUIRED_FIELD', path + '.' + key, 'Required field is missing.')); });
  }
  function typeMatches(value, type) {
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'array') return Array.isArray(value);
    if (type === 'object') return isPlain(value);
    return typeof value === type;
  }
  function getPath(value, path) {
    if (path === '' || path === '$') return value;
    const parts = String(path).replace(/^\$\.?/, '').split('.').filter(Boolean);
    let cursor = value;
    for (let i = 0; i < parts.length; i += 1) {
      if (cursor === null || cursor === undefined || !own(Object(cursor), parts[i])) return undefined;
      cursor = cursor[parts[i]];
    }
    return cursor;
  }

  function validatePort(port, path, errors) {
    if (!allowedKeys(port, ['name','type','description','required','enum','items','minimum','maximum'], path, errors)) return;
    required(port, ['name','type','description','required'], path, errors);
    if (!/^[a-z][a-zA-Z0-9]*$/.test(String(port.name || ''))) errors.push(issue('PORT_NAME_INVALID', path + '.name', 'Port names must be lower camel case.'));
    if (['string','number','integer','boolean','array','object'].indexOf(port.type) < 0) errors.push(issue('PORT_TYPE_INVALID', path + '.type', 'Unsupported port type.'));
    if (port.type === 'array' && !port.items) errors.push(issue('ARRAY_ITEMS_REQUIRED', path + '.items', 'Array ports need an item type.'));
    if (port.items && ['string','number','integer','boolean','object'].indexOf(port.items) < 0) errors.push(issue('ARRAY_ITEMS_INVALID', path + '.items', 'Unsupported array item type.'));
    if (port.enum && (!Array.isArray(port.enum) || port.enum.length === 0)) errors.push(issue('ENUM_INVALID', path + '.enum', 'Enum must be a non-empty array.'));
  }
  function validateCase(row, path, errors) {
    if (!allowedKeys(row, ['id','description','input','assertions'], path, errors)) return;
    required(row, ['id','description','input','assertions'], path, errors);
    if (!Array.isArray(row.assertions) || row.assertions.length === 0) errors.push(issue('ASSERTIONS_REQUIRED', path + '.assertions', 'A case needs at least one assertion.'));
    (row.assertions || []).forEach(function (assertion, index) {
      const at = path + '.assertions[' + index + ']';
      if (!allowedKeys(assertion, ['path','op','value'], at, errors)) return;
      required(assertion, ['path','op','value'], at, errors);
      if (['eq','contains','in','gte','lte'].indexOf(assertion.op) < 0) errors.push(issue('ASSERTION_OP_INVALID', at + '.op', 'Unsupported assertion operation.'));
    });
  }
  function validateIntent(intent, pack) {
    const errors = [];
    if (!allowedKeys(intent, ['schema','id','name','purpose','fieldPackRef','inputs','outputs','requiredCases','desiredCases','invariants','boundaries','resourceBudget','metricProfileId','status','authority','intentDigest'], '$', errors)) return { ok:false, errors:errors };
    required(intent, ['schema','id','name','purpose','fieldPackRef','inputs','outputs','requiredCases','desiredCases','invariants','boundaries','resourceBudget','metricProfileId','status','authority','intentDigest'], '$', errors);
    if (intent.schema !== 'axm.organ-intent/v1') errors.push(issue('SCHEMA_MISMATCH', '$.schema', 'Expected axm.organ-intent/v1.'));
    if (!/^[a-z][a-z0-9-]{2,63}$/.test(String(intent.id || ''))) errors.push(issue('INTENT_ID_INVALID', '$.id', 'Use a lowercase hyphenated id.'));
    if (!Array.isArray(intent.inputs) || !intent.inputs.length) errors.push(issue('INPUTS_REQUIRED', '$.inputs', 'At least one typed input is required.'));
    if (!Array.isArray(intent.outputs) || !intent.outputs.length) errors.push(issue('OUTPUTS_REQUIRED', '$.outputs', 'At least one typed output is required.'));
    (intent.inputs || []).forEach(function (port, i) { validatePort(port, '$.inputs[' + i + ']', errors); });
    (intent.outputs || []).forEach(function (port, i) { validatePort(port, '$.outputs[' + i + ']', errors); });
    (intent.requiredCases || []).forEach(function (row, i) { validateCase(row, '$.requiredCases[' + i + ']', errors); });
    (intent.desiredCases || []).forEach(function (row, i) { validateCase(row, '$.desiredCases[' + i + ']', errors); });
    if (!Array.isArray(intent.requiredCases) || !intent.requiredCases.length) errors.push(issue('REQUIRED_CASES_MISSING', '$.requiredCases', 'At least one required case is required.'));
    if (!Array.isArray(intent.invariants) || !intent.invariants.length) errors.push(issue('INVARIANTS_MISSING', '$.invariants', 'At least one invariant is required.'));
    if (!Array.isArray(intent.boundaries) || !intent.boundaries.length) errors.push(issue('BOUNDARIES_MISSING', '$.boundaries', 'At least one boundary is required.'));
    if (!allowedKeys(intent.resourceBudget, Object.keys(LIMITS), '$.resourceBudget', errors)) {
      errors.push(issue('RESOURCE_BUDGET_INVALID', '$.resourceBudget', 'Resource budget must be a closed object.'));
    } else {
      Object.keys(LIMITS).forEach(function (key) {
        const value = intent.resourceBudget[key];
        if (!Number.isInteger(value) || value < 1 || value > LIMITS[key]) errors.push(issue('RESOURCE_CEILING_EXCEEDED', '$.resourceBudget.' + key, 'Budget must be an integer no greater than the v1 ceiling.', { ceiling:LIMITS[key], actual:value }));
      });
    }
    if (intent.metricProfileId !== METRIC_PROFILE.id) errors.push(issue('METRIC_PROFILE_UNSUPPORTED', '$.metricProfileId', 'Only balanced-v1 is available in v1.'));
    if (intent.status !== 'EXPERIMENTAL' || intent.authority !== 'NONE') errors.push(issue('AUTHORITY_CEILING', '$', 'Intent must remain EXPERIMENTAL with authority NONE.'));
    const expectedDigest = digest(withoutKey(intent, 'intentDigest'));
    if (intent.intentDigest !== expectedDigest) errors.push(issue('INTENT_DIGEST_MISMATCH', '$.intentDigest', 'Intent digest does not match canonical content.', { expected: expectedDigest, actual: intent.intentDigest }));
    if (pack) {
      const reference = intent.fieldPackRef || {};
      if (reference.id !== pack.id || reference.version !== pack.version || reference.digest !== pack.packDigest) errors.push(issue('PACK_LINEAGE_MISMATCH', '$.fieldPackRef', 'Intent does not bind the exact field pack.'));
      (pack.requiredInputs || []).forEach(function (name) { if (!(intent.inputs || []).some(function (p) { return p.name === name; })) errors.push(issue('CAPABILITY_INPUT_MISSING', '$.inputs', 'Pack requires input ' + name + '.')); });
      (pack.requiredOutputs || []).forEach(function (name) { if (!(intent.outputs || []).some(function (p) { return p.name === name; })) errors.push(issue('CAPABILITY_OUTPUT_MISSING', '$.outputs', 'Pack requires output ' + name + '.')); });
    }
    return { ok: errors.length === 0, errors: errors };
  }
  function sealIntent(draft, pack) {
    const intent = clone(draft);
    intent.schema = 'axm.organ-intent/v1';
    intent.fieldPackRef = { id:pack.id, version:pack.version, digest:pack.packDigest };
    intent.metricProfileId = intent.metricProfileId || METRIC_PROFILE.id;
    intent.status = 'EXPERIMENTAL';
    intent.authority = 'NONE';
    intent.resourceBudget = Object.assign({}, LIMITS, intent.resourceBudget || {});
    delete intent.intentDigest;
    intent.intentDigest = digest(intent);
    return intent;
  }
  function validatePack(pack) {
    const errors = [];
    if (!allowedKeys(pack, ['schema','id','version','title','description','capability','vocabulary','requiredInputs','requiredOutputs','allowedPrimitives','strategies','validators','heldOutCases','humanJudgments','exampleIntent','packDigest'], '$', errors)) return {ok:false,errors:errors};
    required(pack, ['schema','id','version','title','description','capability','vocabulary','requiredInputs','requiredOutputs','allowedPrimitives','strategies','validators','heldOutCases','humanJudgments','exampleIntent','packDigest'], '$', errors);
    if (pack.schema !== 'axm.organ-field-pack/v1') errors.push(issue('SCHEMA_MISMATCH', '$.schema', 'Expected axm.organ-field-pack/v1.'));
    STRATEGIES.forEach(function (name) { if (!pack.strategies || !pack.strategies[name]) errors.push(issue('STRATEGY_MISSING', '$.strategies.' + name, 'All three strategies are required.')); });
    (pack.allowedPrimitives || []).forEach(function (op) { if (ALLOWED_OPERATIONS.indexOf(op) < 0) errors.push(issue('UNKNOWN_OPERATION', '$.allowedPrimitives', 'Pack declares unsupported operation ' + op + '.')); });
    (pack.heldOutCases || []).forEach(function (row, i) { validateCase(row, '$.heldOutCases[' + i + ']', errors); });
    const expected = digest(withoutKey(pack, 'packDigest'));
    if (pack.packDigest !== expected) errors.push(issue('PACK_DIGEST_MISMATCH', '$.packDigest', 'Pack digest does not match canonical content.', {expected:expected,actual:pack.packDigest}));
    return {ok:errors.length===0,errors:errors};
  }

  function graphDepth(nodes) {
    const depths = {};
    let maximum = 0;
    nodes.forEach(function (node) {
      let depth = 1;
      const refs=[];
      (node.args || []).forEach(function (arg) { if (arg && arg.ref) refs.push(arg.ref); });
      Object.keys(node.fields || {}).forEach(function (key) { if (node.fields[key] && node.fields[key].ref) refs.push(node.fields[key].ref); });
      if (node.seedRef) refs.push(node.seedRef);
      refs.forEach(function (ref) { depth = Math.max(depth, (depths[ref] || 0) + 1); });
      depths[node.id] = depth;
      maximum = Math.max(maximum, depth);
    });
    return maximum;
  }
  function validateGraph(graph, pack, limits) {
    const errors = [], seen = new Set();
    limits = limits || LIMITS;
    if (!allowedKeys(graph, ['nodes','output'], '$.graph', errors)) return {ok:false,errors:errors};
    required(graph, ['nodes','output'], '$.graph', errors);
    if (!Array.isArray(graph.nodes)) return {ok:false,errors:errors.concat([issue('GRAPH_NODES_REQUIRED','$.graph.nodes','Graph nodes must be an array.')])};
    if (graph.nodes.length > limits.maxNodes) errors.push(issue('GRAPH_NODE_LIMIT', '$.graph.nodes', 'Graph exceeds node limit.'));
    graph.nodes.forEach(function (node, index) {
      const at = '$.graph.nodes[' + index + ']';
      if (!allowedKeys(node, ['id','op','path','value','table','args','fields','minimum','maximum','states','seedRef','options'], at, errors)) return;
      required(node, ['id','op'], at, errors);
      if (seen.has(node.id)) errors.push(issue('DUPLICATE_NODE', at + '.id', 'Node id is duplicated.'));
      if (ALLOWED_OPERATIONS.indexOf(node.op) < 0 || (pack && pack.allowedPrimitives.indexOf(node.op) < 0)) errors.push(issue('UNKNOWN_OPERATION', at + '.op', 'Operation is not allowlisted: ' + node.op));
      const references = [];
      (node.args || []).forEach(function (arg) { if (arg && arg.ref) references.push(arg.ref); });
      Object.keys(node.fields || {}).forEach(function (key) { const field = node.fields[key]; if (field && field.ref) references.push(field.ref); });
      if (node.seedRef) references.push(node.seedRef);
      references.forEach(function (ref) { if (!seen.has(ref)) errors.push(issue('CYCLE_OR_FORWARD_REFERENCE', at, 'References must point to an earlier node: ' + ref)); });
      if (node.op === 'seeded_select' && !node.seedRef) errors.push(issue('EXPLICIT_SEED_REQUIRED', at + '.seedRef', 'Seeded selection requires an explicit seed reference.'));
      seen.add(node.id);
    });
    if (!seen.has(graph.output)) errors.push(issue('GRAPH_OUTPUT_UNKNOWN', '$.graph.output', 'Output must name an existing node.'));
    const depth = graphDepth(graph.nodes);
    if (depth > limits.maxDepth) errors.push(issue('GRAPH_DEPTH_LIMIT', '$.graph', 'Graph exceeds depth limit.', {depth:depth,limit:limits.maxDepth}));
    return {ok:errors.length===0,errors:errors,measurements:{nodes:graph.nodes.length,depth:depth,maximumOperations:graph.nodes.length}};
  }
  function resolveArg(arg, values) { return arg && own(arg, 'ref') ? values[arg.ref] : arg ? clone(arg.value) : undefined; }
  function stableUnique(rows) {
    const seen = new Set(), result = [];
    (rows || []).forEach(function (row) { const key = canonicalJson(row); if (!seen.has(key)) { seen.add(key); result.push(clone(row)); } });
    return result;
  }
  function enforceListLimits(value, maximum, at, seen) {
    if (value === null || typeof value !== 'object') return;
    seen = seen || new Set();
    if (seen.has(value)) throw issue('INPUT_CYCLE_REFUSED', at, 'Cyclic runtime values are refused.');
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > maximum) throw issue('LIST_ITEM_LIMIT', at, 'List exceeds item ceiling.', { actual:value.length, ceiling:maximum });
      value.forEach(function (item,index) { enforceListLimits(item, maximum, at + '[' + index + ']', seen); });
    } else Object.keys(value).forEach(function (key) { enforceListLimits(value[key], maximum, at + '.' + key, seen); });
    seen.delete(value);
  }
  function executeGraph(graph, input, limits) {
    limits = Object.assign({}, LIMITS, limits || {});
    if (utf8Length(input) > limits.maxInputBytes) return {ok:false,refusal:issue('INPUT_BYTE_LIMIT','$','Input exceeds the byte ceiling.')};
    const values = {}, trace = [];
    try {
      enforceListLimits(input, limits.maxListItems, '$.input');
      let operations = 0;
      graph.nodes.forEach(function (node, index) {
        operations += 1;
        const args = (node.args || []).map(function (arg) { return resolveArg(arg, values); });
        if (node.op === 'stable_unique') operations += Array.isArray(args[0]) ? args[0].length : 0;
        if (node.op === 'stable_union') operations += (Array.isArray(args[0]) ? args[0].length : 0) + (Array.isArray(args[1]) ? args[1].length : 0);
        if (node.op === 'seeded_select') operations += (node.options || []).length;
        if (operations > limits.maxOperations) throw issue('OPERATION_LIMIT', '$.graph', 'Operation ceiling reached.', { actual:operations, ceiling:limits.maxOperations });
        let value;
        switch (node.op) {
          case 'read': value = getPath(input, node.path); break;
          case 'literal': value = clone(node.value); break;
          case 'lookup': {
            const key = String(args[0]);
            value = own(node.table || {}, key) ? clone(node.table[key]) : clone(node.table.default);
            break;
          }
          case 'equals': value = canonicalJson(args[0]) === canonicalJson(args[1]); break;
          case 'gte': value = Number(args[0]) >= Number(args[1]); break;
          case 'and': value = args.every(Boolean); break;
          case 'or': value = args.some(Boolean); break;
          case 'not': value = !args[0]; break;
          case 'choose': value = clone(args[0] ? args[1] : args[2]); break;
          case 'clamp': value = Math.max(Number(node.minimum), Math.min(Number(node.maximum), Number(args[0]))); break;
          case 'stable_unique': value = stableUnique(args[0]); break;
          case 'stable_union': value = stableUnique([].concat(args[0] || [], args[1] || [])); break;
          case 'object': {
            value = {};
            Object.keys(node.fields || {}).sort().forEach(function (key) { value[key] = resolveArg(node.fields[key], values); });
            break;
          }
          case 'transition': {
            const state = String(args[0]), event = String(args[1]), key = state + '|' + event;
            value = own(node.states || {}, key) ? node.states[key] : state;
            break;
          }
          case 'seeded_select': {
            const options = node.options || [];
            if (!options.length) throw issue('SELECTION_OPTIONS_MISSING', '$.graph.nodes[' + index + ']', 'Seeded selection needs options.');
            const seed = values[node.seedRef];
            if (seed === undefined || seed === null || String(seed) === '') throw issue('EXPLICIT_SEED_REQUIRED', '$.input', 'Explicit seed is missing.');
            value = clone(options[seededIndex({seed:seed,options:options}, options.length)]);
            break;
          }
          default: throw issue('UNKNOWN_OPERATION', '$.graph.nodes[' + index + '].op', 'Operation is not allowlisted.');
        }
        enforceListLimits(value, limits.maxListItems, '$.graph.nodes[' + index + ']');
        values[node.id] = value;
        trace.push({node:node.id,op:node.op,valueDigest:digest(value)});
      });
      const output = clone(values[graph.output]);
      if (utf8Length(output) > limits.maxOutputBytes) return {ok:false,refusal:issue('OUTPUT_BYTE_LIMIT','$','Output exceeds the byte ceiling.'),trace:trace};
      return {ok:true,output:output,trace:trace,operations:operations};
    } catch (error) {
      return {ok:false,refusal:error && error.code ? error : issue('RUNTIME_REFUSAL','$',String(error && error.message || error)),trace:trace};
    }
  }
  function validateValueAgainstPorts(value, ports, path) {
    const errors=[];
    if (!isPlain(value)) return [issue('TYPE_OBJECT_REQUIRED',path,'Ports require an object.')];
    const allowed=new Set(ports.map(function(port){return port.name;}));
    Object.keys(value).forEach(function(key){if(!allowed.has(key))errors.push(issue('UNKNOWN_PORT',path+'.'+key,'Closed port schema refuses this field.'));});
    ports.forEach(function (port) {
      const present=own(value,port.name), item=value[port.name], at=path+'.'+port.name;
      if (port.required && !present) errors.push(issue('REQUIRED_PORT',at,'Required port is missing.'));
      if (!present) return;
      if (!typeMatches(item,port.type)) errors.push(issue('PORT_TYPE_MISMATCH',at,'Expected '+port.type+'.'));
      if (port.enum && port.enum.indexOf(item)<0) errors.push(issue('PORT_ENUM_MISMATCH',at,'Value is outside the declared enum.'));
      if (typeof item==='number' && port.minimum!==undefined && item<port.minimum) errors.push(issue('PORT_MINIMUM',at,'Value is below minimum.'));
      if (typeof item==='number' && port.maximum!==undefined && item>port.maximum) errors.push(issue('PORT_MAXIMUM',at,'Value is above maximum.'));
      if (Array.isArray(item) && port.items) item.forEach(function (entry,i) { if (!typeMatches(entry,port.items)) errors.push(issue('ARRAY_ITEM_TYPE',at+'['+i+']','Expected '+port.items+'.')); });
    });
    return errors;
  }
  function evaluateGuard(guard,input) {
    const value=getPath(input,guard.path);
    if (guard.kind==='required') return value!==undefined && value!==null && value!=='';
    if (guard.kind==='enum') return (guard.values||[]).indexOf(value)>=0;
    if (guard.kind==='minimum') return Number(value)>=Number(guard.value);
    if (guard.kind==='maximum') return Number(value)<=Number(guard.value);
    return false;
  }
  function runDefinition(definition,input) {
    const inputErrors=validateValueAgainstPorts(input,definition.interface.inputs,'$.input');
    if (inputErrors.length) return {ok:false,refusal:issue('INPUT_SCHEMA_REFUSAL','$.input','Input failed the declared schema.',inputErrors)};
    const failed=(definition.guards||[]).filter(function(g){return !evaluateGuard(g,input);});
    if (failed.length) return {ok:false,refusal:issue('GUARD_REFUSAL','$.input','A declared boundary refused this input.',failed)};
    const result=executeGraph(definition.graph,input,definition.limits);
    if (!result.ok) return result;
    const outputErrors=validateValueAgainstPorts(result.output,definition.interface.outputs,'$.output');
    if (outputErrors.length) return {ok:false,refusal:issue('OUTPUT_SCHEMA_REFUSAL','$.output','Output failed the declared schema.',outputErrors),trace:result.trace};
    return result;
  }
  function assertCase(result, row) {
    if (!result.ok) return {ok:false,failures:[result.refusal]};
    const failures=[];
    row.assertions.forEach(function(assertion){
      const actual=getPath(result.output,assertion.path); let pass=false;
      if(assertion.op==='eq') pass=canonicalJson(actual)===canonicalJson(assertion.value);
      else if(assertion.op==='contains') pass=Array.isArray(actual) && actual.some(function(v){return canonicalJson(v)===canonicalJson(assertion.value);});
      else if(assertion.op==='in') pass=Array.isArray(assertion.value) && assertion.value.some(function(v){return canonicalJson(v)===canonicalJson(actual);});
      else if(assertion.op==='gte') pass=Number(actual)>=Number(assertion.value);
      else if(assertion.op==='lte') pass=Number(actual)<=Number(assertion.value);
      if(!pass) failures.push(issue('ASSERTION_FAILED','$.output.'+assertion.path,'Case assertion failed.',{op:assertion.op,expected:assertion.value,actual:actual}));
    });
    return {ok:failures.length===0,failures:failures};
  }
  function makeDefinition(intent,pack,strategyName) {
    const strategy=pack.strategies[strategyName];
    if(!strategy) throw new Error('Unknown strategy '+strategyName);
    const definition={
      schema:'axm.deterministic-organ/v1',id:intent.id+'-'+strategyName,version:'0.1.0',status:'EXPERIMENTAL',
      field:pack.id,strategy:strategyName,purpose:intent.purpose,
      lineage:{factoryVersion:FACTORY_VERSION,runtime:{id:RUNTIME_ID,version:RUNTIME_VERSION,digest:RUNTIME_DIGEST},pack:{id:pack.id,version:pack.version,digest:pack.packDigest},intentDigest:intent.intentDigest,metricProfileId:intent.metricProfileId,metricProfileDigest:METRIC_PROFILE.digest},
      interface:{inputs:clone(intent.inputs),outputs:clone(intent.outputs)},graph:clone(strategy.graph),guards:clone(strategy.guards||[]),
      limits:Object.assign({},LIMITS,intent.resourceBudget||{}),invariants:clone(intent.invariants),boundaries:clone(intent.boundaries),
      refusals:['unknown-operation','cycle-or-forward-reference','implicit-randomness','missing-explicit-seed','clock-or-environment-access','network','filesystem','dynamic-code','unbounded-iteration','authority-escalation'],
      implementation:{kind:'pure-json-transformer',status:'EXPERIMENTAL'},installed:false,registered:false,staged:false,promoted:false,canonChanged:false
    };
    definition.definitionDigest=digest(definition);
    return definition;
  }
  function evaluateDefinition(definition,intent,pack) {
    const gates=[];
    function gate(id,ok,details){gates.push({id:id,ok:Boolean(ok),details:details||[]});}
    const lineage=definition.lineage||{};
    gate('exact-lineage',lineage.intentDigest===intent.intentDigest && lineage.pack && lineage.pack.digest===pack.packDigest && lineage.runtime && lineage.runtime.version===RUNTIME_VERSION && lineage.runtime.digest===RUNTIME_DIGEST && lineage.metricProfileDigest===METRIC_PROFILE.digest);
    const intentCheck=validateIntent(intent,pack); gate('schema-and-types',intentCheck.ok,intentCheck.errors);
    const graphCheck=validateGraph(definition.graph,pack,definition.limits); gate('purity-and-graph-bounds',graphCheck.ok,graphCheck.errors);
    gate('capability-coverage',pack.requiredInputs.every(function(n){return intent.inputs.some(function(p){return p.name===n;});}) && pack.requiredOutputs.every(function(n){return intent.outputs.some(function(p){return p.name===n;});}));
    const requiredRows=[], desiredRows=[], heldRows=[];
    function runRows(rows,target){(rows||[]).forEach(function(row){const result=runDefinition(definition,row.input),check=assertCase(result,row);target.push({id:row.id,ok:check.ok,failures:check.failures,outputDigest:result.ok?digest(result.output):null,trace:result.trace||[]});});}
    if(graphCheck.ok){runRows(intent.requiredCases,requiredRows);runRows(intent.desiredCases,desiredRows);runRows(pack.heldOutCases,heldRows);}
    gate('required-fixtures',requiredRows.length===intent.requiredCases.length && requiredRows.every(function(r){return r.ok;}),requiredRows.filter(function(r){return !r.ok;}));
    gate('pack-held-out-cases',heldRows.length===pack.heldOutCases.length && heldRows.every(function(r){return r.ok;}),heldRows.filter(function(r){return !r.ok;}));
    const resourceOk=definition.graph.nodes.length<=definition.limits.maxNodes && utf8Length(definition)<definition.limits.maxPackageBytes;
    gate('resource-ceilings',resourceOk);
    const rebuilt=makeDefinition(intent,pack,definition.strategy);
    gate('definition-rebuild-parity',canonicalJson(rebuilt)===canonicalJson(definition),{rebuiltDigest:rebuilt.definitionDigest,definitionDigest:definition.definitionDigest});
    const hardPass=gates.every(function(g){return g.ok;});
    const receipt={schema:'axm.organ-evaluation-receipt/v1',factoryVersion:FACTORY_VERSION,candidateId:definition.id,definitionDigest:definition.definitionDigest,intentDigest:intent.intentDigest,packDigest:pack.packDigest,status:hardPass?'VALID':'REJECTED',gates:gates,fixtures:{required:requiredRows,desired:desiredRows,heldOut:heldRows},reproducibility:{canonical:true,definitionRebuildParity:gates.find(function(g){return g.id==='definition-rebuild-parity';}).ok,packageRebuildParity:null},limitations:clone(pack.humanJudgments),authorityCeiling:{installed:false,registered:false,staged:false,promoted:false,canonChanged:false,permissionsChanged:false}};
    if(hardPass) receipt.metrics=scoreCandidate(definition,receipt,intent);
    receipt.receiptDigest=digest(receipt);
    return receipt;
  }
  function ratio(pass,total){return total===0?100:Math.floor(pass*100/total);}
  function scoreCandidate(definition,receipt,intent){
    const required=receipt.fixtures.required,desired=receipt.fixtures.desired,held=receipt.fixtures.heldOut;
    const allFunctional=required.concat(desired), passedFunctional=allFunctional.filter(function(r){return r.ok;}).length;
    const guardCount=(definition.guards||[]).length, requiredInputs=intent.inputs.filter(function(p){return p.required;}).length;
    const nodes=definition.graph.nodes.length, depth=graphDepth(definition.graph.nodes);
    const components={
      functionalCoverage:ratio(passedFunctional,allFunctional.length),
      evidenceStrength:ratio(required.concat(held).filter(function(r){return r.ok;}).length+(receipt.reproducibility.definitionRebuildParity?1:0),required.length+held.length+1),
      failureContainment:Math.min(100,ratio(Math.min(guardCount,requiredInputs),Math.max(1,requiredInputs))),
      simplicityExplainability:Math.max(0,100-nodes*3-depth*2-guardCount),
      resourceMargin:Math.max(0,100-Math.floor(nodes*100/definition.limits.maxNodes)),
      dependencyIndependence:100,integrationFit:100
    };
    let weighted=0;
    Object.keys(METRIC_PROFILE.weights).forEach(function(key){weighted+=components[key]*METRIC_PROFILE.weights[key];});
    return {profileId:METRIC_PROFILE.id,weights:clone(METRIC_PROFILE.weights),components:components,score:Math.floor(weighted/100),integerArithmetic:true};
  }

  function portSchema(ports,title){
    const properties={},requiredNames=[];
    ports.forEach(function(port){const schema={type:port.type,description:port.description};if(port.enum)schema.enum=clone(port.enum);if(port.items)schema.items={type:port.items};if(port.minimum!==undefined)schema.minimum=port.minimum;if(port.maximum!==undefined)schema.maximum=port.maximum;properties[port.name]=schema;if(port.required)requiredNames.push(port.name);});
    return {$schema:'https://json-schema.org/draft/2020-12/schema',title:title,type:'object',additionalProperties:false,properties:properties,required:requiredNames};
  }
  function standaloneOrganSource(definition){
    const source="'use strict';\n"+
      "const definition="+canonicalJson(definition)+";\n"+
      "function own(o,k){return Object.prototype.hasOwnProperty.call(o,k);}\n"+
      "function path(o,p){return String(p).replace(/^\\$\\.?/,'').split('.').filter(Boolean).reduce((v,k)=>v==null?undefined:v[k],o);}\n"+
      "function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';}\n"+
      "function unique(a){const s=new Set();return (a||[]).filter(v=>{const k=stable(v);if(s.has(k))return false;s.add(k);return true;});}\n"+
      "function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}\n"+
      "function run(input){for(const g of definition.guards||[]){const v=path(input,g.path);const ok=g.kind==='required'?v!==undefined&&v!==null&&v!=='':g.kind==='enum'?g.values.includes(v):g.kind==='minimum'?Number(v)>=Number(g.value):g.kind==='maximum'?Number(v)<=Number(g.value):false;if(!ok)return {ok:false,code:'GUARD_REFUSAL',guard:g};}const v={};for(const n of definition.graph.nodes){const a=(n.args||[]).map(x=>x&&own(x,'ref')?v[x.ref]:x.value);switch(n.op){case'read':v[n.id]=path(input,n.path);break;case'literal':v[n.id]=n.value;break;case'lookup':v[n.id]=own(n.table,String(a[0]))?n.table[String(a[0])]:n.table.default;break;case'equals':v[n.id]=stable(a[0])===stable(a[1]);break;case'gte':v[n.id]=Number(a[0])>=Number(a[1]);break;case'and':v[n.id]=a.every(Boolean);break;case'or':v[n.id]=a.some(Boolean);break;case'not':v[n.id]=!a[0];break;case'choose':v[n.id]=a[0]?a[1]:a[2];break;case'clamp':v[n.id]=Math.max(n.minimum,Math.min(n.maximum,Number(a[0])));break;case'stable_unique':v[n.id]=unique(a[0]);break;case'stable_union':v[n.id]=unique([...(a[0]||[]),...(a[1]||[])]);break;case'object':v[n.id]=Object.fromEntries(Object.keys(n.fields).sort().map(k=>[k,n.fields[k].ref?v[n.fields[k].ref]:n.fields[k].value]));break;case'transition':v[n.id]=n.states[String(a[0])+'|'+String(a[1])]||a[0];break;case'seeded_select':v[n.id]=n.options[hash(stable({options:n.options,seed:v[n.seedRef]}))%n.options.length];break;default:return {ok:false,code:'UNKNOWN_OPERATION'};}}return {ok:true,output:v[definition.graph.output]};}\n"+
      "module.exports={definition,run};\n";
    return source.replace(/\r\n/g,'\n');
  }
  function candidateReceipt(definition,evaluation,manifest,bundleDigest){
    return {schema:'axm.module-candidate-receipt/v1',candidate:{id:manifest.id,name:manifest.name,version:manifest.version,status:'EXPERIMENTAL',location:'detached-organ-candidate'},source:{kind:'deterministic-organ-fabric',definitionDigest:definition.definitionDigest,evaluationDigest:evaluation.receiptDigest,bundleCoverageBasisDigest:bundleDigest},authority:{installed:false,registered:false,staged:false,promoted:false,canonChanged:false,permissionsChanged:false},boundaries:['detached-package','no-self-install','no-self-promotion','host-review-required']};
  }
  function buildPackage(definition,intent,pack,evaluation){
    if(evaluation.status!=='VALID') throw new Error('Rejected candidates cannot be packaged.');
    const moduleId=definition.id;
    const manifest={schema:'axm.module-manifest/v1',id:moduleId,name:intent.name+' — '+definition.strategy,version:'v0.1',status:'EXPERIMENTAL',entry:'index.html',contract:'module.contract.json',uses:[],installed:false,promoted:false};
    const contract={schema:'axm.module-contract/v1',id:moduleId,version:'v0.1',provides:intent.outputs.map(function(p){return 'json-output:'+p.name;}),consumes:intent.inputs.map(function(p){return 'json-input:'+p.name;}),permissions:[],handoffs:{emits:['axm.deterministic-organ/v1','axm.organ-evaluation-receipt/v1'],accepts:['json-input','human-implementation-review']},lifecycle:{state_owner:'none',reload:'not-applicable',disconnect:'not-applicable',cleanup:'not-applicable'},boundaries:{writes:[],refuses:['network','filesystem','clock','environment','dynamic-code','implicit-randomness','installation','registration','staging','promotion','permission-change','canon-change','foundation-mutation']}};
    const files={
      'manifest.json':pretty(manifest),
      'module.contract.json':pretty(contract),
      'index.html':'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+manifest.name.replace(/[<&]/g,'')+'</title><style>body{font:16px system-ui;max-width:52rem;margin:4rem auto;padding:0 1rem;background:#10151c;color:#eef3f8}code{color:#9ee7d5}.boundary{border:1px solid #526170;padding:1rem}</style><h1>'+manifest.name.replace(/[<&]/g,'')+'</h1><p>Strategy: <code>'+definition.strategy+'</code></p><div class="boundary"><strong>EXPERIMENTAL · DETACHED</strong><p>Static inspection only. This page executes no organ code.</p></div></html>\n',
      'organ.intent.json':pretty(intent),
      'organ.definition.json':pretty(definition),
      'organ.input.schema.json':pretty(portSchema(intent.inputs,manifest.name+' input')),
      'organ.output.schema.json':pretty(portSchema(intent.outputs,manifest.name+' output')),
      'organ.fixtures.json':pretty({schema:'axm.organ-fixtures/v1',required:intent.requiredCases,desired:intent.desiredCases,heldOut:pack.heldOutCases}),
      'organ.js':standaloneOrganSource(definition),
      'selftest.js':"'use strict';\nconst assert=require('assert');const organ=require('./organ.js');const fixtures=require('./organ.fixtures.json');for(const row of fixtures.required){const result=organ.run(row.input);assert.equal(result.ok,true,row.id);for(const a of row.assertions){const actual=a.path.split('.').reduce((v,k)=>v[k],result.output);if(a.op==='eq')assert.deepStrictEqual(actual,a.value);if(a.op==='contains')assert(actual.some(v=>JSON.stringify(v)===JSON.stringify(a.value)));if(a.op==='in')assert(a.value.includes(actual));if(a.op==='gte')assert(actual>=a.value);if(a.op==='lte')assert(actual<=a.value);}}console.log('PASS '+fixtures.required.length+' required fixtures');\n",
      'evidence-route.json':pretty({schema:'axm.evidence-route/v1',claims:[{claim:'Definition obeys its declared grammar and bounds.',evidence:'organ.evaluation.json gates'},{claim:'Required fixtures pass in the trusted runtime.',evidence:'organ.evaluation.json fixtures.required'},{claim:'Package is detached and authority-limited.',evidence:'candidate.receipt.json authority'}],notProven:pack.humanJudgments}),
      'organ.evaluation.json':pretty(evaluation),
      'authority.receipt.json':pretty({schema:'axm.organ-authority-receipt/v1',status:'EXPERIMENTAL',installed:false,registered:false,staged:false,promoted:false,canonChanged:false,permissionsChanged:false})
    };
    const bundleFiles=Object.keys(files).sort().map(function(path){return {path:path,encoding:'utf8',sha256:digest(files[path]).slice(7),content:files[path]};});
    const bundle={schema:'axm.module-bundle/v1',id:manifest.id,version:manifest.version,files:bundleFiles};
    const bundleText=pretty(bundle);
    const bundleDigest=digest(bundleText);
    files['candidate.receipt.json']=pretty(candidateReceipt(definition,evaluation,manifest,bundleDigest));
    const finalBundleFiles=Object.keys(files).sort().map(function(path){return {path:path,encoding:'utf8',sha256:digest(files[path]).slice(7),content:files[path]};});
    files['module-bundle.json']=pretty({schema:'axm.module-bundle/v1',id:manifest.id,version:manifest.version,files:finalBundleFiles});
    const fileRows=Object.keys(files).sort().map(function(path){return {path:path,bytes:utf8Length(files[path]),digest:digest(files[path])};});
    const totalBytes=fileRows.reduce(function(sum,row){return sum+row.bytes;},0);
    if(fileRows.length>LIMITS.maxPackageFiles) throw new Error('Package file ceiling exceeded.');
    if(totalBytes>LIMITS.maxPackageBytes) throw new Error('Package byte ceiling exceeded.');
    const result={schema:'axm.organ-candidate-package/v1',id:manifest.id,version:manifest.version,status:'EXPERIMENTAL',definitionDigest:definition.definitionDigest,evaluationDigest:evaluation.receiptDigest,files:fileRows,totalBytes:totalBytes,authority:{installed:false,registered:false,staged:false,promoted:false,canonChanged:false},packageDigest:''};
    result.packageDigest=digest(withoutKey(result,'packageDigest'));
    return {package:result,files:files};
  }
  function verifyPackage(candidate){
    const errors=[];
    if(!candidate||!candidate.package||!candidate.files) return {ok:false,errors:[issue('PACKAGE_SHAPE_INVALID','$','Expected package and files.')]};
    const actualPaths=Object.keys(candidate.files).sort(), declared=(candidate.package.files||[]).map(function(r){return r.path;});
    if(canonicalJson(actualPaths)!==canonicalJson(declared)) errors.push(issue('PACKAGE_FILE_SET_MISMATCH','$.files','Declared and actual file sets differ.'));
    (candidate.package.files||[]).forEach(function(row){if(!own(candidate.files,row.path))return;const actual=digest(candidate.files[row.path]);if(actual!==row.digest)errors.push(issue('PACKAGE_FILE_TAMPERED','$.files.'+row.path,'File digest mismatch.',{expected:row.digest,actual:actual}));});
    const expected=digest(withoutKey(candidate.package,'packageDigest'));
    if(expected!==candidate.package.packageDigest) errors.push(issue('PACKAGE_DIGEST_MISMATCH','$.package.packageDigest','Package digest mismatch.'));
    if(!candidate.definition||candidate.definition.definitionDigest!==candidate.package.definitionDigest||candidate.definition.definitionDigest!==digest(withoutKey(candidate.definition,'definitionDigest')))errors.push(issue('PACKAGE_DEFINITION_DRIFT','$.definition','Definition does not match its bound digest.'));
    if(!candidate.evaluation||candidate.evaluation.receiptDigest!==candidate.package.evaluationDigest||candidate.evaluation.receiptDigest!==digest(withoutKey(candidate.evaluation,'receiptDigest')))errors.push(issue('PACKAGE_EVALUATION_DRIFT','$.evaluation','Evaluation does not match its bound digest.'));
    try{if(canonicalJson(JSON.parse(candidate.files['organ.definition.json']))!==canonicalJson(candidate.definition))errors.push(issue('PACKAGE_DEFINITION_FILE_DRIFT','$.files.organ.definition.json','Definition file differs from bound definition.'));if(canonicalJson(JSON.parse(candidate.files['organ.evaluation.json']))!==canonicalJson(candidate.evaluation))errors.push(issue('PACKAGE_EVALUATION_FILE_DRIFT','$.files.organ.evaluation.json','Evaluation file differs from bound receipt.'));}catch(error){errors.push(issue('PACKAGE_BOUND_JSON_INVALID','$.files',String(error.message||error)));}
    try{const bundle=JSON.parse(candidate.files['module-bundle.json']);const candidates=Object.keys(candidate.files).filter(function(p){return p!=='module-bundle.json';}).sort();if(canonicalJson(bundle.files.map(function(f){return f.path;}))!==canonicalJson(candidates))errors.push(issue('BUNDLE_DRIFT','$.module-bundle','Bundle does not cover the exact non-self file set.'));bundle.files.forEach(function(f){if(candidate.files[f.path]!==f.content||digest(f.content).slice(7)!==f.sha256)errors.push(issue('BUNDLE_FILE_DRIFT','$.module-bundle.'+f.path,'Bundled content differs.'));});}catch(error){errors.push(issue('BUNDLE_INVALID','$.module-bundle',String(error.message||error)));}
    return {ok:errors.length===0,errors:errors,packageDigest:candidate.package.packageDigest};
  }
  function compactFailure(intent,pack,strategy,receipt){
    const failure={schema:'axm.organ-generation-failure/v1',factoryVersion:FACTORY_VERSION,intentDigest:intent.intentDigest,pack:{id:pack.id,version:pack.version,digest:pack.packDigest},strategy:strategy,status:'REJECTED',failedGates:receipt.gates.filter(function(g){return !g.ok;}).map(function(g){return {id:g.id,details:g.details};})};
    failure.failureDigest=digest(failure);return failure;
  }
  function generateCandidates(intent,pack){
    const packCheck=validatePack(pack),intentCheck=validateIntent(intent,pack);
    if(!packCheck.ok||!intentCheck.ok)return {schema:'axm.organ-generation-run/v1',status:'REFUSED',intentDigest:intent.intentDigest||null,errors:packCheck.errors.concat(intentCheck.errors),candidates:[],failures:[]};
    const candidates=[],failures=[];
    STRATEGIES.forEach(function(strategy){
      const definition=makeDefinition(intent,pack,strategy),evaluation=evaluateDefinition(definition,intent,pack);
      if(evaluation.status!=='VALID'){failures.push(compactFailure(intent,pack,strategy,evaluation));return;}
      const first=buildPackage(definition,intent,pack,evaluation);first.definition=definition;first.evaluation=evaluation;
      const firstCheck=verifyPackage(first),second=buildPackage(definition,intent,pack,evaluation),firstParity=canonicalJson({package:first.package,files:first.files})===canonicalJson({package:second.package,files:second.files});
      evaluation.gates.push({id:'package-integrity',ok:firstCheck.ok,details:firstCheck.errors});
      evaluation.gates.push({id:'package-rebuild-parity',ok:firstParity,details:[]});
      evaluation.reproducibility.packageRebuildParity=firstParity;
      if(!firstCheck.ok||!firstParity){evaluation.status='REJECTED';delete evaluation.metrics;delete evaluation.receiptDigest;evaluation.receiptDigest=digest(evaluation);failures.push(compactFailure(intent,pack,strategy,evaluation));return;}
      delete evaluation.receiptDigest;evaluation.receiptDigest=digest(evaluation);
      const candidate=buildPackage(definition,intent,pack,evaluation);candidate.definition=definition;candidate.evaluation=evaluation;
      const finalCheck=verifyPackage(candidate),rebuilt=buildPackage(definition,intent,pack,evaluation);rebuilt.definition=definition;rebuilt.evaluation=evaluation;
      if(!finalCheck.ok||canonicalJson(candidate)!==canonicalJson(rebuilt)){evaluation.gates.find(function(g){return g.id==='package-integrity';}).ok=false;evaluation.gates.find(function(g){return g.id==='package-integrity';}).details=finalCheck.errors;evaluation.gates.find(function(g){return g.id==='package-rebuild-parity';}).ok=false;evaluation.reproducibility.packageRebuildParity=false;evaluation.status='REJECTED';delete evaluation.metrics;delete evaluation.receiptDigest;evaluation.receiptDigest=digest(evaluation);failures.push(compactFailure(intent,pack,strategy,evaluation));return;}
      candidates.push(candidate);
    });
    const run={schema:'axm.organ-generation-run/v1',factoryVersion:FACTORY_VERSION,status:candidates.length?'COMPLETE':'REFUSED',intentDigest:intent.intentDigest,packDigest:pack.packDigest,metricProfileId:intent.metricProfileId,candidates:candidates,failures:failures};
    run.runDigest=digest({schema:run.schema,factoryVersion:run.factoryVersion,status:run.status,intentDigest:run.intentDigest,packDigest:run.packDigest,metricProfileId:run.metricProfileId,candidates:candidates.map(function(c){return c.package.packageDigest;}),failures:failures.map(function(f){return f.failureDigest;})});
    return run;
  }
  function compareCandidates(run){
    const valid=(run.candidates||[]).filter(function(c){return c.evaluation&&c.evaluation.status==='VALID';});
    const rows=valid.map(function(c){return {candidateId:c.package.id,strategy:c.definition.strategy,packageDigest:c.package.packageDigest,evaluationDigest:c.evaluation.receiptDigest,score:c.evaluation.metrics.score,components:clone(c.evaluation.metrics.components)};});
    rows.sort(function(a,b){return b.score-a.score||a.packageDigest.localeCompare(b.packageDigest);});
    const groups=[];rows.forEach(function(row){let group=groups.find(function(g){return g.score===row.score;});if(!group){group={score:row.score,candidateIds:[]};groups.push(group);}group.candidateIds.push(row.candidateId);});
    const comparison={schema:'axm.organ-comparison/v1',runDigest:run.runDigest,metricProfile:clone(METRIC_PROFILE),rows:rows,ties:groups.filter(function(g){return g.candidateIds.length>1;}),rankingAdvisoryOnly:true,selection:null,authority:{installed:false,registered:false,staged:false,promoted:false,canonChanged:false}};
    comparison.comparisonDigest=digest(comparison);return comparison;
  }
  function selectCandidate(comparison,candidate,mikeLabel){
    if(!comparison.rows.some(function(row){return row.packageDigest===candidate.package.packageDigest;}))throw new Error('Candidate is not part of this comparison.');
    const receipt={schema:'axm.organ-selection-receipt/v1',selectedBy:String(mikeLabel||'Mike Tobi'),comparisonDigest:comparison.comparisonDigest,candidateId:candidate.package.id,packageDigest:candidate.package.packageDigest,decision:'SELECT_FOR_IMPLEMENTATION_REVIEW',applied:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false,permissionsChanged:false};
    receipt.selectionDigest=digest(receipt);return receipt;
  }
  function archiveAuthority(){
    return {loaded:false,executed:false,connected:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false,permissionsChanged:false,foundationChanged:false};
  }
  function purposeShelves(packId){
    const shelves={
      'software-workshop':{primary:'development-repair',useFields:['development-repair','evidence-verification','planning-coordination'],roles:['planner','verifier']},
      'games-entertainment':{primary:'world-simulation',useFields:['creativity-exploration','planning-coordination','world-simulation'],roles:['planner','producer','simulator']},
      'creative-production':{primary:'creativity-exploration',useFields:['creativity-exploration','perception-observation','planning-coordination'],roles:['planner','producer']}
    };
    return shelves[packId]||{primary:'general-foundation',useFields:['general-foundation'],roles:['producer']};
  }
  function safeOrganSourcePath(candidateId){
    const slug=String(candidateId||'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');
    if(!slug)throw new Error('Candidate id cannot produce a safe dormant organ source path.');
    return 'organs/'+slug+'-organ.js';
  }
  function projectArchiveStash(candidate){
    const verification=verifyPackage(candidate);
    if(!verification.ok)throw new Error('Only an intact candidate package may be projected into the dormant stash.');
    if(!candidate.evaluation||candidate.evaluation.status!=='VALID')throw new Error('Only a hard-gate-valid candidate may enter the dormant stash.');
    const source=candidate.files['organ.js'];
    if(typeof source!=='string')throw new Error('Dormant stash projection requires the standalone organ.js source.');
    const sourceBytes=utf8Length(source);
    if(sourceBytes>2097152)throw new Error('Dormant organ source exceeds the target archive source ceiling.');
    let intent;
    try{intent=JSON.parse(candidate.files['organ.intent.json']);}catch(error){throw new Error('Dormant stash projection requires a valid normalized intent file.');}
    if(intent.intentDigest!==candidate.evaluation.intentDigest)throw new Error('Dormant stash intent lineage does not match the evaluation receipt.');
    const packId=candidate.definition.lineage.pack.id,shelves=purposeShelves(packId),suggestedSourcePath=safeOrganSourcePath(candidate.package.id),sourceSha256=digest(source).slice(7);
    const basis={
      schema:'axm.organ-archive-stash-projection/v1',status:'EXPERIMENTAL',packageDigest:candidate.package.packageDigest,candidateId:candidate.package.id,
      validity:{state:'HARD_GATES_PASSED',evaluationDigest:candidate.evaluation.receiptDigest,qualityClaim:false,humanJudgmentsUnresolved:clone(candidate.evaluation.limitations||[])},
      archiveState:{disposition:'VALID_DORMANT_LIBRARY',retentionPolicy:'KEEP_WHEN_NO_CURRENT_USE',admissionStatus:'ARCHIVED_NOT_ADMITTED_TO_RUNTIME',startupPolicy:'DORMANT',implementationStatus:'UNSELECTED'},
      purposeClassification:{state:'INFERRED_UNCONFIRMED',primaryPurposeCategory:shelves.primary,useFields:shelves.useFields.slice().sort(),functionalRoles:shelves.roles.slice().sort(),basis:{fieldPackId:packId,intentDigest:intent.intentDigest,purpose:String(intent.purpose||'')},semanticAuthority:false,compatibilityProof:false,qualityProof:false},
      source:{packagePath:'organ.js',suggestedTargetPath:suggestedSourcePath,sourceBytes:sourceBytes,sourceSha256:sourceSha256,targetArchiveObjectIdIfImported:digest({sourcePath:suggestedSourcePath,sourceSha256:sourceSha256}).slice(7)},
      targetCompatibility:clone(ORGAN_ARCHIVE_BRIDGE),
      authority:archiveAuthority(),
      boundary:'This is a deterministic dormant-library projection for a hard-gate-valid detached candidate. It is not execution, connection, installation, runtime admission, implementation selection, promotion, a quality verdict, or CANON.'
    };
    const projection=Object.assign({},basis,{stashDigest:digest(basis)});
    return projection;
  }
  function verifyArchiveStashProjection(projection,candidate){
    const errors=[];
    if(!projection||projection.schema!=='axm.organ-archive-stash-projection/v1')errors.push(issue('STASH_SCHEMA_INVALID','$.schema','Expected dormant stash projection v1.'));
    else{
      if(projection.stashDigest!==digest(withoutKey(projection,'stashDigest')))errors.push(issue('STASH_DIGEST_MISMATCH','$.stashDigest','Dormant stash projection digest mismatch.'));
      if(!projection.validity||projection.validity.state!=='HARD_GATES_PASSED'||projection.validity.qualityClaim!==false)errors.push(issue('STASH_VALIDITY_INVALID','$.validity','Dormant stash validity must remain limited to hard-gate passage.'));
      if(!projection.archiveState||projection.archiveState.disposition!=='VALID_DORMANT_LIBRARY'||projection.archiveState.retentionPolicy!=='KEEP_WHEN_NO_CURRENT_USE'||projection.archiveState.admissionStatus!=='ARCHIVED_NOT_ADMITTED_TO_RUNTIME'||projection.archiveState.startupPolicy!=='DORMANT'||projection.archiveState.implementationStatus!=='UNSELECTED')errors.push(issue('STASH_NOT_DORMANT','$.archiveState','Archive projection gained an active or selected state.'));
      if(canonicalJson(projection.authority||{})!==canonicalJson(archiveAuthority()))errors.push(issue('STASH_AUTHORITY_EXCEEDED','$.authority','Dormant stash projection authority ceiling changed.'));
      if(!projection.purposeClassification||projection.purposeClassification.state!=='INFERRED_UNCONFIRMED'||projection.purposeClassification.semanticAuthority!==false||projection.purposeClassification.compatibilityProof!==false||projection.purposeClassification.qualityProof!==false)errors.push(issue('STASH_CLASSIFICATION_AUTHORITY_EXCEEDED','$.purposeClassification','Purpose shelves must remain inferred and non-authoritative.'));
      if(canonicalJson(projection.targetCompatibility||{})!==canonicalJson(ORGAN_ARCHIVE_BRIDGE))errors.push(issue('STASH_TARGET_LINEAGE_STALE','$.targetCompatibility','Organ Archive bridge lineage is not current.'));
      if(!projection.source||!/^organs\/[a-z0-9-]+-organ\.js$/.test(projection.source.suggestedTargetPath||'')||!/^[a-f0-9]{64}$/.test(projection.source.sourceSha256||'')||!/^[a-f0-9]{64}$/.test(projection.source.targetArchiveObjectIdIfImported||''))errors.push(issue('STASH_SOURCE_INVALID','$.source','Dormant source handoff identity is invalid.'));
      if(candidate){try{const rebuilt=projectArchiveStash(candidate);if(canonicalJson(rebuilt)!==canonicalJson(projection))errors.push(issue('STASH_REBUILD_DRIFT','$','Dormant stash projection does not reproduce from its candidate.'));}catch(error){errors.push(issue('STASH_CANDIDATE_INVALID','$',String(error.message||error)));}}
    }
    return {schema:'axm.organ-archive-stash-verification/v1',ok:errors.length===0,errors:errors,stashDigest:projection&&projection.stashDigest||null};
  }
  function buildArchiveStashEnvelope(candidate,projection){
    const stash=projection||projectArchiveStash(candidate),check=verifyArchiveStashProjection(stash,candidate);
    if(!check.ok)throw new Error('Dormant stash envelope refused: '+canonicalJson(check.errors));
    const basis={
      schema:'axm.organ-archive-stash-envelope/v1',status:'EXPERIMENTAL',envelopeKind:'DORMANT_ORGAN_SOURCE_HANDOFF',
      sourcePackage:{packageDigest:candidate.package.packageDigest,candidateId:candidate.package.id,definitionDigest:candidate.definition.definitionDigest,evaluationDigest:candidate.evaluation.receiptDigest},
      stashProjection:clone(stash),
      sourceArtifact:{path:stash.source.suggestedTargetPath,bytes:stash.source.sourceBytes,sha256:stash.source.sourceSha256,content:candidate.files['organ.js']},
      target:{moduleId:ORGAN_ARCHIVE_BRIDGE.moduleId,version:ORGAN_ARCHIVE_BRIDGE.version,contractCanonicalDigest:ORGAN_ARCHIVE_BRIDGE.contractCanonicalDigest,acceptance:'EXPLICIT_HOST_IMPORT_AND_NORMAL_ARCHIVE_GATES_REQUIRED'},
      authority:archiveAuthority(),
      boundary:'This portable envelope is review material. A receiving host must explicitly place and scan the source through its normal archive gates; this envelope never writes to Mirror and grants no load, execution, connection, admission, installation, selection, promotion, or CANON authority.'
    };
    return Object.assign({},basis,{envelopeDigest:digest(basis)});
  }
  function parseSentence(sentence,packs,preferredPackId){
    const text=String(sentence||'').trim(),lower=text.toLowerCase();
    if(!text)return {schema:'axm.organ-intent-preview/v1',status:'PREVIEW_REQUIRED',draft:null,unresolved:[{code:'PURPOSE_MISSING',message:'Describe the organ purpose.'}],warnings:[]};
    let matches=(packs||[]).filter(function(pack){return pack.vocabulary.some(function(term){return lower.indexOf(String(term).toLowerCase())>=0;});});
    if(preferredPackId&&matches.length>1){const preferred=matches.find(function(pack){return pack.id===preferredPackId;});if(preferred)matches=[preferred];}
    if(matches.length!==1)return {schema:'axm.organ-intent-preview/v1',status:'PREVIEW_REQUIRED',draft:null,unresolved:[{code:matches.length?'AMBIGUOUS_FIELD':'UNKNOWN_FIELD',message:matches.length?'Sentence matches multiple fields; choose one.':'No field-pack vocabulary matched; choose a field pack and define typed ports.'}],warnings:['The importer never guesses missing types or ambiguous clauses.']};
    const pack=matches[0],draft=clone(pack.exampleIntent);draft.purpose=text;draft.name=draft.name+' preview';draft.id=draft.id+'-preview';
    return {schema:'axm.organ-intent-preview/v1',status:'PREVIEW_REQUIRED',pack:{id:pack.id,version:pack.version,digest:pack.packDigest},draft:sealIntent(draft,pack),unresolved:[{code:'HUMAN_CONFIRMATION_REQUIRED',message:'Confirm typed ports, cases, invariants, boundaries, and budgets before generation.'}],warnings:['Vocabulary prefills structure only; it does not infer new clauses.']};
  }
  function importProposal(envelope,pack){
    const errors=[];
    if(!allowedKeys(envelope,['schema','sourceKind','proposal','proposalDigest'],'$',errors))return {ok:false,errors:errors};
    required(envelope,['schema','sourceKind','proposal','proposalDigest'],'$',errors);
    if(envelope.schema!=='axm.organ-proposal-adapter/v1')errors.push(issue('SCHEMA_MISMATCH','$.schema','Expected proposal adapter v1.'));
    if(['AI','EXTERNAL'].indexOf(envelope.sourceKind)<0)errors.push(issue('PROPOSAL_SOURCE_INVALID','$.sourceKind','Source must be AI or EXTERNAL.'));
    if(envelope.proposalDigest!==digest(envelope.proposal))errors.push(issue('PROPOSAL_DIGEST_MISMATCH','$.proposalDigest','Proposal digest mismatch.'));
    if(errors.length)return {ok:false,errors:errors};
    const normalized=sealIntent(envelope.proposal,pack),check=validateIntent(normalized,pack);
    return {ok:check.ok,status:check.ok?'NORMALIZED_UNTRUSTED_PROPOSAL':'REFUSED',intent:normalized,errors:check.errors,requiresNormalGates:true,providerCalled:false};
  }

  return {
    FACTORY_VERSION:FACTORY_VERSION,RUNTIME_ID:RUNTIME_ID,RUNTIME_VERSION:RUNTIME_VERSION,RUNTIME_DIGEST:RUNTIME_DIGEST,
    LIMITS:LIMITS,METRIC_PROFILE:METRIC_PROFILE,STRATEGIES:STRATEGIES,ALLOWED_OPERATIONS:ALLOWED_OPERATIONS,
    canonicalJson:canonicalJson,digest:digest,clone:clone,sealIntent:sealIntent,validateIntent:validateIntent,validatePack:validatePack,
    validateGraph:validateGraph,executeGraph:executeGraph,runDefinition:runDefinition,makeDefinition:makeDefinition,evaluateDefinition:evaluateDefinition,
    buildPackage:buildPackage,verifyPackage:verifyPackage,generateCandidates:generateCandidates,compareCandidates:compareCandidates,
    selectCandidate:selectCandidate,parseSentence:parseSentence,importProposal:importProposal,portSchema:portSchema,
    ORGAN_ARCHIVE_BRIDGE:ORGAN_ARCHIVE_BRIDGE,projectArchiveStash:projectArchiveStash,verifyArchiveStashProjection:verifyArchiveStashProjection,buildArchiveStashEnvelope:buildArchiveStashEnvelope
  };
});
