import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SkinRuntime, compileStyleIntent } from "../src/index.mjs";

const contract = JSON.parse(
  await readFile(new URL("../examples/contracts/orb-arena.game-skin-contract.json", import.meta.url))
);

function skin() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Runtime Test",
    seed: "runtime-1",
    scope: ["global"],
    keywords: ["paper"],
    intensity: 0.5,
    accessibility: {}
  });
}

function adapter() {
  let active = null;
  return {
    id: "test.adapter",
    describe: () => contract,
    async preview(resolved) {
      return { ok: true, status: "PREVIEWED", slots: Object.keys(resolved.slots).length };
    },
    async apply(resolved) {
      const previous = active;
      active = resolved;
      return {
        ok: true,
        rollbackToken: { previous },
        evidence: { slots: Object.keys(resolved.slots).length }
      };
    },
    async rollback(token) {
      active = token.previous;
      return { ok: true, evidence: { restored: true } };
    },
    get active() {
      return active;
    }
  };
}

test("machine proposal cannot apply without explicit actor approval", async () => {
  const runtime = new SkinRuntime();
  const target = adapter();
  runtime.registerAdapter(target);
  const prepared = await runtime.prepare({ adapterId: target.id, packs: [skin()] });
  const result = await runtime.apply({ proposal: prepared.proposal, approval: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, "BLOCKED");
  assert.equal(target.active, null);
});

test("approved apply returns a receipt and rollback restores state", async () => {
  const runtime = new SkinRuntime();
  const target = adapter();
  runtime.registerAdapter(target);
  const prepared = await runtime.prepare({ adapterId: target.id, packs: [skin()] });
  const applied = await runtime.apply({
    proposal: prepared.proposal,
    approval: { approved: true, actor: "human:test", reason: "unit test" }
  });
  assert.equal(applied.ok, true);
  assert(target.active);
  const rolledBack = await runtime.rollback(applied.applyId, {
    approved: true,
    actor: "human:test"
  });
  assert.equal(rolledBack.ok, true);
  assert.equal(target.active, null);
});

test("preview stays separate from apply", async () => {
  const runtime = new SkinRuntime();
  const target = adapter();
  runtime.registerAdapter(target);
  const prepared = await runtime.prepare({ adapterId: target.id, packs: [skin()] });
  const previewed = await runtime.preview(prepared.proposal);
  assert.equal(previewed.ok, true);
  assert.equal(target.active, null);
});
