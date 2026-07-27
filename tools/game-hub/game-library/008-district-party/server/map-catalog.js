'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function invalidMap(message) {
  return Object.assign(new Error(message), { code: 'INVALID_MAP' });
}

function safeDataPath(projectRoot, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.startsWith('data/')) {
    throw invalidMap('Map catalog files must stay inside the local data directory.');
  }
  const dataRoot = path.resolve(projectRoot, 'data');
  const candidate = path.resolve(projectRoot, relativePath);
  if (candidate !== dataRoot && !candidate.startsWith(`${dataRoot}${path.sep}`)) {
    throw invalidMap('Map catalog path escaped the local data directory.');
  }
  return candidate;
}

function loadMapCatalog(projectRoot) {
  const catalogPath = path.join(projectRoot, 'data', 'map-catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (error) {
    throw invalidMap(`Map catalog could not be loaded: ${error.message}`);
  }
  if (!Array.isArray(catalog.maps) || !catalog.maps.length) throw invalidMap('Map catalog is empty.');
  const ids = new Set();
  for (const entry of catalog.maps) {
    if (!MAP_ID_PATTERN.test(entry?.id || '') || ids.has(entry.id)) throw invalidMap('Map catalog contains an invalid or duplicate id.');
    ids.add(entry.id);
    for (const relativePath of Object.values(entry.files || {})) safeDataPath(projectRoot, relativePath);
    if (!entry.files?.map || !entry.files?.cityArt) throw invalidMap(`Map ${entry.id} is missing required files.`);
  }
  if (!ids.has(catalog.defaultMapId)) throw invalidMap('Map catalog default id is not registered.');
  catalog.maps.sort((a, b) => (Number(a.slot) || Number.MAX_SAFE_INTEGER) - (Number(b.slot) || Number.MAX_SAFE_INTEGER));
  return catalog;
}

function resolveMapSelection(projectRoot, requestedMapId) {
  const catalog = loadMapCatalog(projectRoot);
  const mapId = requestedMapId == null || requestedMapId === '' ? catalog.defaultMapId : requestedMapId;
  if (!MAP_ID_PATTERN.test(mapId)) throw invalidMap('Unknown map selection.');
  const entry = catalog.maps.find((candidate) => candidate.id === mapId);
  if (!entry) throw invalidMap('Unknown map selection.');
  const files = Object.fromEntries(Object.entries(entry.files).map(([key, relativePath]) => [key, safeDataPath(projectRoot, relativePath)]));
  return {
    ...entry,
    files,
    relativeFiles: { ...entry.files },
    mapUrl: `/${entry.files.map.replaceAll('\\', '/')}`,
    cityArtUrl: `/${entry.files.cityArt.replaceAll('\\', '/')}`,
    dataDirectory: path.dirname(files.map),
  };
}

function publicMapCatalog(projectRoot) {
  const catalog = loadMapCatalog(projectRoot);
  return {
    schemaVersion: catalog.schemaVersion,
    defaultMapId: catalog.defaultMapId,
    maps: catalog.maps.map(({ files, ...entry }) => ({ ...entry })),
  };
}

module.exports = { loadMapCatalog, publicMapCatalog, resolveMapSelection, safeDataPath };
