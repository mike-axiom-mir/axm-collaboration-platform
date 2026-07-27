'use strict';

const registry = require('./registry.json');
module.exports = {
  registry,
  envelope: require('./receipt-envelope'),
  runtime: require('./runtime-route'),
  staticEye: require('./host-mediated-static-eye'),
  ears: require('./ears-stream-listener'),
  timeSense: require('./time-sense-ttl-verifier'),
  touch: require('./touch-environment-probe'),
  handoff: require('./handoff-continuity-steward'),
  compaction: require('./compaction-steward'),
  drift: require('./drift-detector-ambient'),
  corroboration: require('./corroboration-triangulator'),
  interoception: require('./interoception-capacity-gauge'),
  taintSniffer: require('./taint-sniffer'),
  eyeChangeDiffer: require('./eye-change-differ'),
  eyeAccessibility: require('./eye-accessibility-inspector'),
  eye: require('../ai-native-hands/ephemeral-vision-hand'),
  coordinator: require('./coordinator'),
  adapterContract: require('./adapter-contract'),
  capabilityGapRouter: require('./capability-gap-router'),
  freshnessScheduler: require('./freshness-scheduler'),
  retentionJanitor: require('./retention-janitor'),
  sessionCloser: require('./session-closer'),
  evidenceCompactor: require('./evidence-compactor'),
  regressionCandidateWriter: require('./regression-memory-candidate-writer'),
  knownRepairRouter: require('./known-repair-router'),
  technicalGlassesFeed: require('./technical-glasses-feed'),
  driftBaselineUpdater: require('./drift-safe-baseline-updater'),
  releasePackager: require('./release-packager'),
  unattendedController: require('./unattended-sensing-controller')
};
