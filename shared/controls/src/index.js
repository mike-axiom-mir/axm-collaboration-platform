'use strict';

module.exports = {
  intent: require('./shared/intent'),
  inputGate: require('./host/seat-input-gate'),
  observation: require('./host/screen-observation'),
  browserModules: Object.freeze({
    virtualStick: 'src/browser/axm-virtual-stick.mjs',
    controllerRuntime: 'src/browser/axm-controller-runtime.mjs',
  }),
  connectedAiModule: 'src/ai/connected-ai-client.mjs',
};
