import test from "node:test";
import assert from "node:assert/strict";

import {
  clone,
  stableStringify
} from "../src/core/stable.mjs";

test("declarative cloning rejects accessors without invoking them", () => {
  let invoked = false;
  const input = {};
  Object.defineProperty(input, "value", {
    enumerable: true,
    get() {
      invoked = true;
      return "unsafe";
    }
  });
  assert.throws(() => clone(input), /Accessor properties are not allowed/);
  assert.equal(invoked, false);
});

test("declarative cloning rejects dangerous keys and cycles", () => {
  const dangerous = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}');
  assert.throws(() => clone(dangerous), /Unsafe object key/);

  const cyclic = { id: "cycle" };
  cyclic.self = cyclic;
  assert.throws(() => clone(cyclic), /Cyclic declarative data/);
});

test("declarative cloning rejects sparse arrays and non-plain objects", () => {
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => clone(sparse), /Sparse arrays are not allowed/);
  assert.throws(() => clone(new Date()), /Non-plain objects are not allowed/);
});

test("canonical JSON rejects accessors without invoking them", () => {
  let invoked = false;
  const input = {};
  Object.defineProperty(input, "secret", {
    enumerable: true,
    get() {
      invoked = true;
      return 42;
    }
  });
  assert.throws(() => stableStringify(input), /Accessor properties are not allowed/);
  assert.equal(invoked, false);
});
