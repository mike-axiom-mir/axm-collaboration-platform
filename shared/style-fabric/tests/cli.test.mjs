import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { LOCAL_CREATOR_POLICY, admitSkinPack } from "../src/index.mjs";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../bin/axm-skin.mjs", import.meta.url));

async function run(args) {
  return execute(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

test("CLI exposes Mold Foundry and deterministic Treatment Forge workflows", async () => {
  const work = await mkdtemp(join(tmpdir(), "axm-cli-test-"));
  try {
    const directionsPath = join(work, "directions.json");
    const forgedMoldPath = join(work, "mold.json");
    const treatedPackPath = join(work, "treated.axmskin.json");

    const directionsRun = await run([
      "treatment-directions",
      "neon-paper-selective",
      "cli-regression-seed",
      directionsPath,
      "--profile",
      "legacy"
    ]);
    assert.match(directionsRun.stdout, /THREE_DRAFTS_FOR_REVIEW/);
    const directions = JSON.parse(await readFile(directionsPath, "utf8"));
    assert.equal(directions.directions.length, 3);
    assert.equal(new Set(directions.directions.map((entry) => entry.id)).size, 3);
    assert.equal(directions.receipt.automaticWrites, 0);

    const moldRun = await run([
      "mold-forge",
      "examples/molds/paper-light-stage.skin-mold.json",
      forgedMoldPath
    ]);
    assert.match(moldRun.stdout, /DRAFT_REVIEW_REQUIRED/);
    const mold = JSON.parse(await readFile(forgedMoldPath, "utf8"));
    assert.equal(mold.id, "paper-light-stage");
    assert.equal(mold.slots.length, 5);

    const applyRun = await run([
      "treatment-apply",
      "examples/packs/neon-paper-luxe.axmskin.json",
      directionsPath,
      "1",
      treatedPackPath
    ]);
    assert.match(applyRun.stdout, /TREATMENT_APPLIED/);
    const treatedPack = JSON.parse(await readFile(treatedPackPath, "utf8"));
    const admission = await admitSkinPack(treatedPack, {
      ...LOCAL_CREATOR_POLICY,
      id: "axm.test.signed-cli-output",
      allowUnsigned: false,
      requireIntegrity: true
    });
    assert.equal(admission.ok, true);
    assert(treatedPack.capabilities.includes("treatment-stack.v1"));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});
