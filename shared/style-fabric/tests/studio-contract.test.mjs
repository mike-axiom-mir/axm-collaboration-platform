import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../studio/index.html", import.meta.url);
const appUrl = new URL("../studio/app.mjs", import.meta.url);

test("every literal Studio byId reference has a matching HTML element", async () => {
  const [html, app] = await Promise.all([
    readFile(htmlUrl, "utf8"),
    readFile(appUrl, "utf8")
  ]);
  const htmlIds = new Set(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  );
  const literalReferences = [
    ...new Set([...app.matchAll(/\bbyId\("([^"]+)"\)/g)].map((match) => match[1]))
  ];
  const missing = literalReferences.filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});

test("the Studio exposes all seven independent game-skin organ selectors", async () => {
  const html = await readFile(htmlUrl, "utf8");
  const organIds = [
    "stack-world",
    "stack-objects",
    "stack-gear",
    "stack-items",
    "stack-character",
    "stack-ui",
    "stack-fx"
  ];
  for (const id of organIds) {
    assert.match(html, new RegExp(`<select id="${id}">`));
  }
  assert.match(html, /Compose seven-organ game skin/);
});

test("the Studio exposes the full-surface chamber and honest conformance evidence controls", async () => {
  const [html, app] = await Promise.all([
    readFile(htmlUrl, "utf8"),
    readFile(appUrl, "utf8")
  ]);
  for (const id of [
    "surface-grid",
    "surface-organ-filters",
    "surface-search",
    "surface-base-color",
    "surface-glow",
    "conformance-checks",
    "conformance-readiness",
    "proof-preview",
    "proof-fallback",
    "proof-rollback",
    "proof-receipt"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Every visible surface, one honest map/);
  assert.match(app, /listGameSurfaceSlots/);
  assert.match(app, /assessGameAdapterConformance/);
});
