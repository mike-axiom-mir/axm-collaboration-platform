'use strict';

const assert = require('assert');
const path = require('path');
const Fabric = require('./identity-shell-fabric');
const Independent = require('./independent-verifier');

const origin = require(path.join(__dirname, 'examples', 'keel-workshop-collaborator', 'keel-workshop-collaborator.manifest.json'));

function copy(value) {
  return Fabric.clone(value);
}

function resignManifest(value) {
  const payload = copy(value);
  delete payload.manifestDigest;
  value.manifestDigest = Fabric.sha256(payload);
  return value;
}

function resignDescriptor(value, index) {
  value.components[index].descriptorRef.sha256 = Fabric.sha256(value.components[index].descriptor);
  return resignManifest(value);
}

function resignContinuity(value) {
  const payload = copy(value.continuity);
  delete payload.stateDigest;
  value.continuity.stateDigest = Fabric.sha256(payload);
  return resignManifest(value);
}

function resignLineage(value) {
  const payload = copy(value.lineageReceipt);
  delete payload.receiptDigest;
  value.lineageReceipt.receiptDigest = Fabric.sha256(payload);
  return resignManifest(value);
}

function fabricVerdict(value) {
  try {
    Fabric.verifyManifest(value);
    return { verdict: 'PASS', code: null };
  } catch (error) {
    return { verdict: 'FAIL', code: error.code || error.name || 'ERROR' };
  }
}

function independentVerdict(value) {
  const result = Independent.verify(value);
  return { verdict: result.verdict, errors: result.errors };
}

function operationVerdict(operation) {
  try {
    operation();
    return { verdict: 'PASS', code: null };
  } catch (error) {
    return { verdict: 'FAIL', code: error.code || error.name || 'ERROR' };
  }
}

function componentIndex(value, kind) {
  return value.components.findIndex(component => component.kind === kind);
}

