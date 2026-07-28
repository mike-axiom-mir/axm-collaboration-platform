import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argumentsList = process.argv.slice(2);
const argumentValue = (name) => {
  const index = argumentsList.indexOf(name);
  return index >= 0 ? argumentsList[index + 1] : undefined;
};
const port = Number.parseInt(argumentValue("--port") ?? process.env.AXM_STYLE_PORT ?? "8840", 10);
const host = argumentValue("--host") ?? process.env.AXM_STYLE_HOST ?? "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function safePath(requestUrl) {
  const path = decodeURIComponent(new URL(requestUrl, `http://${host}:${port}`).pathname);
  const requested = path.endsWith("/") ? `${path}index.html` : path;
  const candidate = normalize(join(root, requested));
  const relation = relative(root, candidate);
  if (relation.startsWith("..") || relation.includes(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    return null;
  }
  return candidate;
}

const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  const requestPath = new URL(request.url, `http://${host}:${port}`).pathname;
  if (requestPath === "/") {
    response.writeHead(302, { Location: "/studio/" });
    response.end();
    return;
  }

  const path = safePath(request.url);
  if (!path) {
    response.writeHead(400);
    response.end("Invalid path");
    return;
  }

  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(path).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`AXM Style Fabric WORKING / TEST`);
  console.log(`Local creator: http://${host}:${port}/studio/`);
  console.log(`Network access: disabled by default`);
  console.log(`Stop: Ctrl+C`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
