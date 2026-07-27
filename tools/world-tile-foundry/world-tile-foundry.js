(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AXMWorldTileFoundry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SOURCE_SCHEMA = 'axm-neutral-world-tile-source/v1';
  var CHUNK_SCHEMA = 'axm-neutral-world-chunk/v1';
  var PROJECT_SCHEMA = 'axm.world-tile-edit-project/v1';
  var HANDOFF_SCHEMA = 'axm.world-tile-remap/v1';
  var LAYERS = ['ground', 'road', 'sidewalk', 'building', 'park', 'water', 'rail'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, limit) { return String(value == null ? '' : value).trim().slice(0, limit || 160); }
  function number(value, fallback) { var n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function bool(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
  function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function slug(value) { return text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world-draft'; }
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (isObject(value)) return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + stable(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function digest32(value) {
    var source = typeof value === 'string' ? value : stable(value), hash = 2166136261;
    for (var i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }
  function unique(values) { return Array.from(new Set(values)); }
  function rectValid(rect, world) {
    return isObject(rect) && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
      rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 &&
      rect.x + rect.width <= world.width && rect.y + rect.height <= world.height;
  }
  function pointInRoundedRect(x, y, region) {
    var radius = Math.max(0, Math.min(region.radius || 0, region.width / 2, region.height / 2));
    if (x < region.x || y < region.y || x > region.x + region.width || y > region.y + region.height) return false;
    var nearestX = Math.max(region.x + radius, Math.min(x, region.x + region.width - radius));
    var nearestY = Math.max(region.y + radius, Math.min(y, region.y + region.height - radius));
    var dx = x - nearestX, dy = y - nearestY;
    return dx * dx + dy * dy <= radius * radius;
  }
  function pointInPolygon(x, y, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i].x, yi = points[i].y, xj = points[j].x, yj = points[j].y;
      var intersects = ((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }
  function rectInsideBuildRegion(rect, source) {
    if (!rectValid(rect, source.world)) return false;
    var region = source.buildRegion;
    if (!region) return true;
    if (region.shape === 'circle') {
      var cx = number(region.centerX, region.x + region.width / 2), cy = number(region.centerY, region.y + region.height / 2), radius = number(region.radius, Math.min(region.width, region.height) / 2);
      return [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]].every(function (point) {
        var dx = point[0] - cx, dy = point[1] - cy;
        return dx * dx + dy * dy <= radius * radius;
      });
    }
    if (region.shape === 'polygon') return [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]].every(function (point) { return pointInPolygon(point[0], point[1], region.points || []); });
    if (region.shape !== 'rounded-rect') return false;
    return [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x, rect.y + rect.height], [rect.x + rect.width, rect.y + rect.height]]
      .every(function (point) { return pointInRoundedRect(point[0], point[1], region); });
  }

  function validateSource(source) {
    var errors = [];
    if (!isObject(source) || source.schema !== SOURCE_SCHEMA) errors.push('source must use ' + SOURCE_SCHEMA);
    if (!source || !text(source.id)) errors.push('source id is required');
    if (!source || !isObject(source.world) || !Number.isFinite(source.world.width) || !Number.isFinite(source.world.height)) errors.push('bounded world dimensions are required');
    if (!source || !isObject(source.chunking) || !Number.isInteger(source.chunking.count) || !Array.isArray(source.chunking.chunks) || source.chunking.chunks.length !== source.chunking.count) errors.push('complete chunk manifest is required');
    if (source && source.chunking && source.chunking.implicitEmpty) {
      if (!Number.isInteger(source.chunking.possibleCount) || source.chunking.possibleCount < source.chunking.count) errors.push('sparse chunk manifest requires a possible count no smaller than its materialized count');
      if (source.chunking.materializedCount !== source.chunking.count) errors.push('sparse materialized count must equal stored chunk count');
    }
    var included = source && source.layers && source.layers.included;
    if (!Array.isArray(included) || included.some(function (layer) { return !LAYERS.includes(layer); })) errors.push('source layers are missing or unsupported');
    if (!source || !text(source.semanticChunksSha256)) errors.push('semantic chunk digest is required');
    if (!source || !source.rasterAlignment || !text(source.rasterAlignment.masterSha256)) errors.push('aligned raster digest is required');
    if (source && source.creativeGrid && (!Number.isFinite(source.creativeGrid.cellWidth) || !Number.isFinite(source.creativeGrid.cellHeight))) errors.push('creative grid cell dimensions must be finite');
    if (source && source.buildRegion) {
      var region = source.buildRegion, regionBoundsValid = rectValid(region, source.world);
      if (region.shape === 'polygon') {
        if (!Array.isArray(region.points) || region.points.length < 3 || region.points.some(function (point) { return !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > source.world.width || point.y > source.world.height; })) errors.push('polygon build region requires at least three bounded points');
      } else if (!regionBoundsValid || ['rounded-rect', 'circle'].indexOf(region.shape) < 0) errors.push('build region must be a bounded rounded rectangle, circle or polygon');
      if (region.shape === 'circle' && (!Number.isFinite(region.radius) || region.radius <= 0 || region.width !== region.height)) errors.push('circular build region requires a positive radius and square bounds');
    }
    if (source && source.canvasModes) {
      var flat = source.canvasModes.flat2d, spatial = source.canvasModes.spatial3d;
      if (!flat || !flat.enabled || !flat.assetCellPixels || flat.assetCellPixels.width !== 128 || flat.assetCellPixels.height !== 128 || flat.pixelsPerMetre !== 128) errors.push('flat canvas must declare the 128 px per metre profile');
      if (!spatial || !spatial.enabled || !spatial.placementCellMetres || spatial.placementCellMetres.width !== 1 || spatial.placementCellMetres.depth !== 1 || spatial.placementCellMetres.height !== 0.5) errors.push('spatial canvas must declare the 1 x 1 x 0.5 metre placement profile');
      if (!spatial || !spatial.heightPolicyMetres || spatial.heightPolicyMetres.ground !== 0 || !(spatial.heightPolicyMetres.playableMinimum < 0) || spatial.heightPolicyMetres.reservedMinimum > spatial.heightPolicyMetres.playableMinimum || !(spatial.heightPolicyMetres.playableMaximum > 0) || spatial.heightPolicyMetres.reservedMaximum < spatial.heightPolicyMetres.playableMaximum) errors.push('spatial canvas must keep bounded playable height and depth inside its reserved volume');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function validateChunk(chunk, source, expected) {
    var errors = [], seen = new Set();
    if (!isObject(chunk) || chunk.schema !== CHUNK_SCHEMA) errors.push('chunk must use ' + CHUNK_SCHEMA);
    if (!chunk || !isObject(chunk.bounds)) errors.push('chunk bounds are required');
    if (expected && chunk && (chunk.column !== expected.column || chunk.row !== expected.row)) errors.push('chunk coordinate does not match manifest');
    LAYERS.forEach(function (layer) {
      var values = chunk && chunk.layers && chunk.layers[layer];
      if (!Array.isArray(values)) return errors.push(layer + ' array is required');
      values.forEach(function (feature) {
        if (!text(feature.id)) errors.push(layer + ' feature id is required');
        else if (seen.has(feature.id)) errors.push('duplicate feature id ' + feature.id);
        else seen.add(feature.id);
        if (!feature.geometry || feature.geometry.type !== 'rect' || !rectValid(feature.geometry.world, source.world)) errors.push((feature.id || layer) + ' has invalid world geometry');
        if (!feature.geometry || !isObject(feature.geometry.chunkLocal)) errors.push((feature.id || layer) + ' needs chunk-local geometry');
        if (typeof feature.walkable !== 'boolean' || typeof feature.collidable !== 'boolean') errors.push((feature.id || layer) + ' needs boolean navigation flags');
        if (!Number.isFinite(feature.navigationPriority)) errors.push((feature.id || layer) + ' needs navigation priority');
      });
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function flattenChunks(source, chunks) {
    var sourceCheck = validateSource(source);
    if (!sourceCheck.ok) throw new Error(sourceCheck.errors.join('; '));
    if (!Array.isArray(chunks) || chunks.length !== source.chunking.count) throw new Error('Expected ' + source.chunking.count + ' chunks');
    var features = [], ids = new Set(), errors = [];
    source.chunking.chunks.forEach(function (entry, index) {
      var chunk = chunks[index], check = validateChunk(chunk, source, entry);
      if (!check.ok) errors = errors.concat(check.errors.map(function (message) { return entry.id + ': ' + message; }));
      LAYERS.forEach(function (layer) {
        ((chunk && chunk.layers && chunk.layers[layer]) || []).forEach(function (feature) {
          if (ids.has(feature.id)) errors.push('duplicate world feature id ' + feature.id);
          ids.add(feature.id);
          var copy = clone(feature);
          copy.layer = layer;
          copy.chunk = { column: chunk.column, row: chunk.row };
          features.push(copy);
        });
      });
    });
    if (errors.length) throw new Error(errors.slice(0, 20).join('; '));
    return features;
  }

  function createProject(source, name) {
    var check = validateSource(source);
    if (!check.ok) throw new Error(check.errors.join('; '));
    var title = text(name, 100) || 'Untitled world remap';
    return {
      schema: PROJECT_SCHEMA,
      id: slug(title),
      name: title,
      base: {
        schema: source.schema,
        id: source.id,
        semanticChunksSha256: source.semanticChunksSha256,
        rasterSha256: source.rasterAlignment.masterSha256,
        width: source.world.width,
        height: source.world.height,
        canonicalUnit: source.world.canonicalUnit || null,
        canvasModes: clone(source.canvasModes || null),
        scaleReferences: clone(source.scaleReferences || null),
        creativeGrid: clone(source.creativeGrid || null),
        buildRegion: clone(source.buildRegion || null)
      },
      materialRemaps: {},
      overrides: {},
      additions: [],
      removedFeatureIds: [],
      notes: '',
      revision: 0
    };
  }

  function validatePatchFeature(feature, source, requireId) {
    var errors = [];
    if (!isObject(feature)) return ['feature patch must be an object'];
    if (requireId && !text(feature.id)) errors.push('feature id is required');
    if (feature.layer != null && !LAYERS.includes(feature.layer)) errors.push('unsupported layer ' + feature.layer);
    if (feature.geometry && (!feature.geometry.world || !rectInsideBuildRegion(feature.geometry.world, source))) errors.push('feature geometry exceeds the buildable rounded world');
    if (feature.walkable != null && typeof feature.walkable !== 'boolean') errors.push('walkable must be boolean');
    if (feature.collidable != null && typeof feature.collidable !== 'boolean') errors.push('collidable must be boolean');
    if (feature.navigationPriority != null && !Number.isFinite(feature.navigationPriority)) errors.push('navigationPriority must be finite');
    if (feature.elevationMetres != null && !Number.isFinite(feature.elevationMetres)) errors.push('elevationMetres must be finite');
    if (feature.heightMetres != null && (!Number.isFinite(feature.heightMetres) || feature.heightMetres < 0)) errors.push('heightMetres must be zero or greater');
    var heightPolicy = source && source.canvasModes && source.canvasModes.spatial3d && source.canvasModes.spatial3d.heightPolicyMetres;
    if (heightPolicy && feature.elevationMetres != null && feature.elevationMetres < heightPolicy.playableMinimum) errors.push('feature exceeds the current playable depth; reserved underground layers are not yet buildable');
    if (heightPolicy && feature.elevationMetres != null && feature.heightMetres != null && feature.elevationMetres + feature.heightMetres > heightPolicy.playableMaximum) errors.push('feature exceeds the current playable height; reserved height is not yet buildable');
    return errors;
  }

  function validateProject(project, source) {
    var errors = [], sourceCheck = validateSource(source);
    if (!sourceCheck.ok) return sourceCheck;
    if (!isObject(project) || project.schema !== PROJECT_SCHEMA) errors.push('project must use ' + PROJECT_SCHEMA);
    if (!project || !project.base || project.base.id !== source.id || project.base.semanticChunksSha256 !== source.semanticChunksSha256 || project.base.rasterSha256 !== source.rasterAlignment.masterSha256) errors.push('project base digests do not match this world source');
    if (!project || !isObject(project.materialRemaps) || !isObject(project.overrides) || !Array.isArray(project.additions) || !Array.isArray(project.removedFeatureIds)) errors.push('project change sets are malformed');
    if (project && isObject(project.materialRemaps)) Object.keys(project.materialRemaps).forEach(function (layer) {
      if (!LAYERS.includes(layer)) errors.push('unsupported material-remap layer ' + layer);
      if (!text(project.materialRemaps[layer], 80)) errors.push('empty material remap for ' + layer);
    });
    if (project && isObject(project.overrides)) Object.keys(project.overrides).forEach(function (id) {
      errors = errors.concat(validatePatchFeature(project.overrides[id], source, false).map(function (message) { return id + ': ' + message; }));
    });
    if (project && Array.isArray(project.additions)) project.additions.forEach(function (feature, index) {
      errors = errors.concat(validatePatchFeature(feature, source, true).map(function (message) { return 'addition ' + index + ': ' + message; }));
    });
    if (project && Array.isArray(project.removedFeatureIds) && unique(project.removedFeatureIds).length !== project.removedFeatureIds.length) errors.push('removed feature ids must be unique');
    return { ok: errors.length === 0, errors: errors };
  }

  function withRevision(project) { project.revision = Math.max(0, Math.floor(number(project.revision, 0))) + 1; return project; }
  function setMaterialRemap(project, layer, material) {
    var next = clone(project), value = text(material, 80);
    if (!LAYERS.includes(layer)) throw new Error('Unsupported layer ' + layer);
    if (value) next.materialRemaps[layer] = value; else delete next.materialRemaps[layer];
    return withRevision(next);
  }
  function setOverride(project, featureId, patch) {
    var next = clone(project), id = text(featureId, 160);
    if (!id) throw new Error('Feature id is required');
    var clean = {};
    ['material', 'role', 'walkable', 'collidable', 'navigationPriority', 'elevationMetres', 'heightMetres'].forEach(function (key) { if (patch[key] != null) clean[key] = clone(patch[key]); });
    if (!Object.keys(clean).length) delete next.overrides[id]; else next.overrides[id] = clean;
    next.removedFeatureIds = next.removedFeatureIds.filter(function (value) { return value !== id; });
    return withRevision(next);
  }
  function removeFeature(project, featureId) {
    var next = clone(project), id = text(featureId, 160);
    if (!id) throw new Error('Feature id is required');
    if (!next.removedFeatureIds.includes(id)) next.removedFeatureIds.push(id);
    delete next.overrides[id];
    next.additions = next.additions.filter(function (feature) { return feature.id !== id; });
    return withRevision(next);
  }
  function restoreFeature(project, featureId) {
    var next = clone(project), id = text(featureId, 160);
    next.removedFeatureIds = next.removedFeatureIds.filter(function (value) { return value !== id; });
    delete next.overrides[id];
    return withRevision(next);
  }
  function addFeature(project, source, input) {
    var next = clone(project), layer = LAYERS.includes(input.layer) ? input.layer : 'ground';
    var id = text(input.id, 160) || 'addition-' + layer + '-' + digest32({ revision: next.revision, input: input, count: next.additions.length });
    if (!rectInsideBuildRegion(input.geometry && input.geometry.world, source)) throw new Error('Drawn rectangle must stay inside the buildable world region');
    var feature = {
      id: id,
      layer: layer,
      geometry: { type: 'rect', world: clone(input.geometry.world) },
      material: text(input.material, 80) || layer,
      role: text(input.role, 80) || 'game_design_overlay',
      walkable: bool(input.walkable, layer !== 'building' && layer !== 'water'),
      collidable: bool(input.collidable, layer === 'building' || layer === 'water'),
      navigationPriority: Math.round(number(input.navigationPriority, 60)),
      elevationMetres: number(input.elevationMetres, 0),
      heightMetres: Math.max(0, number(input.heightMetres, layer === 'ground' ? 0 : 0.5))
    };
    next.additions.push(feature);
    return withRevision(next);
  }
  function applyProject(features, project) {
    var removed = new Set(project.removedFeatureIds || []), overrides = project.overrides || {}, remaps = project.materialRemaps || {};
    var result = features.filter(function (feature) { return !removed.has(feature.id); }).map(function (feature) {
      var next = clone(feature), patch = overrides[feature.id] || {};
      if (remaps[next.layer]) next.material = remaps[next.layer];
      Object.keys(patch).forEach(function (key) { next[key] = clone(patch[key]); });
      next.editState = overrides[feature.id] ? 'overridden' : remaps[next.layer] ? 'remapped' : 'base';
      return next;
    });
    (project.additions || []).forEach(function (feature) { var next = clone(feature); next.editState = 'addition'; result.push(next); });
    return result;
  }
  function farmStarter(project) {
    var next = clone(project), values = {
      ground: 'farm_grass', road: 'farm_path', sidewalk: 'village_path', building: 'farm_structure',
      park: 'arable_field', water: 'pond_and_stream', rail: 'boundary_fence'
    };
    Object.keys(values).forEach(function (layer) { next.materialRemaps[layer] = values[layer]; });
    next.notes = text((next.notes ? next.notes + '\n' : '') + 'Farm starter profile is a draft remap, not a finished farm design.', 2000);
    return withRevision(next);
  }
  function buildHandoff(source, project) {
    var check = validateProject(project, source);
    if (!check.ok) throw new Error(check.errors.join('; '));
    var changes = {
      materialRemaps: clone(project.materialRemaps),
      overrides: clone(project.overrides),
      additions: clone(project.additions),
      removedFeatureIds: clone(project.removedFeatureIds)
    };
    var payload = {
      schema: HANDOFF_SCHEMA,
      id: slug(project.id || project.name),
      name: text(project.name, 100),
      base: clone(project.base),
      changes: changes,
      notes: text(project.notes, 2000),
      truth: {
        canonicalBaseChanged: false,
        rasterPixelsChanged: false,
        runtimeStateIncluded: false,
        automaticPromotion: false,
        humanPromotionRequired: true
      },
      verification: {
        projectValid: true,
        sourceContract: source.schema,
        changeDigest32: digest32(changes)
      }
    };
    payload.digest32 = digest32(payload);
    return payload;
  }

  return {
    SOURCE_SCHEMA: SOURCE_SCHEMA,
    CHUNK_SCHEMA: CHUNK_SCHEMA,
    PROJECT_SCHEMA: PROJECT_SCHEMA,
    HANDOFF_SCHEMA: HANDOFF_SCHEMA,
    LAYERS: LAYERS.slice(),
    stable: stable,
    digest32: digest32,
    validateSource: validateSource,
    validateChunk: validateChunk,
    rectInsideBuildRegion: rectInsideBuildRegion,
    flattenChunks: flattenChunks,
    createProject: createProject,
    validateProject: validateProject,
    setMaterialRemap: setMaterialRemap,
    setOverride: setOverride,
    removeFeature: removeFeature,
    restoreFeature: restoreFeature,
    addFeature: addFeature,
    applyProject: applyProject,
    farmStarter: farmStarter,
    buildHandoff: buildHandoff
  };
});
