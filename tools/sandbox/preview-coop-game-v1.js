'use strict';

const fs = require('fs');
const path = require('path');
const Generator = require('../../shared/code-capability-fabric/deterministic-game-candidate-generator-v1');
const Sandbox = require('./disposable-candidate-sandbox-v1');

async function main() {
  const request = Generator.buildCoopExampleRequest();
  const generationResult = Generator.generate(request);
  const sessionOptions = {
    parentRoot: Sandbox.SANDBOX_STATE_ROOT,
    sessionId: 'twin-reactor-coop-v2-20-review-r4',
    request,
    generationResult
  };
  const session = fs.existsSync(path.join(sessionOptions.parentRoot, sessionOptions.sessionId))
    ? Sandbox.resumeSession(sessionOptions)
    : Sandbox.createSession(sessionOptions);
  const preview = await Sandbox.startPreview(session);
  process.stdout.write(JSON.stringify({
    schema: 'axm.sandbox-preview-start/v1', status: 'TEST', url: preview.url,
    sessionId: session.sessionId, candidateRef: session.receipt.candidateRef,
    iteration: preview.iteration, requiredSeats: generationResult.packet.moduleBundle.requiredSeats,
    candidateProcesses: preview.candidateProcesses, network: 'DISABLED', persistence: 'SESSION_ONLY',
    installed: false, integrated: false, promoted: false, canonChanged: false, authority: 'NONE'
  }) + '\n');
  const stop = async () => { await preview.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
