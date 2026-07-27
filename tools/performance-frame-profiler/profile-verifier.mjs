import { percentile, sha256Bytes } from './profile-core.mjs';

export const VERIFIER_SCHEMA = 'axm.frame-profile-verification/v1';
function close(a, b, tolerance = .0001) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance; }
function check(id, label, passed, evidence) { return { id, label, status: passed ? 'pass' : 'fail', evidence }; }

export async function verifyProfileSuite(suite, screenshotBytesByMode = {}) {
  const runChecks = await Promise.all(suite.runs.map(async run => {
    const values = run.samples.map(sample => sample.cpuTotalMs);
    const worst = run.samples.reduce((result, sample) => !result || sample.cpuTotalMs > result.cpuTotalMs ? sample : result, null);
    const screenshot = screenshotBytesByMode[run.mode];
    const screenshotSha = screenshot ? await sha256Bytes(screenshot) : null;
    return {
      mode: run.mode,
      window: run.window.warmupFrames > 0 && run.window.measurementFrames === run.samples.length && run.window.measurementFrameRange[0] > run.window.warmupFrameRange[1],
      percentiles: close(run.stages.cpuTotalMs.p50, percentile(values, .5)) && close(run.stages.cpuTotalMs.p95, percentile(values, .95)) && close(run.stages.cpuTotalMs.worst, Math.max(...values)),
      worst: run.worstFrame.frameIndex === worst.frameIndex && close(run.worstFrame.cpuTotalMs, worst.cpuTotalMs),
      screenshot: !!screenshot && run.screenshot?.sha256 === screenshotSha && run.screenshot?.timingFrameIndex === run.worstFrame.frameIndex && run.screenshot?.byteLength === screenshot.byteLength,
      resources: run.samples.every(sample => Number.isFinite(sample.draws) && Number.isFinite(sample.triangles) && Number.isFinite(sample.textureUploadBytes) && Number.isFinite(sample.overdrawProxy))
    };
  }));
  const checks = [
    check('schema', 'Known profile-suite schema', suite.schema === 'axm.frame-profile-suite/v1', suite.schema || 'missing'),
    check('modes', 'Native and post-processed runs both exist', ['native','post'].every(mode => suite.runs.some(run => run.mode === mode)), suite.runs.map(run => run.mode).join(' · ')),
    check('windows', 'Warm-up and measurement windows are disjoint', runChecks.every(item => item.window), suite.runs.map(run => `${run.mode} ${run.window.warmupFrames}+${run.window.measurementFrames}`).join(' · ')),
    check('percentiles', 'P50, P95, and worst recompute from retained samples', runChecks.every(item => item.percentiles), 'Independent percentile recompute'),
    check('worst-link', 'Worst timing rows point to exact retained samples', runChecks.every(item => item.worst), 'Frame index and CPU total match'),
    check('screenshots', 'Each worst-frame replay image binds to its timing receipt', runChecks.every(item => item.screenshot), runChecks.map(item => `${item.mode}:${item.screenshot ? 'bound' : 'missing'}`).join(' · ')),
    check('overhead', 'Profiler overhead and capture exclusion are declared', Number.isFinite(suite.metadata?.profilerOverheadMicroseconds) && suite.metadata.profilerOverheadMicroseconds >= 0 && suite.metadata.capturePolicy === 'deterministic-worst-state-replay-outside-window', `${suite.metadata?.profilerOverheadMicroseconds?.toFixed(2)} µs/frame`),
    check('gpu', 'GPU timing is measured or explicitly unsupported', suite.runs.every(run => ['measured','unsupported'].includes(run.gpu.status)), suite.runs.map(run => `${run.mode}:${run.gpu.status}`).join(' · ')),
    check('resources', 'Draws, triangles, texture traffic, and overdraw proxy exist on every frame', runChecks.every(item => item.resources), 'All samples carry resource counters'),
    check('overdraw-boundary', 'Overdraw is labelled as a proxy, not a hardware counter', suite.metadata?.overdrawMethod === 'draw-and-triangle-screen-pressure-proxy' && suite.metadata?.overdrawClaim === 'proxy-not-pixel-exact', suite.metadata?.overdrawClaim || 'missing')
  ];
  const failed = checks.filter(item => item.status === 'fail').length;
  return { schema: VERIFIER_SCHEMA, status: failed ? 'blocked' : 'pass', summary: { passed: checks.length - failed, failed, checks: checks.length }, checks };
}
