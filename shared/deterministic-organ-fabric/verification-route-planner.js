'use strict';

const core = require('./core.js');
const softwarePack = require('./field-packs/software-workshop.json');

function planVerificationRoute(candidate, input) { return core.planVerificationRouteForPack(candidate, input, softwarePack); }
function verifyVerificationRoutePlan(plan, candidate, input) { return core.verifyVerificationRoutePlanForPack(plan, candidate, input, softwarePack); }

module.exports = { planVerificationRoute:planVerificationRoute, verifyVerificationRoutePlan:verifyVerificationRoutePlan, normalizeBrief:core.normalizeVerificationBrief };
