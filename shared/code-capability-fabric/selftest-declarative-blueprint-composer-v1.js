'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Composer = require('./declarative-blueprint-composer-v1');
const Consent = require('./grounded-consent-scope-v1');
const Cli = require('./blueprint-composer-cli');

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  process.stdout.write('ok ' + passed + ' - ' + name + '\n');
}

function throws(name, fn, pattern) {
  test(name, () => assert.throws(fn, pattern));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaRefsResolve(file) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
  function visit(value, root) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, root));
    if (typeof value.$ref === 'string') {
      const [relativeFile, fragment = ''] = value.$ref.split('#');
      const targetRoot = relativeFile
        ? JSON.parse(fs.readFileSync(path.join(__dirname, relativeFile), 'utf8'))
        : root;
      if (fragment.startsWith('/')) {
        const parts = fragment.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        let target = targetRoot;
        for (const part of parts) {
          if (!target || !Object.prototype.hasOwnProperty.call(target, part)) return false;
          target = target[part];
        }
      }
    }
    return Object.values(value).every((item) => visit(item, root));
  }
  return visit(schema, schema);
}

function rawIntent(sealed) {
  const value = clone(sealed);
  delete value.intentDigest;
  return value;
}

function mutateIntent(sealed, mutator) {
  const value = rawIntent(sealed);
  mutator(value);
  return value;
}

function withInstanceMutation(inputValue, mutator) {
  const input = clone(inputValue);
  const instanceCore = clone(input.consentEvaluationInput.instance);
  delete instanceCore.instanceDigest;
  mutator(instanceCore);
  const instance = Consent.sealInstance(instanceCore);
  const consentEvaluationInput = {
    policy: input.consentEvaluationInput.policy,
    instance,
    evaluatedAt: input.consentEvaluationInput.evaluatedAt
  };
  return {
    ...input,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput)
  };
}

function withPolicyAndInstanceMutation(inputValue, policyMutator, instanceMutator) {
  const input = clone(inputValue);
  const policyCore = clone(input.consentEvaluationInput.policy);
  delete policyCore.policyDigest;
  policyMutator(policyCore);
  const policy = Consent.sealPolicy(policyCore);
  const instanceCore = clone(input.consentEvaluationInput.instance);
  delete instanceCore.instanceDigest;
  instanceCore.policyRef = Consent.policyRef(policy);
  instanceMutator(instanceCore);
  const instance = Consent.sealInstance(instanceCore);
  const consentEvaluationInput = {
    policy,
    instance,
    evaluatedAt: input.consentEvaluationInput.evaluatedAt
  };
  return {
    ...input,
    consentEvaluationInput,
    consentEvaluation: Consent.evaluateGroundedConsent(consentEvaluationInput)
  };
}

const example = Composer.buildExampleInput();
const workRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'axm-blueprint-composer-selftest-')));

