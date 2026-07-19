(function (root, factory) {
  var node = typeof module === "object" && module.exports;
  var api = factory(node ? require("./target-canvas") : root.AXMTargetCanvas);
  if (node) module.exports = api;
  else root.AXMMissingAssetHands = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (TargetCanvas) {
    "use strict";

    var SCHEMA = "axm.missing-asset-hand-catalog/v1";
    var entries = [];

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }
    function lowerList(value) {
      return (Array.isArray(value) ? value : []).map(function (item) {
        return String(item).toLowerCase();
      });
    }
    function intersection(left, right) {
      return left.filter(function (item) {
        return right.indexOf(item) >= 0;
      });
    }
    function requestParts(request) {
      var source = request && request.request ? request.request : request || {};
      var canvas = source.target_canvas || source.targetCanvas || {};
      var outputs = lowerList(
        source.required_outputs || source.requiredOutputs,
      );
      var constraints =
        TargetCanvas && TargetCanvas.requestedConstraints && canvas.schema
          ? TargetCanvas.requestedConstraints(canvas)
          : [];
      return {
        operation: String(
          source.operation_mode || source.operationMode || "create",
        ).toLowerCase(),
        medium: String(canvas.medium || "").toLowerCase(),
        colourSpace: String(
          (canvas.colour && canvas.colour.space) || "",
        ).toLowerCase(),
        behaviours: lowerList(canvas.behaviour),
        intendedUse: String(
          source.intended_use ||
            source.intendedUse ||
            canvas.intended_use ||
            "",
        ).toLowerCase(),
        outputs: outputs,
        constraints: constraints,
      };
    }
    function scoreEntry(entry, request) {
      var parts = requestParts(request),
        score = 0,
        reasons = [];
      if (entry.operation_modes.indexOf(parts.operation) >= 0) {
        score += 6;
        reasons.push(parts.operation);
      }
      var profiles = entry.canvas_profiles.filter(function (profile) {
        return profile.mediums.indexOf(parts.medium) >= 0;
      });
      if (profiles.length) {
        score += 20;
        reasons.push(parts.medium + " canvas");
      }
      if (
        profiles.some(function (profile) {
          return profile.colour_spaces.indexOf(parts.colourSpace) >= 0;
        })
      ) {
        score += 7;
        reasons.push(parts.colourSpace);
      }
      var profileBehaviours = profiles.reduce(function (all, profile) {
        return all.concat(profile.behaviours);
      }, []);
      var behaviourMatches = intersection(parts.behaviours, profileBehaviours);
      if (behaviourMatches.length) {
        score += 5 * behaviourMatches.length;
        reasons.push(behaviourMatches.join("/"));
      }
      if (
        profiles.some(function (profile) {
          return profile.intended_uses.indexOf(parts.intendedUse) >= 0;
        })
      ) {
        score += 8;
        reasons.push(parts.intendedUse);
      }
      var outputs = lowerList(entry.output_types);
      var outputMatches = parts.outputs.filter(function (requested) {
        return outputs.some(function (offered) {
          return (
            requested === offered ||
            requested.indexOf(offered) >= 0 ||
            offered.indexOf(requested) >= 0
          );
        });
      });
      if (outputMatches.length) {
        score += 25 * outputMatches.length;
        reasons.push(outputMatches.join(", "));
      }
      var constraintMatches = intersection(
        parts.constraints,
        entry.planned_constraints,
      );
      if (constraintMatches.length) {
        score += Math.min(20, constraintMatches.length * 4);
        reasons.push(constraintMatches.join(", "));
      }
      return { score: score, reasons: reasons };
    }
    function list() {
      return clone(entries);
    }
    function get(id) {
      var found = entries.find(function (entry) {
        return entry.id === id;
      });
      return found ? clone(found) : null;
    }
    function suggest(request, limit) {
      var parts = requestParts(request);
      return entries
        .map(function (entry) {
          var score = scoreEntry(entry, request);
          return {
            hand: clone(entry),
            score: score.score,
            reason: score.reasons.join(" + ") || "future capability",
          };
        })
        .filter(function (candidate) {
          return (
            candidate.score >= 20 || (!parts.medium && candidate.score > 0)
          );
        })
        .sort(function (left, right) {
          return (
            right.score - left.score ||
            left.hand.priority.localeCompare(right.hand.priority) ||
            left.hand.id.localeCompare(right.hand.id)
          );
        })
        .slice(0, Math.max(1, Math.min(10, Number(limit) || 4)));
    }

    return {
      SCHEMA: SCHEMA,
      VERSION: "1.0.0",
      list: list,
      get: get,
      suggest: suggest,
    };
  },
);
