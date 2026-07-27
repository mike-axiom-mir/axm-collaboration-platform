import { imageBytes, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';

export const TEXTURE_SET_SCHEMA = 'axm.external-texture-set-verification/v1';
async function digestHex(buffer) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function verifyExternalTextureSet(sourceBuffer, sourceMeta, payloadsByUri = {}, expectedDigestsByUri = {}) {
  const sourceSha256 = await digestHex(sourceBuffer), model = parseGlb(sourceBuffer), files = [];
  const checks = [{ id:'source', status:sourceSha256 === sourceMeta.sha256 ? 'pass' : 'fail', evidence:sourceSha256 }];
  for (let index = 0; index < (model.document.images || []).length; index += 1) {
    const embedded = imageBytes(model, index), image = model.document.images[index];
    if (embedded) { files.push({ index, kind:'embedded', byteLength:embedded.bytes.byteLength, mimeType:embedded.mimeType }); continue; }
    const buffer = payloadsByUri[image.uri], expected = expectedDigestsByUri[image.uri];
    if (!buffer || !expected) { checks.push({ id:`image-${index}`, status:'fail', evidence:`Missing independently supplied bytes or digest for ${image.uri || 'unnamed URI'}` }); continue; }
    const actual = await digestHex(buffer), passed = actual === expected;
    checks.push({ id:`image-${index}`, status:passed ? 'pass' : 'fail', evidence:`${image.uri} ${actual}` });
    files.push({ index, kind:'same-origin-external', uri:image.uri, sha256:actual, expectedSha256:expected, byteLength:buffer.byteLength, verified:passed });
  }
  const failed = checks.filter(check => check.status === 'fail').length;
  return { schema:TEXTURE_SET_SCHEMA, sourceSha256, status:failed ? 'blocked' : 'pass', files, summary:{images:(model.document.images || []).length,external:files.filter(file=>file.kind==='same-origin-external').length,failed},checks };
}
