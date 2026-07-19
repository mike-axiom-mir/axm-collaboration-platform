'use strict';

const DEFAULT_CELL_SIZE = 512;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function featureBounds(feature) {
  const points = Array.isArray(feature?.points) ? feature.points : null;
  if (points?.length) {
    const xs = points.map((point) => finite(Array.isArray(point) ? point[0] : point.x));
    const ys = points.map((point) => finite(Array.isArray(point) ? point[1] : point.y));
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    return { left, right, top, bottom };
  }
  const left = finite(feature?.x);
  const top = finite(feature?.y);
  const width = Math.max(0, finite(feature?.width ?? feature?.w));
  const height = Math.max(0, finite(feature?.height ?? feature?.h));
  return { left, right: left + width, top, bottom: top + height };
}

function normalizedBounds(bounds) {
  if ('left' in bounds || 'right' in bounds) {
    return {
      left: finite(bounds.left),
      right: finite(bounds.right, finite(bounds.left)),
      top: finite(bounds.top),
      bottom: finite(bounds.bottom, finite(bounds.top)),
    };
  }
  return featureBounds(bounds);
}

function intersects(a, b) {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
}

function indexKey(column, row) {
  return `${column}:${row}`;
}

function createSpatialIndex(features, cellSize = DEFAULT_CELL_SIZE) {
  const safeCellSize = Math.max(64, Math.round(finite(cellSize, DEFAULT_CELL_SIZE)));
  const buckets = new Map();
  for (const feature of features || []) {
    const bounds = featureBounds(feature);
    const firstColumn = Math.floor(bounds.left / safeCellSize);
    const lastColumn = Math.floor(bounds.right / safeCellSize);
    const firstRow = Math.floor(bounds.top / safeCellSize);
    const lastRow = Math.floor(bounds.bottom / safeCellSize);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const key = indexKey(column, row);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(feature);
      }
    }
  }
  return { buckets, cellSize: safeCellSize, sourceLength: features?.length || 0 };
}

function featureIndex(staticMap, field) {
  if (!Object.prototype.hasOwnProperty.call(staticMap, '_spatialIndexes')) {
    Object.defineProperty(staticMap, '_spatialIndexes', {
      value: Object.create(null),
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }
  const source = Array.isArray(staticMap[field]) ? staticMap[field] : [];
  const current = staticMap._spatialIndexes[field];
  if (!current || current.sourceLength !== source.length) {
    staticMap._spatialIndexes[field] = createSpatialIndex(source, staticMap.spatialCellSize);
  }
  return staticMap._spatialIndexes[field];
}

function queryFeatures(staticMap, field, queryBounds) {
  const source = Array.isArray(staticMap?.[field]) ? staticMap[field] : [];
  if (!source.length) return [];
  const bounds = normalizedBounds(queryBounds);
  const index = featureIndex(staticMap, field);
  const firstColumn = Math.floor(bounds.left / index.cellSize);
  const lastColumn = Math.floor(bounds.right / index.cellSize);
  const firstRow = Math.floor(bounds.top / index.cellSize);
  const lastRow = Math.floor(bounds.bottom / index.cellSize);
  const candidates = new Set();
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      for (const feature of index.buckets.get(indexKey(column, row)) || []) candidates.add(feature);
    }
  }
  return [...candidates].filter((feature) => intersects(featureBounds(feature), bounds));
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index];
    const b = points[previous];
    const ax = finite(Array.isArray(a) ? a[0] : a.x);
    const ay = finite(Array.isArray(a) ? a[1] : a.y);
    const bx = finite(Array.isArray(b) ? b[0] : b.x);
    const by = finite(Array.isArray(b) ? b[1] : b.y);
    const crosses = ((ay > y) !== (by > y)) && (x < ((bx - ax) * (y - ay)) / ((by - ay) || Number.EPSILON) + ax);
    if (crosses) inside = !inside;
  }
  return inside;
}

function squaredDistanceToSegment(point, a, b) {
  const ax = finite(Array.isArray(a) ? a[0] : a.x);
  const ay = finite(Array.isArray(a) ? a[1] : a.y);
  const bx = finite(Array.isArray(b) ? b[0] : b.x);
  const by = finite(Array.isArray(b) ? b[1] : b.y);
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared))
    : 0;
  const closestX = ax + dx * amount;
  const closestY = ay + dy * amount;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function circleIntersectsFeature(position, radius, feature) {
  const points = Array.isArray(feature?.points) ? feature.points : null;
  if (points?.length >= 3 && feature.type === 'polygon') {
    if (pointInPolygon(position.x, position.y, points)) return true;
    const radiusSquared = radius ** 2;
    for (let index = 0; index < points.length; index += 1) {
      if (squaredDistanceToSegment(position, points[index], points[(index + 1) % points.length]) <= radiusSquared) return true;
    }
    return false;
  }
  const box = featureBounds(feature);
  const nearestX = Math.max(box.left, Math.min(position.x, box.right));
  const nearestY = Math.max(box.top, Math.min(position.y, box.bottom));
  return (position.x - nearestX) ** 2 + (position.y - nearestY) ** 2 <= radius ** 2;
}

function collidesObstacle(worldOrMap, position, radius = 0) {
  const staticMap = worldOrMap?.staticMap || worldOrMap;
  const query = {
    left: position.x - radius,
    right: position.x + radius,
    top: position.y - radius,
    bottom: position.y + radius,
  };
  return queryFeatures(staticMap, 'obstacles', query)
    .some((feature) => circleIntersectsFeature(position, radius, feature));
}

function pointBlocked(worldOrMap, position) {
  return collidesObstacle(worldOrMap, position, 0);
}

module.exports = {
  DEFAULT_CELL_SIZE,
  circleIntersectsFeature,
  collidesObstacle,
  createSpatialIndex,
  featureBounds,
  pointBlocked,
  pointInPolygon,
  queryFeatures,
};
