"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function parseArgs(argv) {
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walk(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else files.push(file);
  }
  return files;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set([
  "a", "an", "and", "as", "at", "automatic", "axm", "by", "component",
  "for", "from", "in", "into", "is", "it", "local", "module", "no", "of",
  "on", "or", "seed", "shared", "that", "the", "to", "tool", "v1", "with"
]);

function tokens(manifest) {
  const text = [
    manifest.id,
    manifest.name,
    manifest.summary,
    ...(manifest.actions || []),
    ...(manifest.tags || []),
    ...(manifest.accepts || []),
    ...(manifest.produces || [])
  ].join(" ");
  return new Set(normalize(text).split(/\s+/).filter(token => token.length > 2 && !STOP.has(token)));
}

function jaccard(left, right) {
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
}

function duplicateStats(files, root) {
  const groups = new Map();
  for (const file of files) {
    const digest = sha256File(file);
    if (!groups.has(digest)) groups.set(digest, []);
    groups.get(digest).push(file);
  }
  const duplicates = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([digest, rows]) => ({
      digest,
      copies: rows.length,
      bytesEach: fs.statSync(rows[0]).size,
      redundantBytes: fs.statSync(rows[0]).size * (rows.length - 1),
      paths: rows.map(file => path.relative(root, file).replace(/\\/g, "/"))
    }))
    .sort((a, b) => b.redundantBytes - a.redundantBytes || b.copies - a.copies);
  return {
    exactDuplicateGroups: duplicates.length,
    exactDuplicateFiles: duplicates.reduce((sum, row) => sum + row.copies - 1, 0),
    redundantBytes: duplicates.reduce((sum, row) => sum + row.redundantBytes, 0),
    largestGroups: duplicates.slice(0, 25)
  };
}

const args = parseArgs(process.argv);
const source = path.resolve(args.source || "");
const workspace = path.resolve(args.workspace || process.cwd());
const output = args.out ? path.resolve(args.out) : null;
if (!source || !fs.existsSync(path.join(source, "04_MODULES"))) {
  throw new Error("--source must name the extracted portfolio root");
}

const moduleRoot = path.join(source, "04_MODULES");
const moduleDirs = fs.readdirSync(moduleRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(moduleRoot, entry.name, "manifest.json")))
  .map(entry => entry.name)
  .sort();

const liveRoot = path.join(workspace, "tools");
const live = fs.readdirSync(liveRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(liveRoot, entry.name, "manifest.json")))
  .map(entry => {
    const manifestPath = path.join(liveRoot, entry.name, "manifest.json");
    return { slug: entry.name, manifestPath, manifest: readJson(manifestPath) };
  });
const liveIds = new Map(live.map(item => [normalize(item.manifest.id), item]));
const liveSlugs = new Map(live.map(item => [normalize(item.slug), item]));
const liveNames = new Map(live.map(item => [normalize(item.manifest.name), item]));
const liveCodeDigests = new Map();
for (const file of walk(liveRoot).filter(file => file.endsWith(".js"))) {
  const digest = sha256File(file);
  if (!liveCodeDigests.has(digest)) liveCodeDigests.set(digest, []);
  liveCodeDigests.get(digest).push(path.relative(workspace, file).replace(/\\/g, "/"));
}

