(function (root, factory) {
  'use strict';
  var hand = typeof module !== 'undefined' && module.exports
    ? require('../../shared/ai-native-hands/capability-gap-hand')
    : root.AXMCapabilityGapHand;
  var api = factory(hand);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMCapabilityGapWorkbenchCore = api;
})(typeof self !== 'undefined' ? self : this, function (CapabilityGapHand) {
  'use strict';

  var MAX_SOURCE_LENGTH = 250000;
  var EXAMPLE_REQUIREMENTS = {
    requirements: [
      {
        id: 'bounded-capability-review',
        capabilities: ['capability.compare.requirements/v1', 'report.json.download/v1'],
        required: true,
        gapType: 'HAND'
      },
      {
        id: 'live-visual-countercheck',
        capabilities: ['visual.capture.live'],
        required: false,
        gapType: 'EVIDENCE'
      },
      {
        id: 'durable-evidence-archive',
        capabilities: ['evidence.archive.persist/v1'],
        required: false,
        gapType: 'AUTHORITY'
      }
    ]
  };
  var EXAMPLE_INVENTORY = {
    capabilities: [
      {
        id: 'capability.compare.requirements/v1',
        status: 'available',
        constraints: ['exact identifier and declared status comparison only']
      },
      {
        id: 'report.json.download/v1',
        status: 'available',
        constraints: ['explicit human-triggered browser download']
      },
      {
        id: 'visual.capture.live',
        status: 'degraded',
        constraints: ['in-app browser surface only']
      }
    ]
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseDocument(source, collectionName) {
    var text = String(source == null ? '' : source).trim();
    if (!text) throw new Error(collectionName + ' JSON is empty');
    if (text.length > MAX_SOURCE_LENGTH) throw new Error(collectionName + ' JSON exceeds the 250,000 character limit');
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(collectionName + ' JSON is invalid: ' + error.message);
    }
    var collection = Array.isArray(parsed) ? parsed : parsed && parsed[collectionName];
    if (!Array.isArray(collection)) {
      throw new Error(collectionName + ' JSON must be an array or an object with a ' + collectionName + ' array');
    }
    return collection;
  }

  function analyze(requirementsSource, inventorySource, generatedAt) {
    if (!CapabilityGapHand || typeof CapabilityGapHand.compare !== 'function') {
      throw new Error('Capability Gap hand is unavailable');
    }
    var requirements = parseDocument(requirementsSource, 'requirements');
    var capabilities = parseDocument(inventorySource, 'capabilities');
    var report = CapabilityGapHand.compare(requirements, capabilities);
    var at = generatedAt ? new Date(generatedAt) : new Date();
    if (Number.isNaN(at.getTime())) throw new Error('generatedAt must be a valid date');
    report.workbench = {
      id: 'capability-gap-workbench',
      version: 'v0.1',
      generatedAt: at.toISOString(),
      requirementCount: requirements.length,
      inventoryCount: capabilities.length,
      exactIdentifierComparison: true,
      declarationsAreRuntimeProof: false
    };
    return report;
  }

  function downloadName(generatedAt) {
    var at = new Date(generatedAt);
    if (Number.isNaN(at.getTime())) throw new Error('generatedAt must be a valid date');
    return 'axm-capability-gap-report-' + at.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z') + '.json';
  }

  function example() {
    return {
      requirements: JSON.stringify(clone(EXAMPLE_REQUIREMENTS), null, 2),
      inventory: JSON.stringify(clone(EXAMPLE_INVENTORY), null, 2)
    };
  }

  return {
    MAX_SOURCE_LENGTH: MAX_SOURCE_LENGTH,
    parseDocument: parseDocument,
    analyze: analyze,
    downloadName: downloadName,
    example: example
  };
});
