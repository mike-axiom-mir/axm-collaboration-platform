import test from "node:test";
import assert from "node:assert/strict";
import { createCssVariableAdapter } from "../src/index.mjs";

function styleTarget(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    style: {
      getPropertyValue(name) {
        return values.get(name) ?? "";
      },
      setProperty(name, value) {
        values.set(name, String(value));
      },
      removeProperty(name) {
        values.delete(name);
      }
    },
    value(name) {
      return values.get(name) ?? "";
    }
  };
}

const contract = {
  type: "axm.game-skin-contract",
  version: "1.0",
  gameId: "axm.test.css-game",
  gameVersion: "0.1.0",
  adapterApi: "axm.style-adapter.v1",
  slots: []
};

const resolved = {
  slots: {
    "world.background": {
      material: { baseColor: "#112233", glowIntensity: 0.4 }
    }
  }
};

test("CSS adapter applies mapped presentation values and restores the prior state", async () => {
  const target = styleTarget({ "--game-bg": "#000000" });
  const adapter = createCssVariableAdapter({
    id: "axm.test.css-adapter",
    contract,
    target,
    map: {
      "world.background": {
        baseColor: "--game-bg",
        glowIntensity: "--game-glow"
      }
    }
  });
  const applied = await adapter.apply(resolved);
  assert.equal(applied.ok, true);
  assert.equal(target.value("--game-bg"), "#112233");
  assert.equal(target.value("--game-glow"), "0.4");

  const rolledBack = await adapter.rollback(applied.rollbackToken);
  assert.equal(rolledBack.ok, true);
  assert.equal(target.value("--game-bg"), "#000000");
  assert.equal(target.value("--game-glow"), "");
});

test("CSS adapter refuses to claim preview without an isolated preview target", async () => {
  const adapter = createCssVariableAdapter({
    id: "axm.test.css-adapter.no-preview",
    contract,
    target: styleTarget(),
    map: {}
  });
  const result = await adapter.preview(resolved);
  assert.equal(result.ok, false);
  assert.equal(result.status, "UNSUPPORTED");
});
