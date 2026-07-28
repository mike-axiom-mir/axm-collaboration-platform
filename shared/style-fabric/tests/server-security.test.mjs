import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function requestStatus(port, path) {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}

function waitForPort(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for server startup: ${output}`)),
      5000
    );
    const onData = (chunk) => {
      output += chunk;
      const match = /Local creator: http:\/\/127\.0\.0\.1:(\d+)\/studio\//.exec(output);
      if (!match) return;
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      resolve(Number(match[1]));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before startup with code ${code}: ${output}`));
    });
  });
}

test("local server rejects malformed paths without crashing", async (t) => {
  const child = spawn(process.execPath, ["scripts/serve.mjs", "--port", "0"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  const port = await waitForPort(child);
  assert.equal(await requestStatus(port, "/%ZZ"), 400);
  assert.equal(await requestStatus(port, "/studio/"), 200);
  assert.equal(child.exitCode, null);
});
