import { accessorData, parseGlb } from '../local-3d-game-runtime/native-glb.mjs';

export const VERIFIER_SCHEMA = 'axm.rig-retarget-verification/v1';

async function digest(buffer) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function check(id, label, passed, evidence) { return { id, label, status: passed ? 'pass' : 'fail', evidence }; }
function independentWeightCheck(model) {
  let vertices = 0, invalid = 0, maxDelta = 0;
  for (const mesh of model.document.meshes || []) for (const primitive of mesh.primitives || []) {
    if (primitive.attributes?.WEIGHTS_0 === undefined) continue;
    const weights = accessorData(model, primitive.attributes.WEIGHTS_0);
    for (let index = 0; index < weights.count; index += 1) {
      const offset = index * 4;
      const sum = weights.array[offset] + weights.array[offset + 1] + weights.array[offset + 2] + weights.array[offset + 3];
      const delta = Math.abs(1 - sum);
      vertices += 1; maxDelta = Math.max(maxDelta, delta);
      if (!Number.isFinite(sum) || delta > .001) invalid += 1;
    }
  }
  return { vertices, invalid, maxDelta };
}
function durations(model) {
  return (model.document.animations || []).map(animation => Math.max(0, ...animation.samplers.map(sampler => {
    const input = accessorData(model, sampler.input);
    return input.array[input.array.length - 1] || 0;
  })));
}

export async function verifyRetargetBundle(arrayBuffer, bundle, expected) {
  const model = parseGlb(arrayBuffer), sha = await digest(arrayBuffer), skin = model.document.skins?.[0];
  const jointNames = (skin?.joints || []).map(index => model.document.nodes[index]?.name || `joint-${index}`);
  const weights = independentWeightCheck(model), sourceDurations = durations(model), mapped = bundle.mapping || [];
  const profiles = Object.fromEntries((bundle.profiles || []).map(item => [item.id, item]));
  const metrics = (bundle.clips || []).flatMap(clip => Object.values(clip.profiles || {}));
  const canonical = new Set(mapped.map(item => item.canonicalRole));
  const checks = [
    check('schema', 'Known retarget bundle schema', bundle.schema === 'axm.rig-retarget-bundle/v1', bundle.schema || 'missing'),
    check('digest', 'Bundle binds to exact source bytes', sha === expected.sha256 && bundle.source?.sha256 === sha, sha),
    check('byte-length', 'Bundle binds to exact source length', bundle.source?.byteLength === arrayBuffer.byteLength && expected.byteLength === arrayBuffer.byteLength, `${arrayBuffer.byteLength} bytes`),
    check('mapping', 'Every source joint maps exactly once', jointNames.length === mapped.length && jointNames.every((name, index) => mapped[index]?.sourceName === name && mapped[index]?.canonicalRole) && canonical.size === mapped.length, `${mapped.length}/${jointNames.length} mapped`),
    check('clips', 'All source clips are represented', sourceDurations.length === bundle.clips?.length && sourceDurations.every((value, index) => Math.abs(value - bundle.clips[index].duration) < 1e-5), `${bundle.clips?.length || 0}/${sourceDurations.length} clips`),
    check('proportions', 'Two genuinely distinct target bodies exist', profiles.tall?.height > profiles.source?.height && profiles.compact?.height < profiles.source?.height && profiles.tall.restPoseChanges.length === mapped.length && profiles.compact.restPoseChanges.length === mapped.length, `${profiles.compact?.height?.toFixed(4)} < ${profiles.source?.height?.toFixed(4)} < ${profiles.tall?.height?.toFixed(4)} rig units`),
    check('weights', 'Independent skin-weight sums stay normalized', weights.invalid === 0 && bundle.weights?.invalidVertices === 0 && bundle.weights?.vertices === weights.vertices && Math.abs(bundle.weights.maxNormalizationDelta - weights.maxDelta) < 1e-8, `${weights.vertices} vertices · max Δ ${weights.maxDelta.toExponential(2)}`),
    check('metrics', 'Every target clip has finite measured contact and joint error', metrics.length === sourceDurations.length * 2 && metrics.every(item => Number.isFinite(item.footSlideCmPerSecond) && item.footSlideCmPerSecond >= 0 && Number.isFinite(item.maxJointAngularErrorDegrees) && item.samples >= 2), `${metrics.length} measured target clips`),
    check('ik-constraints', 'IK targets and constraints resolve to canonical joints', [...(bundle.ik?.feet || []), ...(bundle.ik?.kneePoles || []), ...(bundle.constraints || []).flatMap(item => item.joints)].every(role => canonical.has(role)), 'Feet, knee poles, knees and elbows resolve'),
    check('sockets', 'Gameplay sockets resolve to mapped joints', (bundle.sockets || []).length >= 3 && (bundle.sockets || []).every(item => canonical.has(item.joint)), `${bundle.sockets?.length || 0} sockets`),
    check('human-gate', 'Extreme-pose review remains human', bundle.humanReview?.required === true && bundle.humanReview?.approved === false, 'Approval is false')
  ];
  const failed = checks.filter(item => item.status === 'fail').length;
  return { schema: VERIFIER_SCHEMA, assetId: bundle.assetId, sourceSha256: sha, status: failed ? 'blocked' : 'pass', summary: { passed: checks.length - failed, failed, checks: checks.length }, checks };
}
