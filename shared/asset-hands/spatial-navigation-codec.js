(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMSpatialNavigationCodec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var VERSION = "1.0.0",
    COLLISION_SCHEMA = "collision-mesh+json",
    NAVIGATION_SCHEMA = "navigation-mesh+json";
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function hash(value) {
    var source = typeof value === "string" ? value : JSON.stringify(value),
      output = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      output ^= source.charCodeAt(index);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(16).padStart(8, "0");
  }
  function triangleArea(a, b, c) {
    var ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    return (
      Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * 0.5
    );
  }
  function buildCollision(dimensions, origin, policy) {
    var width = dimensions[0],
      height = dimensions[1],
      depth = dimensions[2],
      ox = origin[0],
      oy = origin[1],
      oz = origin[2],
      obstacle = {
        id: "obstacle-0",
        type: "aabb",
        center: [ox + width * 0.25, oy + height * 0.25, oz + depth * 0.25],
        size: [width * 0.2, Math.max(height * 0.5, 0.01), depth * 0.2],
        layer: "world-solid",
        mask: ["player", "agent"],
      },
      hx = obstacle.size[0] / 2,
      hy = obstacle.size[1] / 2,
      hz = obstacle.size[2] / 2,
      cx = obstacle.center[0],
      cy = obstacle.center[1],
      cz = obstacle.center[2],
      vertices = [
        [ox - width / 2, oy, oz - depth / 2],
        [ox + width / 2, oy, oz - depth / 2],
        [ox + width / 2, oy, oz + depth / 2],
        [ox - width / 2, oy, oz + depth / 2],
        [cx - hx, cy - hy, cz - hz],
        [cx + hx, cy - hy, cz - hz],
        [cx + hx, cy + hy, cz - hz],
        [cx - hx, cy + hy, cz - hz],
        [cx - hx, cy - hy, cz + hz],
        [cx + hx, cy - hy, cz + hz],
        [cx + hx, cy + hy, cz + hz],
        [cx - hx, cy + hy, cz + hz],
      ],
      triangles = [
        [0, 2, 1],
        [0, 3, 2],
        [4, 6, 5],
        [4, 7, 6],
        [8, 9, 10],
        [8, 10, 11],
        [4, 5, 9],
        [4, 9, 8],
        [7, 11, 10],
        [7, 10, 6],
        [5, 6, 10],
        [5, 10, 9],
        [4, 8, 11],
        [4, 11, 7],
      ];
    return {
      schema: COLLISION_SCHEMA,
      version: "1.0.0",
      id: "collision-" + hash([dimensions, origin, policy]),
      target_canvas: null,
      coordinate_unit: "metre",
      policy: policy,
      world_scale: 1,
      vertices: vertices,
      triangles: triangles,
      shapes: [
        {
          id: "ground",
          type: "plane",
          layer: "world-solid",
          mask: ["player", "agent"],
          triangle_range: [0, 2],
        },
        obstacle,
      ],
      layers: [{ id: "world-solid", collides_with: ["player", "agent"] }],
      bounds: {
        minimum: [ox - width / 2, oy, oz - depth / 2],
        maximum: [ox + width / 2, oy + height, oz + depth / 2],
      },
      provenance: {},
    };
  }
  function overlapsObstacle(minX, maxX, minZ, maxZ, obstacle) {
    var halfX = obstacle.size[0] / 2,
      halfZ = obstacle.size[2] / 2,
      obstacleMinX = obstacle.center[0] - halfX,
      obstacleMaxX = obstacle.center[0] + halfX,
      obstacleMinZ = obstacle.center[2] - halfZ,
      obstacleMaxZ = obstacle.center[2] + halfZ;
    return (
      maxX > obstacleMinX &&
      minX < obstacleMaxX &&
      maxZ > obstacleMinZ &&
      minZ < obstacleMaxZ
    );
  }
  function adjacency(polygons) {
    var edges = {},
      output = polygons.map(function () {
        return [];
      });
    polygons.forEach(function (polygon, polygonIndex) {
      for (var index = 0; index < polygon.length; index += 1) {
        var left = polygon[index],
          right = polygon[(index + 1) % polygon.length],
          key = Math.min(left, right) + ":" + Math.max(left, right);
        if (edges[key] != null) {
          output[polygonIndex].push(edges[key]);
          output[edges[key]].push(polygonIndex);
        } else edges[key] = polygonIndex;
      }
    });
    return output.map(function (list) {
      return Array.from(new Set(list)).sort(function (a, b) {
        return a - b;
      });
    });
  }
  function buildNavigation(dimensions, origin, obstacle, divisions, settings) {
    var width = dimensions[0],
      depth = dimensions[2],
      ox = origin[0],
      oy = origin[1],
      oz = origin[2],
      vertices = [],
      polygons = [],
      excluded = [];
    for (var z = 0; z <= divisions; z += 1)
      for (var x = 0; x <= divisions; x += 1)
        vertices.push([
          ox - width / 2 + (width * x) / divisions,
          oy,
          oz - depth / 2 + (depth * z) / divisions,
        ]);
    function vertex(x, z) {
      return z * (divisions + 1) + x;
    }
    for (var cellZ = 0; cellZ < divisions; cellZ += 1)
      for (var cellX = 0; cellX < divisions; cellX += 1) {
        var minX = ox - width / 2 + (width * cellX) / divisions,
          maxX = ox - width / 2 + (width * (cellX + 1)) / divisions,
          minZ = oz - depth / 2 + (depth * cellZ) / divisions,
          maxZ = oz - depth / 2 + (depth * (cellZ + 1)) / divisions;
        if (overlapsObstacle(minX, maxX, minZ, maxZ, obstacle)) {
          excluded.push({
            cell: [cellX, cellZ],
            reason: "collision-obstacle",
            bounds: { minimum: [minX, oy, minZ], maximum: [maxX, oy, maxZ] },
          });
          continue;
        }
        var a = vertex(cellX, cellZ),
          b = vertex(cellX + 1, cellZ),
          c = vertex(cellX + 1, cellZ + 1),
          d = vertex(cellX, cellZ + 1);
        polygons.push([a, c, b], [a, d, c]);
      }
    return {
      schema: NAVIGATION_SCHEMA,
      version: "1.0.0",
      id: "navigation-" + hash([dimensions, origin, divisions, settings]),
      target_canvas: null,
      coordinate_unit: "metre",
      settings: {
        divisions: divisions,
        cell_size: [width / divisions, depth / divisions],
        agent_radius: settings.agentRadius,
        agent_height: settings.agentHeight,
        max_slope_degrees: settings.maxSlopeDegrees,
        step_height: settings.stepHeight,
      },
      vertices: vertices,
      polygons: polygons,
      adjacency: adjacency(polygons),
      walkable_bounds: {
        minimum: [ox - width / 2, oy, oz - depth / 2],
        maximum: [ox + width / 2, oy, oz + depth / 2],
      },
      excluded_regions: excluded,
      provenance: {},
    };
  }
  function connected(adjacencyList) {
    if (!adjacencyList.length) return false;
    var seen = { 0: true },
      queue = [0];
    while (queue.length)
      adjacencyList[queue.shift()].forEach(function (item) {
        if (!seen[item]) {
          seen[item] = true;
          queue.push(item);
        }
      });
    return Object.keys(seen).length === adjacencyList.length;
  }
  function inspectCollision(value) {
    var errors = [];
    if (!value || value.schema !== COLLISION_SCHEMA)
      errors.push("collision schema mismatch");
    var vertices = value && value.vertices,
      triangles = value && value.triangles;
    if (!Array.isArray(vertices) || !vertices.length)
      errors.push("collision vertices missing");
    if (!Array.isArray(triangles) || !triangles.length)
      errors.push("collision triangles missing");
    (vertices || []).forEach(function (vertex, index) {
      if (
        !Array.isArray(vertex) ||
        vertex.length !== 3 ||
        vertex.some(function (item) {
          return !Number.isFinite(Number(item));
        })
      )
        errors.push("invalid collision vertex " + index);
    });
    (triangles || []).forEach(function (triangle, index) {
      if (
        !Array.isArray(triangle) ||
        triangle.length !== 3 ||
        triangle.some(function (item) {
          return (
            !Number.isInteger(item) ||
            item < 0 ||
            item >= (vertices || []).length
          );
        })
      )
        errors.push("invalid collision triangle " + index);
      else if (
        triangleArea(
          vertices[triangle[0]],
          vertices[triangle[1]],
          vertices[triangle[2]],
        ) <= 0.000000000001
      )
        errors.push("degenerate collision triangle " + index);
    });
    return {
      pass: !errors.length,
      errors: errors,
      vertices: (vertices || []).length,
      triangles: (triangles || []).length,
      shapes: value && value.shapes ? value.shapes.length : 0,
    };
  }
  function inspectNavigation(value, collision) {
    var errors = [];
    if (!value || value.schema !== NAVIGATION_SCHEMA)
      errors.push("navigation schema mismatch");
    var vertices = value && value.vertices,
      polygons = value && value.polygons,
      adjacencyList = value && value.adjacency;
    if (!Array.isArray(vertices) || !vertices.length)
      errors.push("navigation vertices missing");
    if (!Array.isArray(polygons) || !polygons.length)
      errors.push("navigation polygons missing");
    (polygons || []).forEach(function (polygon, index) {
      if (
        !Array.isArray(polygon) ||
        polygon.length !== 3 ||
        polygon.some(function (item) {
          return (
            !Number.isInteger(item) ||
            item < 0 ||
            item >= (vertices || []).length
          );
        })
      )
        errors.push("invalid navigation polygon " + index);
      else if (
        triangleArea(
          vertices[polygon[0]],
          vertices[polygon[1]],
          vertices[polygon[2]],
        ) <= 0.000000000001
      )
        errors.push("degenerate navigation polygon " + index);
    });
    if (
      !Array.isArray(adjacencyList) ||
      adjacencyList.length !== (polygons || []).length
    )
      errors.push("navigation adjacency length mismatch");
    else
      adjacencyList.forEach(function (neighbors, index) {
        neighbors.forEach(function (neighbor) {
          if (
            !adjacencyList[neighbor] ||
            adjacencyList[neighbor].indexOf(index) < 0
          )
            errors.push("navigation adjacency is not symmetric");
        });
      });
    if (polygons && polygons.length && !connected(adjacencyList || []))
      errors.push("navigation mesh is disconnected");
    if (collision && collision.shapes && collision.shapes[1]) {
      var obstacle = collision.shapes[1],
        hx = obstacle.size[0] / 2,
        hz = obstacle.size[2] / 2;
      (polygons || []).forEach(function (polygon, index) {
        var center = [0, 0, 0];
        polygon.forEach(function (vertexIndex) {
          for (var axis = 0; axis < 3; axis += 1)
            center[axis] += vertices[vertexIndex][axis] / 3;
        });
        if (
          center[0] > obstacle.center[0] - hx &&
          center[0] < obstacle.center[0] + hx &&
          center[2] > obstacle.center[2] - hz &&
          center[2] < obstacle.center[2] + hz
        )
          errors.push("navigation polygon enters collision obstacle " + index);
      });
    }
    return {
      pass: !errors.length,
      errors: Array.from(new Set(errors)),
      vertices: (vertices || []).length,
      polygons: (polygons || []).length,
      connected:
        polygons && polygons.length ? connected(adjacencyList || []) : false,
      excludedRegions:
        value && value.excluded_regions ? value.excluded_regions.length : 0,
    };
  }
  function build(options) {
    options = options || {};
    var dimensions = options.dimensions || [10, 2, 10],
      origin = options.origin || [0, 0, 0],
      policy = options.policy || "solid-and-walkable",
      maxTriangles =
        options.maxTriangles == null ? 1000 : Number(options.maxTriangles),
      maxVertices =
        options.maxVertices == null ? 1000 : Number(options.maxVertices),
      settings = {
        agentRadius: Number(options.agentRadius) || 0.35,
        agentHeight: Number(options.agentHeight) || 1.8,
        maxSlopeDegrees: Number(options.maxSlopeDegrees) || 45,
        stepHeight: Number(options.stepHeight) || 0.4,
      },
      collision = buildCollision(dimensions, origin, policy),
      divisions = 12,
      navigation;
    while (divisions > 2) {
      navigation = buildNavigation(
        dimensions,
        origin,
        collision.shapes[1],
        divisions,
        settings,
      );
      if (
        collision.triangles.length + navigation.polygons.length <=
          maxTriangles &&
        collision.vertices.length + navigation.vertices.length <= maxVertices
      )
        break;
      divisions -= 1;
    }
    navigation = buildNavigation(
      dimensions,
      origin,
      collision.shapes[1],
      divisions,
      settings,
    );
    collision.target_canvas = options.targetCanvas || null;
    navigation.target_canvas = options.targetCanvas || null;
    collision.world_scale = Number(options.worldScale) || 1;
    collision.provenance = clone(options.provenance || {});
    navigation.provenance = clone(options.provenance || {});
    var collisionInspection = inspectCollision(collision),
      navigationInspection = inspectNavigation(navigation, collision),
      totalTriangles = collision.triangles.length + navigation.polygons.length,
      totalVertices = collision.vertices.length + navigation.vertices.length,
      errors = collisionInspection.errors.concat(navigationInspection.errors);
    if (totalTriangles > maxTriangles)
      errors.push("collision and navigation triangles exceed budget");
    if (totalVertices > maxVertices)
      errors.push("collision and navigation vertices exceed budget");
    if (["solid-and-walkable", "separate-proxy"].indexOf(policy) < 0)
      errors.push("unsupported collision policy: " + policy);
    return {
      pass: !errors.length,
      errors: errors,
      collision: collision,
      navigation: navigation,
      collisionInspection: collisionInspection,
      navigationInspection: navigationInspection,
      totalTriangles: totalTriangles,
      totalVertices: totalVertices,
      divisions: divisions,
      digest: hash([collision, navigation]),
    };
  }
  return {
    VERSION: VERSION,
    COLLISION_SCHEMA: COLLISION_SCHEMA,
    NAVIGATION_SCHEMA: NAVIGATION_SCHEMA,
    hash: hash,
    build: build,
    inspectCollision: inspectCollision,
    inspectNavigation: inspectNavigation,
  };
});
