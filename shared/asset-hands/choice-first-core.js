(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AXMChoiceFirstCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var SCHEMAS = {
    identity: "axm.asset-identity/v1",
    profile: "axm.visual-representation-profile/v1",
    representationSet: "axm.asset-representation-set/v1",
    missing: "axm.missing-representation/v1",
    simulation: "axm.causal-asset-simulation/v1",
    upgradeableObject: "axm.upgradeable-object/v1",
    request: "axm.choice-first-request/v1",
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function authority() {
    return {
      candidate_only: true,
      installed: false,
      promoted: false,
      canonical: false,
      human_review_required: true,
    };
  }

  function stable(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + stable(value[key]);
    }).join(",") + "}";
  }

  function digest(value) {
    var text = typeof value === "string" ? value : stable(value);
    var first = 0x811c9dc5;
    var second = 0x9e3779b9;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + ((index + 1) * 97);
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }
    return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0");
  }

  function deepMerge(base, override) {
    var out = clone(base || {});
    Object.keys(override || {}).forEach(function (key) {
      var value = override[key];
      if (value && typeof value === "object" && !Array.isArray(value) && out[key] && typeof out[key] === "object" && !Array.isArray(out[key])) out[key] = deepMerge(out[key], value);
      else out[key] = clone(value);
    });
    return out;
  }

  var COMMON_AXES = {
    medium: "pixel-raster",
    projection: "management-isometric",
    detail: { cell_width: 48, cell_height: 48, edge_language: "crisp-pixel" },
    palette: { max_colours: 16, enforcement: "limit", colour_space: "sRGB", alpha: true },
    motion: { frame_rate: { numerator: 12, denominator: 1 }, interpolation: "none", integer_timing: true },
    materials: { model: "flat-palette", authored_channels: ["colour", "alpha"] },
    lighting: { model: "painted", dynamic: false },
    camera: { projection: "orthographic-isometric", normalized_world_anchors: true },
    target_canvas: { pixel_format: "RGBA8", colour_space: "sRGB", integer_scale_only: true },
    budgets: { max_frame_width: 256, max_frame_height: 256, max_animation_frames: 256, max_texture_bytes: 67108864 },
  };

  var PROFILE_PRESETS = {
    "pixel-8bit": {
      label: "Pixel 8-bit art-direction preset",
      axes: deepMerge(COMMON_AXES, {
        detail: { cell_width: 48, cell_height: 48, edge_language: "chunky-readable-pixel", shading_steps: 2 },
        palette: { max_colours: 16 },
        motion: { authored_frames: 8 },
      }),
      limits: { maximum_colours: 16, maximum_cell_size: 64 },
    },
    "pixel-16bit": {
      label: "Pixel 16-bit art-direction preset",
      axes: deepMerge(COMMON_AXES, {
        detail: { cell_width: 96, cell_height: 96, edge_language: "detailed-readable-pixel", shading_steps: 4 },
        palette: { max_colours: 64 },
        motion: { authored_frames: 12 },
      }),
      limits: { maximum_colours: 64, maximum_cell_size: 128 },
    },
    "pixel-custom": {
      label: "Custom pixel representation",
      axes: deepMerge(COMMON_AXES, {
        detail: { cell_width: 64, cell_height: 64, edge_language: "caller-selected-pixel", shading_steps: 3 },
        palette: { max_colours: 32 },
        motion: { authored_frames: 8 },
      }),
      limits: { maximum_colours: 256, maximum_cell_size: 256 },
    },
  };

  var FUTURE_CHOICES = [
    { id: "pixel-high-detail", label: "High-detail pixel", medium: "pixel-raster", missing: ["profile implementation", "visual quality evidence"] },
    { id: "illustrated-2d", label: "Illustrated 2D", medium: "illustrated-2d", missing: ["illustration hand", "representation adapter", "visual quality evidence"] },
    { id: "realtime-3d", label: "Realtime 3D", medium: "realtime-3d", missing: ["identity-bound model hand", "rig/material adapter", "runtime evidence"] },
    { id: "cinematic-render", label: "Cinematic render", medium: "cinematic-render", missing: ["cinematic asset hand", "render substrate", "camera/lighting contract", "human approval"] },
  ];

  function missingRepresentation(request, missing, gapTypes, unblock) {
    return {
      schema: SCHEMAS.missing,
      version: "1.0.0",
      status: "MISSING_REPRESENTATION",
      request: clone(request || {}),
      missing: (missing || ["representation implementation"]).slice(),
      gap_types: (gapTypes || ["HAND", "CONTRACT", "EVIDENCE"]).slice(),
      fallback_used: false,
      nearest_substitute_used: false,
      unblock_conditions: (unblock || []).slice(),
      authority: authority(),
    };
  }

  function listRepresentationChoices() {
    var installed = Object.keys(PROFILE_PRESETS).map(function (id) {
      return { id: id, label: PROFILE_PRESETS[id].label, installed: true, medium: PROFILE_PRESETS[id].axes.medium };
    });
    return installed.concat(FUTURE_CHOICES.map(function (item) {
      return { id: item.id, label: item.label, installed: false, medium: item.medium, missing: item.missing.slice() };
    }));
  }

  function resolveProfile(raw) {
    var request = typeof raw === "string" ? { preset_id: raw } : clone(raw || {});
    var presetId = String(request.preset_id || request.id || "pixel-custom");
    var future = FUTURE_CHOICES.find(function (item) { return item.id === presetId; });
    if (future) return missingRepresentation(request, future.missing, ["HAND", "CONTRACT", "EVIDENCE"], ["Implement and verify " + future.id + " without changing the requested axes."]);
    var preset = PROFILE_PRESETS[presetId];
    if (!preset) return missingRepresentation(request, ["profile:" + presetId], ["CONTRACT"], ["Register the exact requested profile or provide explicit pixel-custom axes."]);
    var axes = deepMerge(preset.axes, request.axes || {});
    if (axes.medium !== "pixel-raster") return missingRepresentation(request, ["medium:" + axes.medium], ["HAND", "CONTRACT"], ["Install a representation hand for " + axes.medium + "."]);
    var hard = request.hard_limits || {};
    var conflicts = [];
    if (hard.max_colours != null && Number(axes.palette.max_colours) > Number(hard.max_colours)) conflicts.push("palette.max_colours exceeds hard limit");
    if (hard.max_frame_width != null && Number(axes.detail.cell_width) > Number(hard.max_frame_width)) conflicts.push("detail.cell_width exceeds hard limit");
    if (hard.max_frame_height != null && Number(axes.detail.cell_height) > Number(hard.max_frame_height)) conflicts.push("detail.cell_height exceeds hard limit");
    if (conflicts.length) return missingRepresentation(request, conflicts, ["CONTRACT"], ["Change the explicit profile axes or the caller-owned hard limits."]);
    var custom = presetId === "pixel-custom" || Object.keys(request.axes || {}).length > 0;
    var id = custom && request.profile_id ? String(request.profile_id) : presetId;
    if (custom && !request.profile_id && presetId !== "pixel-custom") id = presetId + "-custom-" + digest(axes).slice(0, 8);
    return {
      status: "READY",
      fallback_used: false,
      nearest_substitute_used: false,
      profile: {
        schema: SCHEMAS.profile,
        version: "1.0.0",
        status: "EXPERIMENTAL",
        id: id,
        label: request.label || preset.label,
        installed: true,
        preset: !custom,
        axes: axes,
        limits: clone(preset.limits),
        provenance: { resolver: "AXMChoiceFirstCore", resolver_version: VERSION, preset_id: presetId, explicit_axes_digest: digest(request.axes || {}) },
        authority: authority(),
      },
    };
  }

  function anchor(id, x, y, z, role) {
    return { id: id, position: [x, y, z], unit: "normalized-footprint", role: role || id };
  }

  var IDENTITIES = {
    "axm.park.ferris-wheel": {
      asset_type: "park-ride",
      components: ["base", "support-a", "support-b", "wheel", "gondolas", "drive", "control-box"],
      footprint: [8, 4, 9],
      pivots: [anchor("world-origin", 0.5, 0.5, 0, "placement"), anchor("wheel-axis", 0.5, 0.5, 0.62, "rotation")],
      sockets: [anchor("entry", 0.15, 0.85, 0, "guest-entry"), anchor("exit", 0.85, 0.85, 0, "guest-exit"), anchor("maintenance", 0.5, 0.05, 0, "maintenance")],
      actions: ["idle", "start", "run", "stop", "fault", "inspection", "repair", "upgrade"],
    },
    "axm.park.carousel-horse": {
      asset_type: "park-ride-component",
      components: ["mount", "pole", "saddle", "base-connector"],
      footprint: [1.2, 0.55, 2.2],
      pivots: [anchor("world-origin", 0.5, 0.5, 0, "placement"), anchor("vertical-travel", 0.5, 0.5, 0.5, "animation")],
      sockets: [anchor("carousel-base", 0.5, 0.5, 0, "ride-connection")],
      actions: ["idle", "start", "run", "stop", "fault", "inspection", "repair", "upgrade"],
    },
    "axm.park.ticket-gate": {
      asset_type: "park-access-control",
      components: ["entrance-post", "exit-post", "scanner", "barrier", "status-light"],
      footprint: [1.6, 1, 1.4],
      pivots: [anchor("world-origin", 0.5, 0.5, 0, "placement"), anchor("barrier-hinge", 0.18, 0.5, 0.68, "rotation")],
      sockets: [anchor("queue-in", 0.5, 1, 0, "guest-entry"), anchor("park-out", 0.5, 0, 0, "guest-exit")],
      actions: ["idle", "open", "closed", "denied", "fault", "inspection", "repair", "upgrade"],
    },
    "axm.home.starter-sofa": {
      asset_type: "upgradeable-interior-object",
      components: ["frame", "cushions", "upholstery", "legs", "utility-slot"],
      footprint: [2.1, 0.9, 0.95],
      pivots: [anchor("world-origin", 0.5, 0.5, 0, "placement"), anchor("seat-center", 0.5, 0.48, 0.48, "interaction")],
      sockets: [anchor("seat-left", 0.32, 0.48, 0.48, "sim-seat"), anchor("seat-right", 0.68, 0.48, 0.48, "sim-seat")],
      actions: ["sit", "clean", "inspect", "repair", "refurbish", "upgrade", "replace-by-choice"],
    },
  };

  function getIdentity(id) {
    var source = IDENTITIES[id];
    if (!source) throw new Error("unknown pilot identity: " + id);
    return {
      schema: SCHEMAS.identity,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: id,
      asset_type: source.asset_type,
      components: source.components.map(function (component) { return { id: component, role: component, persistent: true }; }),
      footprint: { width: source.footprint[0], depth: source.footprint[1], height: source.footprint[2], unit: "world-unit", origin: [0.5, 0.5, 0] },
      pivots: clone(source.pivots),
      sockets: clone(source.sockets),
      semantic_actions: source.actions.slice(),
      invariants: ["identity-persists-across-representations", "footprint-pivots-and-sockets-are-representation-independent", "simulation-state-is-not-owned-by-visual-fidelity"],
      provenance: { author: "AXM deterministic pilot", influence_boundary: "Classic management readability and walkable-park adventure feeling; no copied sprite, map, name, audio, or layout.", generated_by: "AXMChoiceFirstCore", version: VERSION },
      authority: authority(),
    };
  }

  function listIdentities() {
    return Object.keys(IDENTITIES).map(getIdentity);
  }

  function round(value) {
    return Math.round(Number(value) * 1000000) / 1000000;
  }

  function createSimulation(identityId, id) {
    getIdentity(identityId);
    return {
      schema: SCHEMAS.simulation,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: id || identityId + ".simulation",
      identity_id: identityId,
      state: { operating_state: "idle", condition: 100, cleanliness: 100, cycle_count: 0, load: 0, simulated_time_ms: 0, faults: [], upgrades: [], animation_state: "idle" },
      processed_event_ids: [],
      history: [],
      invariants: ["elapsed-time-alone-does-not-change-condition", "every-condition-change-names-a-causal-event", "events-are-applied-exactly-once"],
      provenance: { reducer: "AXMChoiceFirstCore.applySimulationEvent", version: VERSION },
      authority: authority(),
    };
  }

  function eventNumber(event, key, fallback, minimum, maximum) {
    var value = event[key] == null ? fallback : Number(event[key]);
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error("simulation event " + key + " is out of bounds");
    return value;
  }

  function animationState(state) {
    if (state.faults.length) return "fault";
    if (["starting", "running", "stopping", "open", "closed", "denied", "inspection", "repair"].indexOf(state.operating_state) >= 0) return state.operating_state;
    return "idle";
  }

  function applySimulationEvent(input, rawEvent) {
    var simulation = clone(input);
    var event = clone(rawEvent || {});
    if (!simulation || simulation.schema !== SCHEMAS.simulation) throw new Error("causal simulation schema mismatch");
    if (!event.id || !event.type) throw new Error("simulation event id and type are required");
    if (simulation.processed_event_ids.indexOf(event.id) >= 0) return { simulation: simulation, receipt: { schema: "axm.causal-event-receipt/v1", status: "DUPLICATE_IGNORED", event_id: event.id, fallback_used: false, state_digest: digest(simulation.state) } };
    var before = clone(simulation.state);
    var state = simulation.state;
    var causalInputs = [];
    var conditionDelta = 0;
    var cleanlinessDelta = 0;
    switch (event.type) {
      case "time_elapsed":
        state.simulated_time_ms += eventNumber(event, "duration_ms", 0, 0, 315576000000);
        causalInputs.push("duration_ms");
        break;
      case "load_changed":
        state.load = eventNumber(event, "load", 0, 0, 1000000);
        causalInputs.push("load");
        break;
      case "start": state.operating_state = "starting"; causalInputs.push("operator-command"); break;
      case "run": state.operating_state = "running"; causalInputs.push("operator-command"); break;
      case "stop": state.operating_state = "stopping"; causalInputs.push("operator-command"); break;
      case "open": state.operating_state = "open"; causalInputs.push("access-event"); break;
      case "close": state.operating_state = "closed"; causalInputs.push("access-event"); break;
      case "denied": state.operating_state = "denied"; causalInputs.push("access-event"); break;
      case "use_cycle": {
        var cycles = eventNumber(event, "cycles", 1, 1, 1000000);
        var loadFactor = Math.max(1, eventNumber(event, "load_factor", Math.max(1, state.load), 0, 100));
        state.cycle_count += cycles;
        conditionDelta -= cycles * 0.02 * loadFactor;
        cleanlinessDelta -= cycles * 0.01;
        causalInputs.push("cycles", "load_factor");
        break;
      }
      case "imbalance": {
        var imbalance = eventNumber(event, "severity", 0, 0, 1);
        conditionDelta -= imbalance * 0.75;
        if (imbalance >= 0.7 && state.faults.indexOf("imbalance") < 0) state.faults.push("imbalance");
        causalInputs.push("severity");
        break;
      }
      case "weather_exposure": {
        var weatherSeverity = eventNumber(event, "severity", 0, 0, 1);
        var exposureHours = eventNumber(event, "exposure_hours", 0, 0, 1000000);
        conditionDelta -= weatherSeverity * exposureHours * 0.005;
        cleanlinessDelta -= weatherSeverity * exposureHours * 0.01;
        causalInputs.push("severity", "exposure_hours");
        break;
      }
      case "accident": case "misuse": {
        var incident = eventNumber(event, "severity", 0.5, 0, 1);
        conditionDelta -= incident * (event.type === "accident" ? 3 : 1.25);
        causalInputs.push("severity", event.type);
        break;
      }
      case "fault": {
        var code = String(event.code || "unspecified-fault");
        if (state.faults.indexOf(code) < 0) state.faults.push(code);
        state.operating_state = "fault";
        causalInputs.push("fault-code");
        break;
      }
      case "inspection": state.operating_state = "inspection"; causalInputs.push("inspection-action"); break;
      case "repair": {
        conditionDelta += eventNumber(event, "condition_points", 10, 0, 100);
        if (event.clear_faults !== false) state.faults = [];
        state.operating_state = "repair";
        causalInputs.push("condition_points", "repair-action");
        break;
      }
      case "clean": cleanlinessDelta += eventNumber(event, "cleanliness_points", 10, 0, 100); causalInputs.push("cleanliness_points", "cleaning-action"); break;
      case "upgrade": {
        var upgradeId = String(event.upgrade_id || "");
        if (!upgradeId) throw new Error("upgrade event requires upgrade_id");
        if (state.upgrades.indexOf(upgradeId) < 0) state.upgrades.push(upgradeId);
        causalInputs.push("upgrade_id", "materials", "work");
        break;
      }
      default: throw new Error("unsupported causal simulation event: " + event.type);
    }
    state.condition = round(Math.max(0, Math.min(100, state.condition + conditionDelta)));
    state.cleanliness = round(Math.max(0, Math.min(100, state.cleanliness + cleanlinessDelta)));
    state.animation_state = animationState(state);
    simulation.processed_event_ids.push(event.id);
    var receipt = {
      schema: "axm.causal-event-receipt/v1",
      status: "APPLIED",
      event_id: event.id,
      event_type: event.type,
      causal_inputs: causalInputs,
      before_digest: digest(before),
      after_digest: digest(state),
      condition_delta: round(state.condition - before.condition),
      cleanliness_delta: round(state.cleanliness - before.cleanliness),
      time_only_no_decay: event.type !== "time_elapsed" || (state.condition === before.condition && state.cleanliness === before.cleanliness),
      fallback_used: false,
    };
    simulation.history.push({ event: event, receipt: receipt });
    return { simulation: simulation, receipt: receipt };
  }

  function replaySimulation(initial, events) {
    var current = clone(initial);
    var receipts = [];
    (events || []).forEach(function (event) {
      var result = applySimulationEvent(current, event);
      current = result.simulation;
      receipts.push(result.receipt);
    });
    return { simulation: current, receipts: receipts, replay_digest: digest(current), deterministic: true };
  }

  var SOFA_UPGRADES = {
    "repair-starter-frame": { kind: "service", cost: { money: 35, labour_hours: 1, materials: { fasteners: 2, hardwood: 1 } }, condition: { structural: 25 }, qualities: { durability: 4 }, label: "Repair the original frame" },
    "frame-reinforced-beech": { kind: "component", slot: "frame", component: "reinforced-beech-frame", cost: { money: 90, labour_hours: 3, materials: { fasteners: 6, hardwood: 4 } }, qualities: { durability: 20, maintenance_demand: 1 }, tags: ["crafted"] },
    "cushion-cotton-soft": { kind: "component", slot: "cushions", component: "cotton-soft-cushions", cost: { money: 55, labour_hours: 1, materials: { textile: 3, filling: 4 } }, qualities: { comfort: 16, durability: -3, maintenance_demand: 2 }, tags: ["soft", "cosy"] },
    "cushion-spring-firm": { kind: "component", slot: "cushions", component: "spring-firm-cushions", cost: { money: 75, labour_hours: 2, materials: { textile: 2, springs: 6 } }, qualities: { comfort: 10, durability: 10, maintenance_demand: 1 }, tags: ["firm", "supportive"] },
    "upholstery-durable-canvas": { kind: "component", slot: "upholstery", component: "durable-canvas", cost: { money: 60, labour_hours: 2, materials: { textile: 5 } }, qualities: { durability: 9, comfort: 1, maintenance_demand: -2 }, tags: ["practical", "workshop"] },
    "upholstery-warm-velvet": { kind: "component", slot: "upholstery", component: "warm-velvet", cost: { money: 110, labour_hours: 3, materials: { textile: 6 } }, qualities: { comfort: 6, durability: -2, maintenance_demand: 4 }, tags: ["warm", "expressive", "luxury"] },
    "upholstery-easy-clean": { kind: "component", slot: "upholstery", component: "easy-clean-weave", cost: { money: 85, labour_hours: 2, materials: { textile: 5, sealant: 1 } }, qualities: { durability: 5, maintenance_demand: -4 }, tags: ["family", "practical"] },
    "utility-underseat-storage": { kind: "component", slot: "utility", component: "underseat-storage", cost: { money: 80, labour_hours: 3, materials: { hardwood: 3, fasteners: 4 } }, qualities: { comfort: -2, durability: 3, maintenance_demand: 1 }, tags: ["storage", "compact-room"] },
    "utility-recline-comfort": { kind: "component", slot: "utility", component: "manual-recline", cost: { money: 130, labour_hours: 4, materials: { mechanism: 1, fasteners: 8 } }, qualities: { comfort: 18, footprint: 0.35, maintenance_demand: 5 }, tags: ["relaxing", "large-room"] },
    "clean-and-restore": { kind: "service", cost: { money: 20, labour_hours: 1, materials: { cleaner: 1 } }, condition: { cleanliness: 45 }, qualities: {}, label: "Clean and restore existing upholstery" },
  };

  function createStarterSofa(id) {
    return {
      schema: SCHEMAS.upgradeableObject,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: id || "sofa-instance-001",
      identity_id: "axm.home.starter-sofa",
      component_slots: [
        { id: "frame", maximum: 1, mutually_exclusive: true },
        { id: "cushions", maximum: 1, mutually_exclusive: true },
        { id: "upholstery", maximum: 1, mutually_exclusive: true },
        { id: "utility", maximum: 1, mutually_exclusive: true },
      ],
      installed_components: { frame: "starter-wood-frame", cushions: "starter-foam", upholstery: "starter-canvas", utility: "none" },
      finish: { colour: "harbour-blue", pattern: "plain", style_tags: ["starter", "simple"] },
      condition: { structural: 72, cleanliness: 68 },
      qualities: { comfort: 38, durability: 45, capacity: 2, cleanliness: 68, style_tags: ["starter", "simple"], footprint: 2.1, maintenance_demand: 3 },
      resource_history: [],
      history: [{ type: "created", reason: "low-money functional starter interior", replacement_forced: false }],
      replacement_required: false,
      provenance: { identity_preserved: true, progression_model: "repair-refurbish-and-branching-components", generator: "AXMChoiceFirstCore", version: VERSION },
      authority: authority(),
    };
  }

  function resourceShortages(cost, available) {
    available = available || {};
    var shortages = [];
    if (Number(available.money || 0) < Number(cost.money || 0)) shortages.push("money");
    if (Number(available.labour_hours || 0) < Number(cost.labour_hours || 0)) shortages.push("labour_hours");
    Object.keys(cost.materials || {}).forEach(function (key) {
      if (Number((available.materials || {})[key] || 0) < Number(cost.materials[key])) shortages.push("material:" + key);
    });
    return shortages;
  }

  function spend(cost, available) {
    var next = clone(available || { money: 0, labour_hours: 0, materials: {} });
    next.materials = next.materials || {};
    next.money = round(Number(next.money || 0) - Number(cost.money || 0));
    next.labour_hours = round(Number(next.labour_hours || 0) - Number(cost.labour_hours || 0));
    Object.keys(cost.materials || {}).forEach(function (key) { next.materials[key] = round(Number(next.materials[key] || 0) - Number(cost.materials[key])); });
    return next;
  }

  function applySofaUpgrade(input, upgradeId, resources, options) {
    var sofa = clone(input);
    var before = clone(input);
    var upgrade = SOFA_UPGRADES[upgradeId];
    if (!sofa || sofa.schema !== SCHEMAS.upgradeableObject || sofa.identity_id !== "axm.home.starter-sofa") throw new Error("starter sofa upgrade requires axm.upgradeable-object/v1");
    if (!upgrade) return { status: "MISSING_UPGRADE", object: sofa, resources: clone(resources), missing: ["upgrade:" + upgradeId], fallback_used: false };
    if (upgrade.kind === "component" && sofa.installed_components[upgrade.slot] === upgrade.component) return { status: "NO_CHANGE", object: sofa, resources: clone(resources), fallback_used: false, receipt: { upgrade_id: upgradeId, reason: "component-already-installed", identity_preserved: true } };
    var shortages = resourceShortages(upgrade.cost, resources);
    if (shortages.length) return { status: "INSUFFICIENT_RESOURCES", object: sofa, resources: clone(resources), shortages: shortages, fallback_used: false, receipt: { upgrade_id: upgradeId, before_digest: digest(before), after_digest: digest(sofa), unchanged: true, identity_preserved: true } };
    var previous = upgrade.slot ? sofa.installed_components[upgrade.slot] : null;
    if (upgrade.kind === "component") sofa.installed_components[upgrade.slot] = upgrade.component;
    Object.keys(upgrade.qualities || {}).forEach(function (key) {
      sofa.qualities[key] = round(Number(sofa.qualities[key] || 0) + Number(upgrade.qualities[key]));
    });
    Object.keys(upgrade.condition || {}).forEach(function (key) {
      sofa.condition[key] = round(Math.max(0, Math.min(100, Number(sofa.condition[key] || 0) + Number(upgrade.condition[key]))));
    });
    sofa.qualities.cleanliness = sofa.condition.cleanliness;
    (upgrade.tags || []).forEach(function (tag) { if (sofa.qualities.style_tags.indexOf(tag) < 0) sofa.qualities.style_tags.push(tag); });
    if (options && options.finish) sofa.finish = deepMerge(sofa.finish, options.finish);
    var remaining = spend(upgrade.cost, resources);
    var history = { type: upgrade.kind === "component" ? "component-upgrade" : "service", upgrade_id: upgradeId, slot: upgrade.slot || null, from: previous, to: upgrade.component || null, cost: clone(upgrade.cost), identity_before: before.id, identity_after: sofa.id, replacement_forced: false };
    sofa.resource_history.push({ upgrade_id: upgradeId, spent: clone(upgrade.cost) });
    sofa.history.push(history);
    return {
      status: "APPLIED",
      object: sofa,
      resources: remaining,
      fallback_used: false,
      receipt: { schema: "axm.object-upgrade-receipt/v1", status: "APPLIED", upgrade_id: upgradeId, slot: upgrade.slot || null, displaced_component: previous, installed_component: upgrade.component || null, before_digest: digest(before), after_digest: digest(sofa), identity_preserved: before.id === sofa.id, resources_spent: clone(upgrade.cost), replacement_forced: false },
    };
  }

  function evaluateSofa(input, context) {
    var sofa = clone(input);
    context = clone(context || {});
    var preferences = context.household_preferences || {};
    var wanted = preferences.style_tags || [];
    var matches = wanted.filter(function (tag) { return sofa.qualities.style_tags.indexOf(tag) >= 0; });
    return {
      schema: "axm.contextual-object-evaluation/v1",
      object_id: sofa.id,
      identity_id: sofa.identity_id,
      qualities: clone(sofa.qualities),
      context: context,
      fit: {
        room: context.room_width == null ? "UNKNOWN" : (Number(context.room_width) >= sofa.qualities.footprint ? "FITS" : "TOO_LARGE"),
        capacity: context.needed_capacity == null ? "UNKNOWN" : (Number(context.needed_capacity) <= sofa.qualities.capacity ? "MEETS" : "TOO_SMALL"),
        style_matches: matches,
        style_misses: wanted.filter(function (tag) { return matches.indexOf(tag) < 0; }),
        maintenance: preferences.maintenance_tolerance == null ? "UNKNOWN" : (sofa.qualities.maintenance_demand <= Number(preferences.maintenance_tolerance) ? "ACCEPTABLE" : "DEMANDING"),
      },
      universal_score: null,
      universal_best_claim: false,
      explanation: "The object remains a vector of qualities evaluated against a room and household; AXM does not collapse it into one best-item score.",
    };
  }

  function buildRepresentationSet(identityId, representations) {
    var identity = getIdentity(identityId);
    var normalized = (representations || []).map(function (item) {
      return {
        profile_id: String(item.profile_id),
        recipe_id: String(item.recipe_id),
        artifacts: clone(item.artifacts || []),
        digest: item.digest || digest(item),
        availability: item.availability || "AVAILABLE",
      };
    });
    if (!normalized.length) throw new Error("representation set requires at least one representation");
    return {
      schema: SCHEMAS.representationSet,
      version: "1.0.0",
      status: "EXPERIMENTAL",
      id: identityId + ".representations",
      identity_id: identityId,
      representations: normalized,
      semantic_coverage: identity.semantic_actions.slice(),
      compatibility: { footprint_preserved: true, pivots_preserved: true, sockets_preserved: true, simulation_state_shared: true },
      provenance: { builder: "AXMChoiceFirstCore", version: VERSION, identity_digest: digest(identity) },
      authority: authority(),
    };
  }

  return {
    VERSION: VERSION,
    SCHEMAS: clone(SCHEMAS),
    PROFILE_PRESETS: clone(PROFILE_PRESETS),
    FUTURE_CHOICES: clone(FUTURE_CHOICES),
    SOFA_UPGRADES: clone(SOFA_UPGRADES),
    authority: authority,
    clone: clone,
    stableStringify: stable,
    digest: digest,
    deepMerge: deepMerge,
    listRepresentationChoices: listRepresentationChoices,
    resolveProfile: resolveProfile,
    missingRepresentation: missingRepresentation,
    listIdentities: listIdentities,
    getIdentity: getIdentity,
    createSimulation: createSimulation,
    applySimulationEvent: applySimulationEvent,
    replaySimulation: replaySimulation,
    createStarterSofa: createStarterSofa,
    applySofaUpgrade: applySofaUpgrade,
    evaluateSofa: evaluateSofa,
    buildRepresentationSet: buildRepresentationSet,
  };
});