const attacks = [
  {
    id: 'missing-body-shell',
    mutate(value) {
      const adapter = copy(value.components[componentIndex(value, 'ADAPTER')]);
      const replacement = copy(adapter);
      replacement.slotId = 'body-slot';
      value.components = [replacement, adapter];
      return resignManifest(value);
    }
  },
  {
    id: 'missing-adapter-shell',
    mutate(value) {
      const body = copy(value.components[componentIndex(value, 'BODY')]);
      const replacement = copy(body);
      replacement.slotId = 'reasoner-slot';
      value.components = [body, replacement];
      return resignManifest(value);
    }
  },
  {
    id: 'unauthorized-component-permission',
    mutate(value) {
      const index = componentIndex(value, 'ADAPTER');
      value.components[index].descriptor.requestedPermissions = ['proposal.emit', 'shell.admin'];
      return resignDescriptor(value, index);
    }
  },
  {
    id: 'component-resource-expansion',
    mutate(value) {
      const index = componentIndex(value, 'ADAPTER');
      value.components[index].descriptor.resourceRequest.computeUnits = value.resourceEnvelope.compute.permitted + 1;
      return resignDescriptor(value, index);
    }
  },
  {
    id: 'empty-continuity-with-history',
    mutate(value) {
      const receipt = Fabric.sha256('corpus-false-history');
      value.continuity.acceptedReceiptDigests = [receipt];
      value.continuity.effectiveAcceptedReceiptDigests = [receipt];
      return resignContinuity(value);
    }
  },
  {
    id: 'lineage-state-event-mismatch',
    mutate(value) {
      value.lineageReceipt.state = 'FORK_RECORDED';
      return resignLineage(value);
    }
  },
  {
    id: 'continuity-retention-overflow',
    mutate(value) {
      const receipt = Fabric.sha256('corpus-retention-overflow');
      value.continuityPolicy.retention.maxAcceptedReceipts = 0;
      value.continuity.state = 'RECONSTRUCTED';
      value.continuity.headReceiptDigest = receipt;
      value.continuity.acceptedReceiptDigests = [receipt];
      value.continuity.candidateReceiptDigests = [];
      value.continuity.effectiveAcceptedReceiptDigests = [receipt];
      return resignContinuity(value);
    }
  },
  {
    id: 'acceptance-policy-expansion',
    mutate(value) {
      value.continuityPolicy.acceptedEventTypes = ['ORIGIN'];
      return resignManifest(value);
    }
  },
  {
    id: 'noncanonical-identity-order',
    mutate(value) {
      value.identityRoot.display.tags.reverse();
      return resignManifest(value);
    }
  },
  {
    id: 'invalid-contract-token',
    mutate(value) {
      const index = componentIndex(value, 'ADAPTER');
      value.components[index].descriptor.contracts.accepts = ['invalid contract token'];
      return resignDescriptor(value, index);
    }
  },
  {
    id: 'orphan-lineage-continuity-evidence',
    mutate(value) {
      value.lineageReceipt.continuityEvidenceRefs = [{
        id: 'orphan-evidence',
        schema: 'axm.identity-shell.continuity-event/v1',
        sha256: Fabric.sha256('corpus-orphan-evidence')
      }];
      return resignLineage(value);
    }
  },
  {
    id: 'duplicate-descriptor-identity',
    mutate(value) {
      const bodyIndex = componentIndex(value, 'BODY');
      const adapterIndex = componentIndex(value, 'ADAPTER');
      value.components[bodyIndex].descriptor.descriptorId = value.components[adapterIndex].descriptor.descriptorId;
      value.components[bodyIndex].descriptorRef.id = value.components[bodyIndex].descriptor.descriptorId;
      return resignDescriptor(value, bodyIndex);
    }
  },
  {
    id: 'noncanonical-component-order',
    mutate(value) {
      value.components.reverse();
      return resignManifest(value);
    }
  },
  {
    id: 'windows-reserved-slot-alias',
    mutate(value) {
      value.components[componentIndex(value, 'ADAPTER')].slotId = 'con';
      return resignManifest(value);
    }
  },
  {
    id: 'unicode-normalization-alias',
    mutate(value) {
      value.identityRoot.display.label = 'Cafe\u0301 collaborator shell';
      return resignManifest(value);
    }
  },
  {
    id: 'retention-schema-ceiling-expansion',
    mutate(value) {
      value.continuityPolicy.retention.maxAcceptedReceipts = 257;
      return resignManifest(value);
    }
  },
  {
    id: 'effective-history-reordered',
    mutate(value) {
      const first = Fabric.sha256('corpus-accepted-first');
      const second = Fabric.sha256('corpus-accepted-second');
      value.continuity.state = 'RECONSTRUCTED';
      value.continuity.headReceiptDigest = second;
      value.continuity.acceptedReceiptDigests = [first, second];
      value.continuity.candidateReceiptDigests = [];
      value.continuity.effectiveAcceptedReceiptDigests = [second, first];
      return resignContinuity(value);
    }
  },
  {
    id: 'duplicate-lineage-evidence-digest',
    mutate(value) {
      const receipt = Fabric.sha256('corpus-duplicate-evidence');
      value.continuity.state = 'RECONSTRUCTED';
      value.continuity.headReceiptDigest = receipt;
      value.continuity.acceptedReceiptDigests = [receipt];
      value.continuity.candidateReceiptDigests = [];
      value.continuity.effectiveAcceptedReceiptDigests = [receipt];
      resignContinuity(value);
      value.lineageReceipt.continuityEvidenceRefs = [
        { id: 'evidence-one', schema: 'axm.identity-shell.continuity-event/v1', sha256: receipt },
        { id: 'evidence-two', schema: 'axm.identity-shell.continuity-event/v1', sha256: receipt }
      ];
      return resignLineage(value);
    }
  },
  {
    id: 'overlong-shell-identity',
    mutate(value) {
      const overlong = 'a'.repeat(121);
      value.shellId = overlong;
      value.identityRoot.shellId = overlong;
      value.lineageReceipt.shellId = overlong;
      return resignLineage(value);
    }
  },
  {
    id: 'invalid-blueprint-reference-contract',
    mutate(value) {
      value.blueprintRef.schema = 'invalid contract token';
      return resignManifest(value);
    }
  },
  {
    id: 'accepted-candidate-overlap',
    mutate(value) {
      const receipt = Fabric.sha256('corpus-overlap');
      value.continuity.state = 'RECONSTRUCTED';
      value.continuity.headReceiptDigest = receipt;
      value.continuity.acceptedReceiptDigests = [receipt];
      value.continuity.candidateReceiptDigests = [receipt];
      value.continuity.effectiveAcceptedReceiptDigests = [receipt];
      return resignContinuity(value);
    }
  },
  {
    id: 'reconstructed-head-not-in-history',
    mutate(value) {
      const receipt = Fabric.sha256('corpus-declared-history');
      value.continuity.state = 'RECONSTRUCTED';
      value.continuity.headReceiptDigest = Fabric.sha256('corpus-absent-head');
      value.continuity.acceptedReceiptDigests = [receipt];
      value.continuity.candidateReceiptDigests = [];
      value.continuity.effectiveAcceptedReceiptDigests = [receipt];
      return resignContinuity(value);
    }
  },
  {
    id: 'lineage-shell-identity-drift',
    mutate(value) {
      value.lineageReceipt.shellId = 'different-shell';
      return resignLineage(value);
    }
  },
  {
    id: 'lifecycle-lineage-drift',
    mutate(value) {
      value.lifecycleState = 'SUCCESSION_PROPOSED';
      return resignManifest(value);
    }
  },
  {
    id: 'noncanonical-permission-order',
    mutate(value) {
      const index = componentIndex(value, 'ADAPTER');
      value.components[index].descriptor.requestedPermissions = ['proposal.emit', 'observation.receive'];
      return resignDescriptor(value, index);
    }
  },
  {
    id: 'noncanonical-contract-order',
    mutate(value) {
      const index = componentIndex(value, 'ADAPTER');
      value.components[index].descriptor.contracts.accepts = ['z-contract/v1', 'a-contract/v1'];
      return resignDescriptor(value, index);
    }
  }
];

