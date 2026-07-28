import test from "node:test";
import assert from "node:assert/strict";
import {
  SkinRuntime,
  compileStyleIntent,
  createGameContractFromMold,
  createSkinInstance,
  deepMerge,
  flattenObject,
  getPath,
  setInstanceOverride,
  setPath,
  stableStringify,
  validateSkinInstance
} from "../src/index.mjs";

function skin() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Security Boundary",
    seed: "security-boundary",
    scope: ["global"],
    keywords: ["paper"],
    intensity: 0.5,
    accessibility: {}
  });
}

function gameContract() {
  return createGameContractFromMold({
    moldId: "universal-core",
    gameId: "test.security-boundary",
    gameVersion: "1.0.0"
  });
}

function runtimeAdapter(id, contract = gameContract(), { delayedApply = false } = {}) {
  let applyCount = 0;
  let lastApplied = null;
  return {
    id,
    describe() {
      return contract;
    },
    async preview(resolved) {
      resolved.tokens = { previewMutation: true };
      return { ok: true, status: "PREVIEWED" };
    },
    async apply(resolved) {
      applyCount += 1;
      lastApplied = resolved;
      if (delayedApply) await new Promise((resolve) => setImmediate(resolve));
      return {
        ok: true,
        rollbackToken: { applyCount },
        evidence: { applyCount }
      };
    },
    async rollback() {
      return { ok: true, evidence: { restored: true } };
    },
    get applyCount() {
      return applyCount;
    },
    get lastApplied() {
      return lastApplied;
    }
  };
}

test("canonicalization and merge reject dangerous object keys recursively", () => {
  for (const key of ["__proto__", "prototype", "constructor"]) {
    const hostile = JSON.parse(`{"safe":{"${key}":{"polluted":true}}}`);
    assert.throws(() => stableStringify(hostile), /Unsafe object key/);
    assert.throws(() => deepMerge({}, hostile), /Unsafe object key/);
  }
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});

test("path and flatten helpers reject unsafe segments and ignore inherited values", () => {
  const target = {};
  assert.throws(
    () => setPath(target, ["tokens", "__proto__", "polluted"], true),
    /Unsafe object key/
  );
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);

  const inherited = Object.create({ hidden: { value: 9 } });
  inherited.visible = { value: 4 };
  assert.equal(getPath(inherited, "hidden.value"), undefined);
  assert.equal(getPath(inherited, "visible.value"), 4);

  const hostile = JSON.parse('{"tokens":{"constructor":{"polluted":true}}}');
  assert.throws(() => flattenObject(hostile), /Unsafe object key/);
  const hostileArray = JSON.parse('{"tokens":[{"prototype":{"polluted":true}}]}');
  assert.throws(() => flattenObject(hostileArray), /Unsafe object key/);

  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      throw new Error("getter must not execute");
    }
  });
  assert.throws(() => getPath(accessor, "value"), /Accessor properties/);
});

test("skin instances enforce exact safe shape and bounded accessibility values", () => {
  const created = createSkinInstance(skin(), { effectScale: 5 });
  assert.equal(created.accessibility.effectScale, 1);
  assert.equal(validateSkinInstance(created).ok, true);

  const validOverride = setInstanceOverride(
    created,
    ["materials", "world.base", "glowIntensity"],
    0.42
  );
  assert.equal(
    getPath(validOverride.overrides, ["materials", "world.base", "glowIntensity"]),
    0.42
  );
  assert.equal(
    getPath(created.overrides, ["materials", "world.base", "glowIntensity"]),
    undefined
  );

  const nestedHostile = structuredClone(created);
  nestedHostile.overrides = JSON.parse(
    '{"tokens":{"__proto__":{"polluted":true}}}'
  );
  assert.equal(validateSkinInstance(nestedHostile).ok, false);
  assert.throws(
    () => setInstanceOverride(created, "tokens.__proto__.polluted", true),
    /Unsafe object key/
  );
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);

  const extraField = { ...created, hiddenAuthority: true };
  assert.equal(validateSkinInstance(extraField).ok, false);

  const invalidScale = structuredClone(created);
  invalidScale.accessibility.effectScale = 2;
  assert.equal(validateSkinInstance(invalidScale).ok, false);

  const sparseRefs = structuredClone(created);
  sparseRefs.packRefs = new Array(1);
  assert.equal(validateSkinInstance(sparseRefs).ok, false);
});

