import { accessorData, createRuntimeScene, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';

export const VERIFICATION_SCHEMA = 'axm.technical-art-verification/v1';
const required = ['identity','topology','transforms','naming','pivots','uvs','maps','materials','rig','animation','lod','collision','bounds-budget','visual-quality'];

async function digestHex(buffer) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function check(id, label, passed, evidence) { return { id, label, status: passed ? 'pass' : 'fail', evidence }; }
function independentFacts(buffer) {
  const model = parseGlb(buffer), document = model.document;
  let triangles = 0, vertices = 0, primitives = 0, uv0Primitives = 0, uv1Primitives = 0;
  for (const mesh of document.meshes || []) for (const primitive of mesh.primitives || []) {
    primitives += 1;
    const positionIndex = primitive.attributes?.POSITION;
    if (positionIndex !== undefined) vertices += accessorData(model, positionIndex).count;
    if (primitive.attributes?.TEXCOORD_0 !== undefined) uv0Primitives += 1;
    if (primitive.attributes?.TEXCOORD_1 !== undefined) uv1Primitives += 1;
    triangles += Math.floor((primitive.indices === undefined ? (positionIndex === undefined ? 0 : accessorData(model, positionIndex).count) : accessorData(model, primitive.indices).count) / 3);
  }
  return { triangles, vertices, primitives, uv0Primitives, uv1Primitives, nodes:(document.nodes||[]).length, meshes:(document.meshes||[]).length, materials:(document.materials||[]).length, images:(document.images||[]).length, skins:(document.skins||[]).length, animations:(document.animations||[]).length, bounds:createRuntimeScene(model).bounds };
}
function same(a,b){ return JSON.stringify(a) === JSON.stringify(b); }

export async function verifyTechnicalReport(arrayBuffer, report, expected) {
  const actualSha = await digestHex(arrayBuffer), facts = independentFacts(arrayBuffer);
  const ids = (report.categories || []).map(item => item.id);
  const visual = (report.categories || []).find(item => item.id === 'visual-quality');
  const visualPassClaim = visual?.status === 'pass' || (visual?.checks || []).some(item => item.status === 'pass');
  const missingProofPass = (report.categories || []).filter(item => ['pivots','lod','collision'].includes(item.id)).flatMap(item => item.checks || []).some(item => item.status === 'pass' && /missing|not attached|\bno\b.*receipt/i.test(String(item.evidence)));
  const claimedStatus = report.summary?.blockers ? 'blocked' : report.summary?.repairs ? 'repair' : 'technical-pass';
  const checks = [
    check('schema', 'Known report schema', report.schema === 'axm.technical-art-report/v1', report.schema || 'missing'),
    check('actual-digest', 'Bytes match expected digest', actualSha === expected.sha256, `${actualSha.slice(0,16)}…`),
    check('claimed-digest', 'Report binds to these bytes', report.sourceSha256 === actualSha, report.sourceSha256 || 'missing'),
    check('byte-length', 'Report binds to exact byte length', report.sourceByteLength === arrayBuffer.byteLength && expected.byteLength === arrayBuffer.byteLength, `${arrayBuffer.byteLength} bytes`),
    check('category-completeness', 'Every required category exists exactly once', required.every(id => ids.filter(value => value === id).length === 1) && ids.length === required.length, `${ids.length}/${required.length} categories`),
    check('source-facts', 'Independent geometry and structure recount agrees', ['triangles','vertices','primitives','uv0Primitives','uv1Primitives','nodes','meshes','materials','images','skins','animations'].every(key => report.facts?.[key] === facts[key]), `${facts.triangles} triangles · ${facts.nodes} nodes`),
    check('bounds', 'Independent bounds agree', same(report.facts?.bounds, facts.bounds), `size ${facts.bounds.size.map(value => value.toFixed(3)).join(' × ')} m`),
    check('status-derivation', 'Top-level status follows category counts', report.status === claimedStatus, `${report.status} / ${claimedStatus}`),
    check('no-unverified', 'No technical check claims an untyped state', (report.categories || []).flatMap(item => item.checks || []).every(item => ['pass','repair','blocked','human-review'].includes(item.status)), 'Typed pass, repair, blocked, or human-review only'),
    check('fail-closed', 'Missing proof cannot be relabeled pass', !missingProofPass, missingProofPass ? 'Fabricated pass detected' : 'No impossible pass'),
    check('visual-boundary', 'Visual quality remains a human gate', visual?.status === 'human-review' && !visualPassClaim && report.promotion === 'not-approved', visual?.status || 'missing')
  ];
  const failed = checks.filter(item => item.status === 'fail').length;
  return { schema: VERIFICATION_SCHEMA, assetId: report.assetId, sourceSha256: actualSha, status: failed ? 'blocked' : 'pass', summary: { passed: checks.length - failed, failed, checks: checks.length }, checks };
}