const validFabric = fabricVerdict(origin);
const validIndependent = independentVerdict(origin);
assert.strictEqual(validFabric.verdict, 'PASS', 'valid committed manifest must pass the fabric verifier');
assert.strictEqual(validIndependent.verdict, 'PASS', 'valid committed manifest must pass the independent verifier');

const report = attacks.map(attack => {
  const candidate = attack.mutate(copy(origin));
  return {
    id: attack.id,
    fabric: fabricVerdict(candidate),
    independent: independentVerdict(candidate),
    export: operationVerdict(() => Fabric.exportManifest(candidate)),
    import: operationVerdict(() => Fabric.importManifest(Fabric.canonicalJson(candidate)))
  };
});

if (process.argv.includes('--report-current')) {
  process.stdout.write(JSON.stringify({ status: 'REPORT', attacks: report }, null, 2) + '\n');
} else {
  report.forEach(result => {
    assert.strictEqual(result.fabric.verdict, 'FAIL', result.id + ' must fail the fabric verifier');
    assert.strictEqual(result.independent.verdict, 'FAIL', result.id + ' must fail the independent verifier');
    assert.strictEqual(result.export.verdict, 'FAIL', result.id + ' must fail the export gate');
    assert.strictEqual(result.import.verdict, 'FAIL', result.id + ' must fail the import gate');
  });
  process.stdout.write('PASS identity-shell-fabric adversarial corpus: ' + report.length + ' re-signed attacks rejected by verifier, independent verifier, export, and import gates\n');
}
