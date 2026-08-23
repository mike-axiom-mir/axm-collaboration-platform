"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const GrowthMetrics = require("./axm-growth-metrics");
const GrowthWorkerRunner = require("./growth-worker-runner");

async function main() {
  const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), "axm-growth-worker-"));
  const workshopRoot = path.join(fixtureHome, "workshop");
  const mirrorRoot = path.join(fixtureHome, "mirror");
  const cacheFile = path.join(fixtureHome, "cache", "text-scan-cache.json");
  const workerFile = path.join(__dirname, "growth-scan-worker.cjs");
  try {
    fs.mkdirSync(path.join(workshopRoot, "tools", "demo"), { recursive: true });
    fs.mkdirSync(path.join(workshopRoot, "hub"), { recursive: true });
    fs.writeFileSync(
      path.join(workshopRoot, "tools", "demo", "manifest.json"),
      '{"id":"demo"}\n',
    );
    fs.writeFileSync(
      path.join(workshopRoot, "tools", "demo", "index.js"),
      '"use strict";\nmodule.exports = 1;\n',
    );
    fs.writeFileSync(
      path.join(workshopRoot, "hub", "index.html"),
      "<!doctype html>\n<title>Fixture</title>\n",
    );
    fs.mkdirSync(path.join(mirrorRoot, "modules", "learning"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(mirrorRoot, "state", "private"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(mirrorRoot, "modules", "learning", "module.js"),
      'module.exports = "mirror";\n',
    );
    fs.writeFileSync(
      path.join(mirrorRoot, "state", "private", "note.txt"),
      "private fixture contents\n",
    );

    const direct = GrowthMetrics.scanWithCache(workshopRoot, null);
    const runner = GrowthWorkerRunner.create({
      root: workshopRoot,
      mirrorRoot,
      cacheFile,
      workerFile,
      timeoutMs: 10000,
    });

    const firstPromise = runner.scanWorkshop();
    const coalescedPromise = runner.scanWorkshop();
    assert.strictEqual(
      coalescedPromise,
      firstPromise,
      "concurrent callers must receive the same in-flight promise",
    );
    const first = await firstPromise;
    assert.strictEqual(first.metrics.fingerprint, direct.metrics.fingerprint);
    assert.strictEqual(first.metrics.totalFiles, direct.metrics.totalFiles);
    assert.strictEqual(first.metrics.lines, direct.metrics.lines);
    assert.strictEqual(first.metrics.characters, direct.metrics.characters);
    assert.strictEqual(first.status.execution, "isolated-worker");
    assert.strictEqual(first.status.mainThreadFileWalk, false);
    assert.strictEqual(first.status.contentReads, 3);
    assert.strictEqual(first.status.scanHealth.partial, false);
    assert.strictEqual(first.status.persisted, true);
    assert.ok(fs.existsSync(cacheFile), "worker must persist the compact cache");
    assert.strictEqual(runner.status().stats.workshopLaunches, 1);
    assert.strictEqual(runner.status().stats.workshopCoalesced, 1);

    const second = await runner.scanWorkshop();
    assert.strictEqual(second.metrics.fingerprint, first.metrics.fingerprint);
    assert.strictEqual(second.status.contentReads, 0);
    assert.strictEqual(second.status.cacheHits, 3);

    const changedFile = path.join(workshopRoot, "tools", "demo", "index.js");
    fs.appendFileSync(changedFile, "module.exports += 1;\n");
    const changedTime = new Date(Date.now() + 2000);
    fs.utimesSync(changedFile, changedTime, changedTime);
    const changed = await runner.scanWorkshop();
    assert.strictEqual(changed.status.contentReads, 1);
    assert.strictEqual(changed.status.cacheHits, 2);
    assert.notStrictEqual(changed.metrics.fingerprint, second.metrics.fingerprint);

    const workshopFirst = await runner.scanWorkshopFirst();
    assert.strictEqual(workshopFirst.metrics.totalFiles, changed.metrics.totalFiles);
    assert.strictEqual(workshopFirst.mirrorStatus.state, "REFRESHING");
    assert.strictEqual(workshopFirst.mirrorStatus.ready, false);
    assert.match(workshopFirst.metrics.mirror.reason, /refreshing separately/);

    const bodies = await runner.scanBodies();
    assert.ok(bodies.metrics.mirror, "body scan must attach Mirror measurements");
    assert.strictEqual(bodies.metrics.mirror.available, true);
    assert.strictEqual(
      bodies.metrics.mirror.boundaries.privateStateContentsRead,
      false,
    );
    const cachedMirror = runner.mirrorResult();
    assert.strictEqual(cachedMirror.status.ready, true);
    assert.strictEqual(cachedMirror.result.metrics.available, true);
    assert.ok(runner.status().stats.mirrorBackgroundRefreshes >= 1);

    const broken = GrowthWorkerRunner.create({
      root: workshopRoot,
      mirrorRoot,
      cacheFile,
      workerFile: path.join(fixtureHome, "missing-worker.cjs"),
      timeoutMs: 2000,
    });
    await assert.rejects(() => broken.scanWorkshop());
    await assert.rejects(() => broken.scanWorkshop());
    assert.strictEqual(
      broken.status().stats.workshopLaunches,
      2,
      "a failed launch must clear the in-flight slot",
    );

    console.log("PASS growth worker exact parity, cache reuse, coalescing, and failure recovery");
  } finally {
    fs.rmSync(fixtureHome, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("FAIL", error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
