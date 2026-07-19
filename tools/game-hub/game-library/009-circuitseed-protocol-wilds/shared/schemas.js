'use strict';

module.exports = Object.freeze({
  inputPacket: Object.freeze({
    schema: 'axm-semantic-input-v1',
    required: ['roomCode','sessionId','seatId','token','seq','input'],
    authority: 'intention-only'
  }),
  observation: Object.freeze({
    schema: 'axm-seat-screen-semantics-v1',
    scope: 'same-party-shared-screen-only',
    forbidden: ['tokens','worldSeed','hiddenPoints','futureState','authorityInternals']
  }),
  missionEnvelope: Object.freeze({
    schema: 'axm.circuitseed-mission-envelope/v1',
    commits: ['participant-rewards','host-world-consequences'],
    separateCommitReceipts: true
  }),
  profile: Object.freeze({ schema: 'axm.circuitseed-router-profile/v1', owner: 'participant' }),
  world: Object.freeze({ schema: 'axm.circuitseed-world-save/v1', owner: 'host' }),
  ledger: Object.freeze({ schema: 'axm.circuitseed-session-ledger/v1', appendOnly: true, hashChain: 'sha256' })
});