test("adapter registration captures one validated contract snapshot", async () => {
  const invalid = gameContract();
  invalid.adapterApi = "wrong.adapter.api";
  const invalidRuntime = new SkinRuntime();
  assert.throws(
    () => invalidRuntime.registerAdapter(runtimeAdapter("test.invalid-contract", invalid)),
    /Adapter contract rejected/
  );

  const mutable = gameContract();
  const capturedGameId = mutable.gameId;
  const runtime = new SkinRuntime();
  const adapter = runtimeAdapter("test.captured-contract", mutable);
  runtime.registerAdapter(adapter);
  mutable.gameId = "mutated.after.registration";

  assert.equal(runtime.listAdapters()[0].contract.gameId, capturedGameId);
  const prepared = await runtime.prepare({ adapterId: adapter.id, packs: [skin()] });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.proposal.receipt.gameId, capturedGameId);
});

test("runtime rejects forged and tampered proposal envelopes", async () => {
  const runtime = new SkinRuntime();
  const adapter = runtimeAdapter("test.proposal-integrity");
  runtime.registerAdapter(adapter);
  const prepared = await runtime.prepare({ adapterId: adapter.id, packs: [skin()] });
  assert.equal(prepared.ok, true);

  const forged = {
    type: "axm.skin-apply-proposal",
    version: "1.0",
    adapterId: adapter.id,
    proposalId: "0".repeat(64),
    resolved: {
      presentationAuthority: "ZERO_AUTHORITATIVE_WRITES",
      slots: { forged: { material: { arbitrary: true } } }
    },
    receipt: { forged: true }
  };
  const forgedResult = await runtime.apply({
    proposal: forged,
    approval: { approved: true, actor: "human:test" }
  });
  assert.equal(forgedResult.ok, false);
  assert.equal(forgedResult.status, "REJECTED");

  const tampered = structuredClone(prepared.proposal);
  tampered.receipt.summary.applied += 1;
  const tamperedResult = await runtime.apply({
    proposal: tampered,
    approval: { approved: true, actor: "human:test" }
  });
  assert.equal(tamperedResult.ok, false);
  assert.equal(tamperedResult.status, "REJECTED");
  assert.equal(adapter.applyCount, 0);
});

test("preview receives a registry-held clone and apply is single-use", async () => {
  const runtime = new SkinRuntime();
  const adapter = runtimeAdapter("test.single-use");
  runtime.registerAdapter(adapter);
  const prepared = await runtime.prepare({ adapterId: adapter.id, packs: [skin()] });
  const expectedResolved = stableStringify(prepared.proposal.resolved);

  const previewed = await runtime.preview(prepared.proposal);
  assert.equal(previewed.ok, true);
  assert.equal(stableStringify(prepared.proposal.resolved), expectedResolved);

  const applied = await runtime.apply({
    proposal: prepared.proposal,
    approval: { approved: true, actor: "human:test", reason: "boundary test" }
  });
  assert.equal(applied.ok, true);
  assert.equal(stableStringify(adapter.lastApplied), expectedResolved);
  assert.equal(adapter.applyCount, 1);

  const replayed = await runtime.apply({
    proposal: prepared.proposal,
    approval: { approved: true, actor: "human:test", reason: "boundary test" }
  });
  assert.equal(replayed.ok, false);
  assert.equal(replayed.status, "REPLAYED");
  assert.equal(adapter.applyCount, 1);
});

test("concurrent apply calls invoke the adapter exactly once", async () => {
  const runtime = new SkinRuntime();
  const adapter = runtimeAdapter("test.concurrent-apply", gameContract(), {
    delayedApply: true
  });
  runtime.registerAdapter(adapter);
  const prepared = await runtime.prepare({ adapterId: adapter.id, packs: [skin()] });
  const approval = { approved: true, actor: "human:test" };

  const results = await Promise.all([
    runtime.apply({ proposal: prepared.proposal, approval }),
    runtime.apply({ proposal: prepared.proposal, approval })
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok).length, 1);
  assert(["BUSY", "REPLAYED"].includes(results.find((result) => !result.ok).status));
  assert.equal(adapter.applyCount, 1);
});
