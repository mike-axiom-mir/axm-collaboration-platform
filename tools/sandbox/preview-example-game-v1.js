'use strict';

const Generator = require('../../shared/code-capability-fabric/deterministic-game-candidate-generator-v1');
const Sandbox = require('./disposable-candidate-sandbox-v1');

async function main() {
  const request = Generator.buildExampleRequest();
  const generationResult = Generator.generate(request);
  const sessionOptions = {
    parentRoot: Sandbox.SANDBOX_STATE_ROOT,
    sessionId: 'four-roots-run-v1-review',
    request,
    generationResult
  };
  const session = require('fs').existsSync(require('path').join(sessionOptions.parentRoot, sessionOptions.sessionId))
    ? Sandbox.resumeSession(sessionOptions)
    : Sandbox.createSession(sessionOptions);
  const preview = await Sandbox.startPreview(session);
  process.stdout.write(JSON.stringify({
    schema: 'axm.sandbox-preview-start/v1',
    status: 'TEST',
    url: preview.url,
    sessionId: session.sessionId,
    candidateRef: session.receipt.candidateRef,
    iteration: preview.iteration,
    candidateProcesses: preview.candidateProcesses,
    installed: false,
    integrated: false,
    authority: 'NONE'
  }) + '\n');
  const stop = async () => { await preview.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
