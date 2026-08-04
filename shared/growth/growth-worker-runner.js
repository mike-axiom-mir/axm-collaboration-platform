"use strict";

const path = require("path");
const { Worker } = require("worker_threads");
const GrowthMetrics = require("./axm-growth-metrics");

function create(options) {
  const input = options || {};
  const WorkerClass = input.WorkerImpl || Worker;
  const root = path.resolve(String(input.root || ""));
  const mirrorRoot = path.resolve(String(input.mirrorRoot || ""));
  const cacheFile = path.resolve(String(input.cacheFile || ""));
  const workerFile = path.resolve(String(input.workerFile || ""));
  const timeoutMs = Math.max(1000, Number(input.timeoutMs) || 120000);
  const stats = {
    workshopLaunches: 0,
    workshopCoalesced: 0,
    mirrorLaunches: 0,
    mirrorCoalesced: 0,
  };
  let workshopInFlight = null;
  let mirrorInFlight = null;
  let lastWorkshopStatus = null;

  function spawn(kind) {
    if (kind !== "workshop" && kind !== "mirror") {
      return Promise.reject(new Error("unsupported growth scan kind"));
    }
    if (kind === "workshop") stats.workshopLaunches += 1;
    else stats.mirrorLaunches += 1;
    return new Promise((resolve, reject) => {
      let settled = false;
      const worker = new WorkerClass(workerFile, {
        workerData: { kind, root, mirrorRoot, cacheFile },
      });
      const timer = setTimeout(() => {
        finish(new Error(`growth ${kind} worker timed out`));
      }, timeoutMs);

      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeAllListeners();
        try {
          const termination = worker.terminate();
          if (termination && typeof termination.catch === "function") {
            termination.catch(() => {});
          }
        } catch (_) {}
        if (error) reject(error);
        else resolve(result);
      }

      worker.once("message", (message) => {
        if (!message || message.ok !== true || !message.result) {
          finish(
            new Error(
              (message && message.error) || "growth scan worker returned no result",
            ),
          );
          return;
        }
        finish(null, message.result);
      });
      worker.once("error", (error) => finish(error));
      worker.once("exit", (code) => {
        if (!settled) {
          finish(new Error(`growth ${kind} worker exited with code ${code}`));
        }
      });
    });
  }

  function scanWorkshop() {
    if (workshopInFlight) {
      stats.workshopCoalesced += 1;
      return workshopInFlight;
    }
    workshopInFlight = spawn("workshop")
      .then((result) => {
        lastWorkshopStatus = result.status || null;
        return result;
      })
      .finally(() => {
        workshopInFlight = null;
      });
    return workshopInFlight;
  }

  function scanMirror() {
    if (mirrorInFlight) {
      stats.mirrorCoalesced += 1;
      return mirrorInFlight;
    }
    mirrorInFlight = spawn("mirror").finally(() => {
      mirrorInFlight = null;
    });
    return mirrorInFlight;
  }

  async function scanBodies() {
    // Keep worker CPU bounded: the Workshop and Mirror walks are sequential,
    // while simultaneous callers still share each in-flight result.
    const workshop = await scanWorkshop();
    const mirror = await scanMirror();
    return {
      metrics: GrowthMetrics.attachMirror(workshop.metrics, mirror.metrics),
      status: workshop.status,
    };
  }

  return {
    scanWorkshop,
    scanMirror,
    scanBodies,
    status() {
      return {
        stats: { ...stats },
        workshopInFlight: !!workshopInFlight,
        mirrorInFlight: !!mirrorInFlight,
        lastWorkshopStatus,
      };
    },
  };
}

module.exports = { create };
