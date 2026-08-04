"use strict";

const fs = require("fs");
const { parentPort, workerData } = require("worker_threads");
const GrowthMetrics = require("./axm-growth-metrics");
const OperationsUtils = require("../operations/operations-utils");

function loadCache(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && parsed.schema === GrowthMetrics.SCAN_CACHE_SCHEMA
      ? parsed
      : null;
  } catch (_) {
    return null;
  }
}

function scanWorkshop(input) {
  const startedAt = Date.now();
  const result = GrowthMetrics.scanWithCache(
    input.root,
    loadCache(input.cacheFile),
  );
  let persisted = !result.cacheChanged;
  let persistenceError = null;
  if (result.cacheChanged) {
    try {
      OperationsUtils.atomicJson(input.cacheFile, result.cache);
      persisted = true;
    } catch (error) {
      persistenceError = String((error && error.message) || error).slice(0, 240);
    }
  }
  return {
    kind: "workshop",
    metrics: result.metrics,
    status: {
      schema: "axm.growth-scan-cache-status/v1",
      mode: result.cacheStats.mode,
      cacheHits: result.cacheStats.cacheHits,
      contentReads: result.cacheStats.contentReads,
      eligibleTextFiles: result.cacheStats.eligibleTextFiles,
      durationMs: Date.now() - startedAt,
      measuredAt: result.metrics.measuredAt,
      scanHealth: result.cacheStats.scanHealth,
      persisted,
      persistenceError,
      execution: "isolated-worker",
      mainThreadFileWalk: false,
      boundaries: {
        sourceContentsStored: false,
        absolutePathsStored: false,
        validation: "relative path + byte size + modification time",
        retainedMeasurements: ["characters", "lines"],
      },
    },
  };
}

function scanMirror(input) {
  return {
    kind: "mirror",
    metrics: GrowthMetrics.scanMirror(input.mirrorRoot),
  };
}

try {
  const result =
    workerData && workerData.kind === "workshop"
      ? scanWorkshop(workerData)
      : workerData && workerData.kind === "mirror"
        ? scanMirror(workerData)
        : (() => {
            throw new Error("unknown growth scan worker request");
          })();
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: String((error && error.message) || error).slice(0, 500),
  });
}