const modules = [];
for (const slug of moduleDirs) {
  const dir = path.join(moduleRoot, slug);
  const manifest = readJson(path.join(dir, "manifest.json"));
  const contract = readJson(path.join(dir, "module.contract.json"));
  const sourceFile = path.join(dir, manifest.entry || "index.js");
  const code = fs.readFileSync(sourceFile, "utf8");
  const dependencyNames = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1]);
  const externalDependencies = dependencyNames.filter(name => !name.startsWith(".") && !require("module").builtinModules.includes(name));
  const effectBuiltins = dependencyNames.filter(name => ["child_process", "http", "https", "net", "tls", "dgram", "worker_threads"].includes(name));
  const filesystemSurface = dependencyNames.includes("fs");
  const exactId = liveIds.get(normalize(manifest.id));
  const exactSlug = liveSlugs.get(normalize(slug));
  const exactName = liveNames.get(normalize(manifest.name));
  const sourceTokens = tokens(manifest);
  const semantic = live
    .map(item => ({ id: item.manifest.id, slug: item.slug, score: jaccard(sourceTokens, tokens(item.manifest)) }))
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)))[0];
  const codeDigest = sha256File(sourceFile);
  const liveCodeMatches = liveCodeDigests.get(codeDigest) || [];
  const exportedMatch = code.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
  const exportedSymbols = exportedMatch
    ? exportedMatch[1].split(",").map(value => value.trim().split(":")[0].trim()).filter(Boolean)
    : [];
  const highSemanticOverlap = semantic && semantic.score >= 0.4;
  const collision = Boolean(exactId || exactSlug || exactName || liveCodeMatches.length);
  modules.push({
    seedId: manifest.id,
    slug,
    name: manifest.name,
    version: manifest.version,
    authoredStatus: manifest.status,
    category: manifest.category,
    actions: manifest.actions || [],
    accepts: manifest.accepts || [],
    produces: manifest.produces || [],
    permissions: manifest.permissions,
    automaticMutation: contract.authority && contract.authority.automaticMutation,
    sourceBytes: fs.statSync(sourceFile).size,
    sourceLines: code.split(/\r?\n/).length,
    exportedSymbols,
    dependencies: dependencyNames,
    externalDependencies,
    effectBuiltins,
    filesystemSurface,
    codeDigest,
    liveCollision: {
      exactId: exactId ? exactId.manifest.id : null,
      exactSlug: exactSlug ? exactSlug.manifest.id : null,
      exactName: exactName ? exactName.manifest.id : null,
      exactCodePaths: liveCodeMatches
    },
    closestLiveTool: semantic ? { ...semantic, score: Number(semantic.score.toFixed(4)) } : null,
    disposition: collision ? "HOLD_EXACT_LIVE_COLLISION" : highSemanticOverlap ? "BUNDLE_WITH_OVERLAP_NOTE" : "BUNDLE_AS_DISTINCT_EXPERIMENTAL_COMPONENT"
  });
}

const ids = modules.map(item => item.seedId);
const sourceFiles = walk(source).filter(file => path.basename(file) !== "FILE_MANIFEST.sha256");
const duplicateAnalysis = duplicateStats(sourceFiles, source);
const summary = {
  sourceModules: modules.length,
  uniqueSeedIds: new Set(ids).size,
  authoredExperimental: modules.filter(item => item.authoredStatus === "EXPERIMENTAL").length,
  emptyPermissions: modules.filter(item => Array.isArray(item.permissions) && item.permissions.length === 0).length,
  automaticMutationFalse: modules.filter(item => item.automaticMutation === false).length,
  externalDependencyFree: modules.filter(item => item.externalDependencies.length === 0).length,
  networkOrProcessEffectSurface: modules.filter(item => item.effectBuiltins.length > 0).length,
  filesystemSurface: modules.filter(item => item.filesystemSurface).length,
  exactLiveCollisions: modules.filter(item => item.disposition === "HOLD_EXACT_LIVE_COLLISION").length,
  semanticOverlapNotes: modules.filter(item => item.disposition === "BUNDLE_WITH_OVERLAP_NOTE").length,
  distinctBundleCandidates: modules.filter(item => item.disposition === "BUNDLE_AS_DISTINCT_EXPERIMENTAL_COMPONENT").length,
  liveToolsCompared: live.length,
  sourceIndexBytes: modules.reduce((sum, item) => sum + item.sourceBytes, 0),
  exportedSymbols: modules.reduce((sum, item) => sum + item.exportedSymbols.length, 0),
  exactDuplicateGroupsInPackage: duplicateAnalysis.exactDuplicateGroups,
  redundantBytesInPackage: duplicateAnalysis.redundantBytes
};

const report = {
  schema: "axm.seed-portfolio-intake-analysis/v1",
  generatedAt: new Date().toISOString(),
  source,
  workspace,
  posture: {
    sourceStatus: "READY_FOR_LOCAL_QUARANTINE_INTAKE",
    localVerification: "PASS",
    activeIntegration: "ANALYSIS_ONLY",
    automaticInstall: false,
    automaticPromotion: false,
    canon: false
  },
  summary,
  duplicateAnalysis,
  modules
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, serialized);
}
console.log(JSON.stringify({ schema: report.schema, output, summary }, null, 2));