try {
  test('example grounded-consent evaluation stops at the explicit human-declaration gate', () => {
    assert.strictEqual(example.consentEvaluation.status, 'AUTHENTICATED_HUMAN_DECISION_REQUIRED');
    assert.strictEqual(example.consentEvaluation.truth.authenticatedHumanDecisionVerified, false);
  });

  test('all four roots remain the exact technical gate', () => {
    assert.deepStrictEqual(Consent.ROOTS_GATE, ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
    assert.deepStrictEqual(Composer.buildBlueprint(example.intent).rootsGate, Consent.ROOTS_GATE);
  });

  test('component schemas and TEST contract parse with exact identities', () => {
    const expected = [
      ['fabric-declarative-blueprint-intent.schema.json', Composer.INTENT_SCHEMA],
      ['fabric-declarative-capability-blueprint.schema.json', Composer.BLUEPRINT_SCHEMA],
      ['fabric-blueprint-composition-receipt.schema.json', Composer.RECEIPT_SCHEMA],
      ['fabric-blueprint-composer-profile.schema.json', Composer.PROFILE_SCHEMA]
    ];
    for (const [file, id] of expected) {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      assert.strictEqual(schema.$id, id);
      assert.strictEqual(schema.additionalProperties, false);
      assert.strictEqual(schemaObjectNodesAreClosed(schema), true);
      assert.strictEqual(schemaRefsResolve(file), true);
    }
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-declarative-blueprint-composer-v1.contract.json'), 'utf8'));
    assert.strictEqual(contract.status, 'TEST');
    assert.deepStrictEqual(contract.rootsGate, Consent.ROOTS_GATE);
  });

  test('CLI parsing is closed and keeps acknowledgement separate', () => {
    assert.deepStrictEqual(Cli.parseArguments([
      '--allowed-parent', 'X', '--root-name', 'Y', '--acknowledge', Composer.ACKNOWLEDGEMENT
    ]), {
      'allowed-parent': 'X',
      'root-name': 'Y',
      acknowledge: Composer.ACKNOWLEDGEMENT
    });
    assert.throws(() => Cli.parseArguments(['--allowed-parent', 'X', '--execute', 'yes']), /unsupported|required/);
  });

  test('profile is closed, path-free, provider-neutral, and non-executing', () => {
    assert.strictEqual(Composer.PROFILE.sourceReads, 'DISABLED');
    assert.strictEqual(Composer.PROFILE.network, 'DISABLED');
    assert.strictEqual(Composer.PROFILE.childProcesses, 'DISABLED');
    assert.strictEqual(Composer.PROFILE.generatedCodeExecution, 'DISABLED');
    assert.strictEqual(Composer.PROFILE.maximumWrittenFiles, 2);
    assert.ok(!Composer.canonicalJson(Composer.PROFILE).includes('D:'));
  });

  test('composer imports no process, network, VM, worker, environment, or dynamic-code authority', () => {
    const source = fs.readFileSync(path.join(__dirname, 'declarative-blueprint-composer-v1.js'), 'utf8');
    assert.strictEqual(/require\(['"](?:child_process|http|https|net|tls|dgram|vm|worker_threads)['"]\)/.test(source), false);
    assert.strictEqual(source.includes('process.env'), false);
    assert.strictEqual(/\beval\s*\(|new\s+Function\s*\(/.test(source), false);
  });

  test('sealed intent round-trips through the strict normalizer', () => {
    assert.deepStrictEqual(Composer.normalizeIntent(example.intent), example.intent);
  });

  test('input-field and quality-claim ordering normalize deterministically', () => {
    const changed = rawIntent(example.intent);
    changed.inputFields.reverse();
    changed.qualityClaims.reverse();
    assert.deepStrictEqual(Composer.sealIntent(changed), example.intent);
  });

  test('step order remains semantic and changes the intent digest', () => {
    const changed = rawIntent(example.intent);
    const first = changed.steps.shift();
    changed.steps.splice(1, 0, first);
    assert.throws(() => Composer.sealIntent(changed), /reads unavailable token/);
  });

  throws('intent digest drift is rejected', () => {
    const changed = clone(example.intent);
    changed.intentDigest = Composer.sha256('forged');
    Composer.normalizeIntent(changed);
  }, /digest mismatch/);

  throws('intent extra fields are rejected', () => Composer.sealIntent({ ...rawIntent(example.intent), hiddenAuthority: true }), /unsupported fields/);
  throws('non-EXPERIMENTAL status is rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.status = 'WORKING'; })), /status/);
  throws('intent authority cannot be granted', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.authority = 'WRITE'; })), /authority/);
  throws('unsupported blueprint kind is rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.kind = 'EXECUTABLE'; })), /kind/);
  throws('unsupported field type is rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.inputFields[0].type = 'function'; })), /type is unsupported/);
  throws('control characters in descriptive text are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.name = 'bad\nname'; })), /canonical text/);
  throws('duplicate input ids are rejected even when descriptions differ', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.inputFields[1].id = value.inputFields[0].id; })), /duplicate id/);
  throws('duplicate step reads are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.steps[0].reads.push(value.steps[0].reads[0]); })), /duplicate/);
  throws('unknown step operations are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.steps[0].operation = 'EXECUTE'; })), /operation is unsupported/);
  throws('forward and unknown step references are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.steps[0].reads = ['future-token']; })), /reads unavailable token/);
  throws('steps cannot overwrite an input token', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.steps[0].produces = 'change-request'; })), /overwrites token/);
  throws('unused produced tokens are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.steps.push({ id: 'dead-step', operation: 'FORMAT', reads: ['candidate-specification'], produces: 'dead-output', description: 'This deliberately unused output must be refused.' }); value.resourceBudget.maxOperations = 5; })), /unused produced token/);
  throws('unused input fields are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.inputFields.push({ id: 'unused-input', type: 'string', required: false, description: 'This deliberately unused input must be refused.' }); })), /unused input field/);
  throws('unavailable output sources are rejected', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.outputFields[0].source = 'missing-result'; })), /unavailable source/);
  throws('step count cannot exceed the declared operation budget', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.resourceBudget.maxOperations = 3; })), /exceed declared maxOperations/);
  throws('runtime resource declarations have fixed ceilings', () => Composer.sealIntent(mutateIntent(example.intent, (value) => { value.resourceBudget.maxDurationMs = 5001; })), /must be an integer/);

  test('blueprint bytes are deterministic for the exact sealed intent', () => {
    assert.deepStrictEqual(Composer.buildBlueprint(example.intent), Composer.buildBlueprint(example.intent));
  });

  test('blueprint digest binds the complete normalized blueprint core', () => {
    const blueprint = Composer.buildBlueprint(example.intent);
    const core = clone(blueprint);
    delete core.blueprintDigest;
    assert.strictEqual(blueprint.blueprintDigest, Composer.sha256(core));
    assert.deepStrictEqual(Composer.normalizeBlueprint(blueprint, example.intent), blueprint);
  });

  throws('blueprint drift relative to its intent is rejected', () => {
    const blueprint = Composer.buildBlueprint(example.intent);
    blueprint.name = 'Forged Blueprint';
    Composer.normalizeBlueprint(blueprint, example.intent);
  }, /does not match/);

  test('desired semantic outcomes remain explicitly unproven', () => {
    const blueprint = Composer.buildBlueprint(example.intent);
    assert.ok(blueprint.desiredOutcomes.every((item) => item.status === 'UNPROVEN'));
  });

  test('only graph validity is composer-validated; runtime and human claims stay planned', () => {
    const blueprint = Composer.buildBlueprint(example.intent);
    assert.deepStrictEqual(blueprint.acceptancePlan.map((item) => item.status), [
      'COMPOSER_VALIDATED', 'PLANNED', 'PLANNED', 'PLANNED', 'PLANNED', 'PLANNED', 'PLANNED'
    ]);
  });

  test('blueprint grants no permissions and refuses execution, install, promotion, CANON, and learning', () => {
    const blueprint = Composer.buildBlueprint(example.intent);
    assert.deepStrictEqual(blueprint.permissions, []);
    for (const refusal of ['generated-code-execution', 'automatic-install', 'automatic-promotion', 'automatic-canon', 'persistent-learning-admission']) {
      assert.ok(blueprint.boundaries.refuses.includes(refusal));
    }
  });

  test('prepare binds exact intent, policy, instance, profile, and declaration', () => {
    const prepared = Composer.prepare(example);
    assert.deepStrictEqual(prepared.intent, example.intent);
    assert.ok(prepared.composerInputBytes > 0 && prepared.composerInputBytes <= Composer.MAX_COMPOSER_INPUT_BYTES);
  });

  throws('forged consent evaluation is rejected', () => {
    const changed = clone(example);
    changed.consentEvaluation.evaluationDigest = Composer.sha256('forged-evaluation');
    Composer.prepare(changed);
  }, /verification failed|digest/);

  throws('consent subject digest drift is rejected', () => Composer.prepare(withInstanceMutation(example, (instance) => {
    instance.subjectRef.sha256 = Composer.sha256('other-intent');
  })), /subject does not bind|hold-free/);

  throws('extra consented actions cannot broaden the fixed composition action', () => Composer.prepare(withPolicyAndInstanceMutation(
    example,
    (policy) => { policy.domainRules[0].allowedActions.push('code.execute-candidate'); },
    (instance) => { instance.actions.push('code.execute-candidate'); }
  )), /action scope must be exact/);

  throws('extra consented permissions cannot broaden disposable write authority', () => Composer.prepare(withPolicyAndInstanceMutation(
    example,
    (policy) => { policy.domainRules[0].allowedPermissions.push('workspace.source-write'); },
    (instance) => { instance.permissions.push('workspace.source-write'); }
  )), /permission scope must be exact/);

  throws('network allowance is rejected even when policy permits it', () => Composer.prepare(withPolicyAndInstanceMutation(
    example,
    (policy) => { policy.domainRules[0].allowedNetworkDomains.push('example.invalid'); },
    (instance) => { instance.networkDomains.push('example.invalid'); }
  )), /network must remain disabled/);

  throws('lifecycle effects are rejected even when policy permits them', () => Composer.prepare(withPolicyAndInstanceMutation(
    example,
    (policy) => { policy.domainRules[0].allowedLifecycle.install = true; },
    (instance) => { instance.lifecycle.install = true; }
  )), /lifecycle effects must remain false/);

  throws('stale consent evaluation remains a hold', () => {
    const changed = clone(example);
    changed.consentEvaluationInput.evaluatedAt = '2026-08-22T04:00:00.000Z';
    changed.consentEvaluation = Consent.evaluateGroundedConsent(changed.consentEvaluationInput);
    Composer.prepare(changed);
  }, /hold-free/);

  throws('wrong acknowledgement is rejected', () => {
    const changed = clone(example);
    changed.authorization.acknowledgement = 'CREATE EVERYTHING';
    Composer.prepare(changed);
  }, /exact bounded declaration/);

  throws('forged declaration reference is rejected', () => {
    const changed = clone(example);
    changed.authorization.instructionRef.sha256 = Composer.sha256('forged-declaration');
    Composer.prepare(changed);
  }, /does not bind/);

  throws('actual composer input bytes are enforced', () => Composer.prepare(withInstanceMutation(example, (instance) => {
    instance.resources.maxInputBytes = 100;
  })), /input byte budget/);

  const firstRootName = Composer.ROOT_PREFIX + 'a';
  const first = Composer.emit(example, { allowedParent: workRoot, rootName: firstRootName, faultAt: null });
  const firstRoot = path.join(workRoot, firstRootName);
  const blueprintBytes = fs.readFileSync(path.join(firstRoot, Composer.BLUEPRINT_FILE));

  test('one real bounded emission writes exactly blueprint plus receipt', () => {
    assert.deepStrictEqual(fs.readdirSync(firstRoot).sort(), [Composer.BLUEPRINT_FILE, Composer.RECEIPT_FILE].sort());
    assert.strictEqual(first.receipt.resourceObservation.totalFilesWritten, 2);
    assert.strictEqual(Composer.canonicalJson(first.receipt).includes(workRoot), false);
  });

  test('receipt binds canonical object digest separately from exact file-byte digest', () => {
    assert.strictEqual(first.receipt.blueprintRef.sha256, first.blueprint.blueprintDigest);
    assert.strictEqual(first.receipt.artifactFiles[0].sha256, Composer.sha256(blueprintBytes));
    assert.notStrictEqual(first.receipt.blueprintRef.sha256, first.receipt.artifactFiles[0].sha256);
  });

  test('receipt byte and total-byte observations match durable files', () => {
    const receiptBytes = fs.readFileSync(path.join(firstRoot, Composer.RECEIPT_FILE));
    assert.strictEqual(first.receipt.resourceObservation.blueprintBytes, blueprintBytes.length);
    assert.strictEqual(first.receipt.resourceObservation.receiptBytes, receiptBytes.length);
    assert.strictEqual(first.receipt.resourceObservation.totalBytesWritten, blueprintBytes.length + receiptBytes.length);
  });

  test('strict artifact verifier binds intent, blueprint object, file bytes, and receipt', () => {
    const receipt = JSON.parse(fs.readFileSync(path.join(firstRoot, Composer.RECEIPT_FILE), 'utf8'));
    const verified = Composer.verifyReceiptArtifacts(receipt, blueprintBytes, example.intent);
    assert.deepStrictEqual(verified.blueprint, first.blueprint);
  });

  throws('artifact-byte drift is rejected independently of receipt normalization', () => {
    const changed = Buffer.concat([blueprintBytes, Buffer.from(' ')]);
    Composer.verifyReceiptArtifacts(first.receipt, changed, example.intent);
  }, /file bytes do not match/);

  throws('receipt digest drift is rejected', () => {
    const changed = clone(first.receipt);
    changed.receiptDigest = Composer.sha256('forged-receipt');
    Composer.normalizeReceipt(changed);
  }, /digest mismatch/);

  throws('truth inflation in a receipt is rejected', () => {
    const changed = clone(first.receipt);
    changed.truth.candidateCodeExecuted = true;
    Composer.normalizeReceipt(changed);
  }, /truth ceiling/);

  throws('receipt artifact substitution is rejected', () => {
    const changed = clone(first.receipt);
    changed.artifactFiles[0].path = 'candidate.js';
    Composer.normalizeReceipt(changed);
  }, /artifact path mismatch/);

  test('same intent produces identical blueprint and receipt bytes in a second root', () => {
    const rootName = Composer.ROOT_PREFIX + 'b';
    const second = Composer.emit(example, { allowedParent: workRoot, rootName, faultAt: null });
    assert.deepStrictEqual(second, first);
    assert.ok(fs.readFileSync(path.join(workRoot, rootName, Composer.BLUEPRINT_FILE)).equals(blueprintBytes));
    assert.ok(fs.readFileSync(path.join(workRoot, rootName, Composer.RECEIPT_FILE)).equals(fs.readFileSync(path.join(firstRoot, Composer.RECEIPT_FILE))));
  });

  throws('existing output roots are never overwritten', () => Composer.emit(example, {
    allowedParent: workRoot,
    rootName: firstRootName,
    faultAt: null
  }), /must not already exist/);

  throws('output root traversal is rejected', () => Composer.emit(example, {
    allowedParent: workRoot,
    rootName: Composer.ROOT_PREFIX + '..-escape',
    faultAt: null
  }), /fixed blueprint prefix|fixed pilot prefix/);

  throws('non-blueprint pilot roots are rejected', () => Composer.emit(example, {
    allowedParent: workRoot,
    rootName: 'axm-fabric-creation-pilot-other',
    faultAt: null
  }), /fixed blueprint prefix/);

  throws('non-canonical parent aliases are rejected', () => Composer.emit(example, {
    allowedParent: workRoot + path.sep + '.',
    rootName: Composer.ROOT_PREFIX + 'alias',
    faultAt: null
  }), /exact canonical path spelling|canonical path/);

  test('fault after blueprint cleans only the new owned root', () => {
    const sentinel = path.join(workRoot, 'foreign-sentinel.txt');
    fs.writeFileSync(sentinel, 'preserve', { flag: 'wx' });
    const rootName = Composer.ROOT_PREFIX + 'fault-blueprint';
    assert.throws(() => Composer.emit(example, { allowedParent: workRoot, rootName, faultAt: 'AFTER_BLUEPRINT' }), /injected/);
    assert.strictEqual(fs.existsSync(path.join(workRoot, rootName)), false);
    assert.strictEqual(fs.readFileSync(sentinel, 'utf8'), 'preserve');
  });

  test('fault after receipt cleans only the new owned root', () => {
    const rootName = Composer.ROOT_PREFIX + 'fault-receipt';
    assert.throws(() => Composer.emit(example, { allowedParent: workRoot, rootName, faultAt: 'AFTER_RECEIPT' }), /injected/);
    assert.strictEqual(fs.existsSync(path.join(workRoot, rootName)), false);
    assert.strictEqual(fs.readFileSync(path.join(workRoot, 'foreign-sentinel.txt'), 'utf8'), 'preserve');
  });

  throws('unsupported fault injection is rejected before output creation', () => Composer.emit(example, {
    allowedParent: workRoot,
    rootName: Composer.ROOT_PREFIX + 'bad-fault',
    faultAt: 'AFTER_EXECUTION'
  }), /unsupported/);

  test('too-small consented output budget fails before creating an output root', () => {
    const changed = withInstanceMutation(example, (instance) => { instance.resources.maxOutputBytes = 100; });
    const rootName = Composer.ROOT_PREFIX + 'small-budget';
    assert.throws(() => Composer.emit(changed, { allowedParent: workRoot, rootName, faultAt: null }), /output byte budget/);
    assert.strictEqual(fs.existsSync(path.join(workRoot, rootName)), false);
  });

  test('emitted artifacts contain no executable candidate file', () => {
    const names = fs.readdirSync(firstRoot);
    assert.ok(names.every((name) => name.endsWith('.json')));
    assert.strictEqual(first.receipt.truth.generatedExecutableCodePresent, false);
    assert.strictEqual(first.receipt.truth.candidateCodeExecuted, false);
  });

  test('receipt refuses replay, identity, clock, revocation, runtime, default, learning, and CANON inflation', () => {
    const truth = first.receipt.truth;
    for (const field of [
      'interactiveDeclarationReplayPrevented', 'cryptographicHumanAuthenticationVerified',
      'declaredDataClassContentVerified',
      'trustedClockObserved', 'liveRevocationChecked', 'runtimeQualityProven',
      'machineDefaultActivated', 'persistentLearningAdmitted', 'canonChanged'
    ]) assert.strictEqual(truth[field], false, field);
  });
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true });
}

process.stdout.write('declarative blueprint composer selftest: ' + passed + ' checks passed\n');
