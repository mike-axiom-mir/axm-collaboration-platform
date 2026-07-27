(function () {
  "use strict";

  const APP_VERSION = "0.13.1-beta";
  const SCHEMA = "axm.shapeable.project";
  const SCHEMA_VERSION = 1;

  const LAYERS = {
    logic: {
      id: "logic",
      index: "01",
      label: "Logic",
      canvasLabel: "Logic canvas",
      description: "Define events, decisions, state and actions.",
      rgb: "68, 215, 202",
      color: "#44d7ca"
    },
    capabilities: {
      id: "capabilities",
      index: "02",
      label: "Capabilities",
      canvasLabel: "Capability canvas",
      description: "Attach bounded modules, Hands, runtimes and infrastructure.",
      rgb: "156, 124, 255",
      color: "#9c7cff"
    },
    visual: {
      id: "visual",
      index: "03",
      label: "Visual",
      canvasLabel: "Visual canvas",
      description: "Shape screens, scenes, assets and human interaction.",
      rgb: "255, 184, 92",
      color: "#ffb85c"
    }
  };

  const TARGETS = {
    website: { label: "Interactive website", extension: "html" },
    dashboard: { label: "Local app / dashboard", extension: "html" },
    game: { label: "Canvas mini-game", extension: "html" },
    custom: { label: "Custom browser project", extension: "html" }
  };

  const ICON_PATHS = {
    spark: '<path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7Z"/>',
    event: '<path d="M13 2 5 13h6l-1 9 8-12h-6z"/>',
    condition: '<path d="m12 3 8 9-8 9-8-9z"/><path d="M9 12h6"/>',
    state: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7"/>',
    action: '<path d="M5 4h14v16H5z"/><path d="m9 8 3 4-3 4M13 16h3"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5v8l4 2"/>',
    route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h3a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3M6 8v10h3"/>',
    counter: '<path d="M7 5h12M5 10h12M7 15h12M5 20h12M9 3 6 22M18 3l-3 19"/>',
    formula: '<path d="M5 5h6L8 12l3 7H5M14 8h5M14 16h5"/>',
    collection: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="9" rx="1"/><path d="M7 6.5h.01M7 15h6M7 17h9"/>',
    code: '<path d="m8 5-5 7 5 7M16 5l5 7-5 7M14 3l-4 18"/>',
    storage: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    files: '<path d="M3 6h7l2 2h9v12H3z"/><path d="M3 6V4h7l2 2"/>',
    assets: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 7h4M12 15v4M10 17h4"/>',
    multiplayer: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="7" r="2"/><path d="M3 19c0-4 2-6 5-6s5 2 5 6M14 12c3 0 5 2 5 6"/>',
    ai: '<rect x="4" y="6" width="16" height="13" rx="3"/><path d="M9 11h.01M15 11h.01M9 15h6M12 3v3M7 3h10"/>',
    diagnostics: '<path d="M4 19h16M6 16l4-5 3 2 5-7"/><circle cx="18" cy="6" r="2"/>',
    render: '<path d="M4 5h16v12H4zM8 21h8M12 17v4"/><path d="m8 13 2-4 2 6 2-3 2 1"/>',
    package: '<path d="m4 7 8-4 8 4v10l-8 4-8-4z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
    mirror: '<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/><path d="m14 15 2 2 3-4"/>',
    screen: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01"/>',
    scene: '<path d="M3 5h18v14H3z"/><path d="m3 15 5-4 3 2 4-5 6 6M7 8h.01"/>',
    section: '<path d="M4 4h16v5H4zM4 11h7v9H4zM13 11h7v9h-7z"/>',
    navigation: '<path d="M4 5h16M4 12h10M4 19h16"/><circle cx="18" cy="12" r="2"/>',
    heading: '<path d="M5 5v14M19 5v14M5 12h14"/>',
    text: '<path d="M4 6h16M4 10h16M4 14h11M4 18h13"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 2-2 5 4"/>',
    button: '<rect x="4" y="7" width="16" height="10" rx="5"/><path d="M9 12h6"/>',
    metric: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3M2 19h20"/>',
    progress: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M7 12h5"/>',
    chart: '<path d="M4 20V4M4 20h16M7 16l3-5 3 2 5-7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>',
    player: '<circle cx="12" cy="7" r="3"/><path d="M7 21v-4c0-3 2-5 5-5s5 2 5 5v4M9 16h6"/>',
    object: '<path d="m12 3 8 4v10l-8 4-8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
    hud: '<path d="M3 5h8v5H3zM13 5h8v5h-8zM3 14h18v5H3z"/>',
    effect: '<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6Z"/><path d="M18 16v6M15 19h6"/>'
  };

  function icon(name, className) {
    return '<svg class="' + (className || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON_PATHS[name] || ICON_PATHS.spark) + "</svg>";
  }

  const ALL_TARGETS = ["website", "dashboard", "game", "custom"];

  const BLOCKS = {
    logic: [
      { type: "start-event", label: "Start event", subtitle: "Entry point", group: "Flow", icon: "event", rgb: "68, 215, 202", description: "Starts a route when the project, screen or mission begins.", input: false, output: true, defaults: { trigger: "Project starts" }, fields: [{ key: "trigger", label: "When", type: "select", options: ["Project starts", "Screen opens", "Mission starts", "Player joins"] }] },
      { type: "event", label: "Event", subtitle: "Listen and react", group: "Flow", icon: "spark", rgb: "73, 199, 225", description: "Listens for a visible human, system or world event.", input: false, output: true, defaults: { eventName: "Button pressed" }, fields: [{ key: "eventName", label: "Event", type: "text" }] },
      { type: "condition", label: "Decision", subtitle: "If / otherwise", group: "Flow", icon: "condition", rgb: "88, 222, 170", description: "Routes the flow using an explicit condition.", input: true, output: true, defaults: { expression: "counter >= 5" }, fields: [{ key: "expression", label: "Condition", type: "text" }] },
      { type: "action", label: "Action", subtitle: "Do something", group: "Flow", icon: "action", rgb: "82, 183, 255", description: "Performs a readable, bounded project action.", input: true, output: true, defaults: { action: "Update message" }, fields: [{ key: "action", label: "Action", type: "text" }] },
      { type: "timer", label: "Timer", subtitle: "Delay or repeat", group: "Flow", icon: "timer", rgb: "255, 187, 92", description: "Waits, counts down or repeats at a visible interval.", input: true, output: true, defaults: { duration: 60, mode: "Countdown" }, fields: [{ key: "duration", label: "Seconds", type: "number", min: 1, max: 86400 }, { key: "mode", label: "Mode", type: "select", options: ["Countdown", "Wait once", "Repeat"] }] },
      { type: "route", label: "Route", subtitle: "Screen or state path", group: "Flow", icon: "route", rgb: "126, 219, 211", description: "Names a navigable route between states or screens.", input: true, output: true, defaults: { destination: "next" }, fields: [{ key: "destination", label: "Destination", type: "text" }] },
      { type: "state", label: "Project state", subtitle: "Remember a value", group: "Data & rules", icon: "state", rgb: "156, 124, 255", description: "Stores a named value in the shared project state.", input: true, output: true, defaults: { key: "status", initialValue: "ready" }, fields: [{ key: "key", label: "State key", type: "text" }, { key: "initialValue", label: "Initial value", type: "text" }] },
      { type: "counter", label: "Counter", subtitle: "Track progress", group: "Data & rules", icon: "counter", rgb: "255, 174, 104", description: "Tracks a numeric goal, score or quantity.", input: true, output: true, defaults: { key: "count", start: 0, step: 1 }, fields: [{ key: "key", label: "Counter name", type: "text" }, { key: "start", label: "Start at", type: "number" }, { key: "step", label: "Change by", type: "number" }] },
      { type: "formula", label: "Formula", subtitle: "Calculate a value", group: "Data & rules", icon: "formula", rgb: "105, 184, 255", description: "Calculates a derived value from explicit inputs.", input: true, output: true, defaults: { formula: "score * multiplier" }, fields: [{ key: "formula", label: "Formula", type: "text" }] },
      { type: "collection", label: "Collection", subtitle: "Structured items", group: "Data & rules", icon: "collection", rgb: "92, 215, 164", description: "Keeps a local list of structured items.", input: true, output: true, defaults: { key: "items", itemShape: "name, status" }, fields: [{ key: "key", label: "Collection name", type: "text" }, { key: "itemShape", label: "Item fields", type: "text" }] },
      { type: "random", label: "Bounded random", subtitle: "Visible variation", group: "Data & rules", icon: "spark", rgb: "237, 132, 255", description: "Chooses from an explicit list without inventing hidden outcomes.", input: true, output: true, defaults: { outcomes: "A, B, C", mode: "Per session" }, fields: [{ key: "outcomes", label: "Allowed outcomes", type: "text" }, { key: "mode", label: "Randomness", type: "select", options: ["Per session", "Seeded", "Every run"] }] },
      { type: "loop", label: "Bounded loop", subtitle: "Repeat with a stop", group: "Flow", icon: "route", rgb: "116, 215, 195", description: "Repeats a route with a declared maximum and stop condition.", input: true, output: true, defaults: { maxIterations: 10, stopCondition: "goal reached" }, fields: [{ key: "maxIterations", label: "Maximum repeats", type: "number", min: 1, max: 1000 }, { key: "stopCondition", label: "Stop when", type: "text" }] },
      { type: "hand-step", label: "Hand step", subtitle: "Scout to Nugget", group: "Hands & review", icon: "route", rgb: "132, 160, 255", description: "Routes one bounded task through a named AXM Hand with visible review.", input: true, output: true, defaults: { hand: "Scout", instruction: "Gather the required source truth", review: "Human review" }, fields: [{ key: "hand", label: "Hand", type: "select", options: ["Scout", "Builder", "Tester", "Repair", "Nugget"] }, { key: "instruction", label: "Bounded instruction", type: "textarea" }, { key: "review", label: "Completion gate", type: "select", options: ["Human review", "Diagnostics pass", "Manual merge gate"] }] },
      { type: "validator", label: "Proof gate", subtitle: "Pass, warn or stop", group: "Hands & review", icon: "diagnostics", rgb: "103, 230, 154", description: "Checks an explicit success condition before a route may continue.", input: true, output: true, defaults: { check: "Required output exists", onFail: "Stop and report" }, fields: [{ key: "check", label: "Proof condition", type: "text" }, { key: "onFail", label: "If it fails", type: "select", options: ["Stop and report", "Route to Repair", "Ask human"] }] },
      { type: "observe-step", label: "Observe source", subtitle: "Facts before guesses", group: "Young AI loop", icon: "mirror", rgb: "102, 197, 230", description: "Captures visible project facts, identifiers and boundaries before any change is proposed.", input: true, output: true, defaults: { scope: "Whole project", output: "Structured facts" }, fields: [{ key: "scope", label: "Observation scope", type: "select", options: ["Whole project", "Selected block", "One layer", "Diagnostics only"] }, { key: "output", label: "Expected observation", type: "text" }] },
      { type: "hypothesis-step", label: "Form hypothesis", subtitle: "Explain the likely cause", group: "Young AI loop", icon: "formula", rgb: "135, 164, 255", description: "States one testable explanation and the evidence needed to confirm or reject it.", input: true, output: true, defaults: { hypothesis: "The visible mismatch comes from one bounded source condition", evidenceNeeded: "Source trace and repeatable test" }, fields: [{ key: "hypothesis", label: "Hypothesis", type: "textarea" }, { key: "evidenceNeeded", label: "Evidence needed", type: "textarea" }] },
      { type: "proposal-step", label: "Bounded proposal", subtitle: "Small reviewable change", group: "Young AI loop", icon: "package", rgb: "187, 126, 255", description: "Packages a limited set of declared builder actions without granting apply authority.", input: true, output: true, defaults: { authority: "Propose only", maxActions: 12, expectedResult: "One visible improvement" }, fields: [{ key: "authority", label: "Authority", type: "select", options: ["Propose only"] }, { key: "maxActions", label: "Maximum actions", type: "number", min: 1, max: 60 }, { key: "expectedResult", label: "Expected result", type: "textarea" }] },
      { type: "ask-human", label: "Ask the human", subtitle: "Stop on missing meaning", group: "Young AI loop", icon: "event", rgb: "255, 178, 99", description: "Stops the route and asks a visible question when source, consent or intent is uncertain.", input: true, output: true, defaults: { question: "Which human outcome matters most here?", blocking: true }, fields: [{ key: "question", label: "Question", type: "textarea" }, { key: "blocking", label: "Block until answered", type: "checkbox" }] },
      { type: "human-decision", label: "Human decision gate", subtitle: "Apply, revise or reject", group: "Young AI loop", icon: "condition", rgb: "255, 153, 125", description: "Keeps the human decision explicit before any AI proposal changes project source.", input: true, output: true, defaults: { choices: "Apply, Revise, Reject", defaultChoice: "Revise" }, fields: [{ key: "choices", label: "Visible choices", type: "text" }, { key: "defaultChoice", label: "Safe default", type: "select", options: ["Revise", "Reject"] }] },
      { type: "evidence-step", label: "Evidence record", subtitle: "What actually happened", group: "Young AI loop", icon: "diagnostics", rgb: "102, 225, 159", description: "Records a named test, the observed result and whether it supports the proposal.", input: true, output: true, defaults: { test: "Run the changed path", result: "Not run", status: "PENDING" }, fields: [{ key: "test", label: "Test", type: "textarea" }, { key: "result", label: "Observed result", type: "textarea" }, { key: "status", label: "Status", type: "select", options: ["PENDING", "PASS", "WARN", "FAIL"] }] },
      { type: "reflection-step", label: "Learning note", subtitle: "Update without pretending memory", group: "Young AI loop", icon: "collection", rgb: "108, 198, 216", description: "Records a bounded lesson and next experiment without claiming hidden memory or self-modification.", input: true, output: true, defaults: { learned: "", nextAttempt: "Use the evidence on the next bounded task" }, fields: [{ key: "learned", label: "What the evidence taught", type: "textarea" }, { key: "nextAttempt", label: "Next bounded attempt", type: "textarea" }] },
      { type: "custom-code", label: "Readable code", subtitle: "Expert escape hatch", group: "Advanced", icon: "code", rgb: "178, 194, 207", description: "Keeps a transparent code step when blocks are not enough.", input: true, output: true, defaults: { language: "JavaScript", code: "return input;" }, fields: [{ key: "language", label: "Language", type: "select", options: ["JavaScript", "JSON expression"] }, { key: "code", label: "Code", type: "textarea" }] }
    ],
    capabilities: [
      { type: "local-storage", label: "Local save", subtitle: "Device-only state", group: "Local foundation", icon: "storage", rgb: "111, 211, 176", description: "Stores project state on the current device.", input: true, output: true, permission: { id: "local-storage", label: "Use local device storage", reason: "Allows the generated project to remember state on this device." }, defaults: { namespace: "axm-project", autosave: true }, fields: [{ key: "namespace", label: "Storage namespace", type: "text" }, { key: "autosave", label: "Autosave", type: "checkbox" }] },
      { type: "project-files", label: "Project files", subtitle: "User-chosen files", group: "Local foundation", icon: "files", rgb: "88, 179, 233", description: "Reads or exports only files the user explicitly chooses.", input: true, output: true, permission: { id: "user-files", label: "Access user-chosen files", reason: "Only files selected through the browser picker are available." }, defaults: { mode: "Import and export" }, fields: [{ key: "mode", label: "Allowed direction", type: "select", options: ["Import only", "Export only", "Import and export"] }] },
      { type: "asset-library", label: "Asset library", subtitle: "Images and media", group: "Local foundation", icon: "assets", rgb: "255, 184, 92", description: "Provides locally imported, provenance-aware project assets.", input: true, output: true, permission: null, defaults: { collection: "Project assets" }, fields: [{ key: "collection", label: "Collection", type: "text" }] },
      { type: "phone-controls", label: "Phone controls", subtitle: "Local controller seats", group: "Play & collaboration", icon: "phone", rgb: "104, 198, 255", description: "Accepts bounded control intentions from phones on the local network.", input: true, output: true, permission: { id: "local-network", label: "Use the local network", reason: "Allows nearby devices to connect without requiring the internet." }, defaults: { seats: 4, layout: "Casual gamepad" }, fields: [{ key: "seats", label: "Maximum seats", type: "number", min: 1, max: 8 }, { key: "layout", label: "Control layout", type: "select", options: ["Casual gamepad", "Directional pad", "Buttons only", "Custom"] }], targets: ["game", "dashboard", "custom"] },
      { type: "local-multiplayer", label: "Local multiplayer", subtitle: "Host-authoritative", group: "Play & collaboration", icon: "multiplayer", rgb: "156, 124, 255", description: "Keeps shared session truth on one local host.", input: true, output: true, permission: { id: "local-network", label: "Use the local network", reason: "Allows a host and nearby players to exchange local session intentions." }, defaults: { seats: 4, authority: "Host authoritative" }, fields: [{ key: "seats", label: "Player seats", type: "number", min: 2, max: 8 }, { key: "authority", label: "Authority", type: "select", options: ["Host authoritative", "Turn based"] }], targets: ["game", "dashboard", "custom"] },
      { type: "ai-collaborator", label: "AI collaborator", subtitle: "Visible bounded seat", group: "Play & collaboration", icon: "ai", rgb: "190, 119, 255", description: "Routes structured requests to an explicitly chosen AI provider or local model.", input: true, output: true, permission: { id: "ai-provider", label: "Send approved context to AI", reason: "Only the displayed request context may leave the project when a provider is connected." }, defaults: { role: "Assistant", provider: "Not connected", approval: "Ask every run" }, fields: [{ key: "role", label: "Visible role", type: "text" }, { key: "provider", label: "Provider", type: "select", options: ["Not connected", "AXM.ask router", "Local model"] }, { key: "approval", label: "Run permission", type: "select", options: ["Ask every run", "Allow this session"] }] },
      { type: "diagnostics", label: "Diagnostics", subtitle: "Proof and repair", group: "Build & proof", icon: "diagnostics", rgb: "103, 230, 154", description: "Runs transparent contract, route and build checks.", input: true, output: true, permission: null, defaults: { level: "Standard" }, fields: [{ key: "level", label: "Check level", type: "select", options: ["Quick", "Standard", "Strict"] }] },
      { type: "media-render", label: "Media render", subtitle: "Local output", group: "Build & proof", icon: "render", rgb: "255, 168, 95", description: "Renders project visuals through a bounded output contract.", input: true, output: true, permission: null, defaults: { format: "PNG", scale: 1 }, fields: [{ key: "format", label: "Format", type: "select", options: ["PNG", "SVG", "WebM"] }, { key: "scale", label: "Scale", type: "number", min: 1, max: 4 }] },
      { type: "export-packager", label: "Portable export", subtitle: "Exit without capture", group: "Build & proof", icon: "package", rgb: "68, 215, 202", description: "Packages readable project source and generated files for download.", input: true, output: true, permission: null, defaults: { includeSource: true, includeLedger: true }, fields: [{ key: "includeSource", label: "Include source", type: "checkbox" }, { key: "includeLedger", label: "Include ledger", type: "checkbox" }] },
      { type: "mirror-adapter", label: "State adapter", subtitle: "Narrow external bridge", group: "Advanced", icon: "mirror", rgb: "132, 160, 255", description: "Maps explicitly selected outside state into a typed project contract.", input: true, output: true, permission: { id: "external-state", label: "Read approved external state", reason: "Only named, mapped fields may cross this adapter." }, defaults: { mode: "Read only", fields: "status, metrics" }, fields: [{ key: "mode", label: "Adapter mode", type: "select", options: ["Read only", "Propose changes"] }, { key: "fields", label: "Mapped fields", type: "text" }], targets: ["dashboard", "game", "custom"] },
      { type: "hand-router", label: "Hands router", subtitle: "Scout · Build · Test · Repair", group: "AI team & skills", icon: "route", rgb: "104, 198, 255", description: "Runs a declared Hands sequence and emits reviewable return packets.", input: true, output: true, permission: null, defaults: { sequence: "Scout, Builder, Tester, Repair, Nugget", applyMode: "Propose only" }, fields: [{ key: "sequence", label: "Hand sequence", type: "text" }, { key: "applyMode", label: "Change authority", type: "select", options: ["Propose only", "Apply after approval"] }] },
      { type: "skill-pack", label: "Skill pack", subtitle: "Bounded instructions", group: "AI team & skills", icon: "collection", rgb: "184, 137, 255", description: "Attaches versioned specialist instructions without granting new permissions.", input: true, output: true, permission: null, defaults: { skill: "Project specialist", version: "0.1.0", source: "Local pack" }, fields: [{ key: "skill", label: "Skill name", type: "text" }, { key: "version", label: "Version", type: "text" }, { key: "source", label: "Source", type: "text" }] },
      { type: "engine-dock", label: "External Engine Dock", subtitle: "Unreal · Unity · Godot", group: "Game infrastructure", icon: "package", rgb: "255, 146, 103", description: "Creates a typed handoff contract for a strong external game engine.", input: true, output: true, permission: { id: "external-execution", label: "Allow approved external engine actions", reason: "The beta only exports a handoff packet. A connected Engine Dock must still request each execution boundary." }, defaults: { engine: "Unreal Engine", mode: "Handoff only", adapter: "AXM External Engine Dock v0.1.0" }, fields: [{ key: "engine", label: "Engine", type: "select", options: ["Unreal Engine", "Unity 6", "Godot", "Generic constrained adapter"] }, { key: "mode", label: "Dock mode", type: "select", options: ["Handoff only", "Approval-gated commands"] }, { key: "adapter", label: "Adapter contract", type: "text" }], targets: ["game", "custom"] },
      { type: "physics-adapter", label: "Physics adapter", subtitle: "Ruleset and collisions", group: "Game infrastructure", icon: "formula", rgb: "111, 199, 242", description: "Declares movement, collision and world-rule expectations independently of an engine.", input: true, output: true, permission: null, defaults: { preset: "Top-down casual", gravity: "none", collisions: "solid world" }, fields: [{ key: "preset", label: "Preset", type: "select", options: ["Top-down casual", "Platformer", "Board game", "Vehicle arcade", "Custom"] }, { key: "gravity", label: "Gravity", type: "text" }, { key: "collisions", label: "Collision rule", type: "text" }], targets: ["game", "custom"] },
      { type: "scenery-factory", label: "Scenery factory", subtitle: "Cartoon world layers", group: "Game infrastructure", icon: "scene", rgb: "119, 221, 158", description: "Builds a declared scenery palette from terrain, structures, props and atmosphere layers.", input: true, output: true, permission: null, defaults: { style: "Warm cartoon", biome: "Green district", layers: "terrain, paths, buildings, nature, props" }, fields: [{ key: "style", label: "Visual style", type: "select", options: ["Warm cartoon", "Graphic adventure", "Playful low-poly", "Pixel world"] }, { key: "biome", label: "World biome", type: "select", options: ["Green district", "Enchanted forest", "Coastal village", "Tropical island", "Dutch city"] }, { key: "layers", label: "Scenery layers", type: "text" }], targets: ["game", "custom"] },
      { type: "lan-sync", label: "LAN state sync", subtitle: "Intentions to local host", group: "Game infrastructure", icon: "multiplayer", rgb: "102, 187, 255", description: "Declares local-authoritative state sync where clients send intentions, not truth.", input: true, output: true, permission: { id: "local-network", label: "Use the isolated local network", reason: "Allows bounded session messages only after a local host and network are deliberately chosen." }, defaults: { authority: "Local host", clientsSend: "intentions", cloud: "off" }, fields: [{ key: "authority", label: "Authority", type: "text" }, { key: "clientsSend", label: "Clients send", type: "select", options: ["intentions", "turn choices"] }, { key: "cloud", label: "Cloud fallback", type: "select", options: ["off", "optional after approval"] }], targets: ["game", "dashboard", "custom"] },
      { type: "agent-workspace", label: "Young AI workspace", subtitle: "Observe · propose · review", group: "Young AI seat", icon: "ai", rgb: "190, 119, 255", description: "Exposes a local machine-readable mirror of the same project humans see and accepts proposal packets for human review.", input: true, output: true, permission: null, defaults: { mode: "Observe and propose", actionLimit: 60, context: "Whole project" }, fields: [{ key: "mode", label: "Seat mode", type: "select", options: ["Observe only", "Observe and propose"] }, { key: "actionLimit", label: "Maximum proposal actions", type: "number", min: 1, max: 60 }, { key: "context", label: "Default context", type: "select", options: ["Whole project", "Selected block", "Active layer"] }] },
      { type: "proposal-validator", label: "Proposal validator", subtitle: "Schema and authority checks", group: "Young AI seat", icon: "diagnostics", rgb: "105, 224, 159", description: "Dry-runs a proposal against a cloned project and blocks stale, forbidden or malformed actions.", input: true, output: true, permission: null, defaults: { staleSource: "Block", forbiddenActions: "Block", diagnosticsDelta: true }, fields: [{ key: "staleSource", label: "Stale source", type: "select", options: ["Block", "Warn"] }, { key: "forbiddenActions", label: "Forbidden actions", type: "select", options: ["Block"] }, { key: "diagnosticsDelta", label: "Compare diagnostics", type: "checkbox" }] },
      { type: "simulation-sandbox", label: "Proposal sandbox", subtitle: "Dry-run on a clone", group: "Young AI seat", icon: "mirror", rgb: "119, 171, 255", description: "Applies candidate actions to a temporary project clone so impact can be reviewed before source changes.", input: true, output: true, permission: null, defaults: { mode: "Clone only", keepPreview: false }, fields: [{ key: "mode", label: "Simulation mode", type: "select", options: ["Clone only"] }, { key: "keepPreview", label: "Keep preview after close", type: "checkbox" }] },
      { type: "context-window", label: "Context budget", subtitle: "Only what is needed", group: "Young AI seat", icon: "collection", rgb: "107, 196, 224", description: "Declares the source scope and size a young AI may inspect for one task.", input: true, output: true, permission: null, defaults: { scope: "Whole project summary", maxItems: 200, includeLedger: "Recent only" }, fields: [{ key: "scope", label: "Context scope", type: "select", options: ["Whole project summary", "Selected path", "Active layer", "Diagnostics only"] }, { key: "maxItems", label: "Maximum items", type: "number", min: 10, max: 1000 }, { key: "includeLedger", label: "Ledger context", type: "select", options: ["None", "Recent only", "Full"] }] },
      { type: "tool-boundary", label: "Tool boundary", subtitle: "Allowed verbs only", group: "Young AI seat", icon: "action", rgb: "255, 171, 101", description: "Declares which builder actions are available and which authority actions remain human-only.", input: true, output: true, permission: null, defaults: { allowed: "add, update, move, connect, bind, test", blocked: "permissions, canon, vault deletion, hidden execution" }, fields: [{ key: "allowed", label: "Allowed actions", type: "textarea" }, { key: "blocked", label: "Human-only or blocked", type: "textarea" }] },
      { type: "learning-journal", label: "Learning journal", subtitle: "Evidence-linked notes", group: "Young AI seat", icon: "collection", rgb: "123, 205, 190", description: "Keeps local, project-scoped lessons tied to tests and human review without implying private hidden memory.", input: true, output: true, permission: null, defaults: { scope: "This project", evidenceRequired: true, retention: "Visible review log" }, fields: [{ key: "scope", label: "Journal scope", type: "select", options: ["This project", "This checkpoint"] }, { key: "evidenceRequired", label: "Require evidence", type: "checkbox" }, { key: "retention", label: "Retention", type: "select", options: ["Visible review log", "Export only"] }] },
      { type: "agent-accessibility", label: "Agent accessibility", subtitle: "Stable IDs and landmarks", group: "Young AI seat", icon: "screen", rgb: "255, 193, 104", description: "Keeps controls, blocks, ports and project landmarks legible through semantic labels and stable identifiers.", input: true, output: true, permission: null, defaults: { stableIds: true, semanticLabels: true, keyboardPath: true }, fields: [{ key: "stableIds", label: "Stable identifiers", type: "checkbox" }, { key: "semanticLabels", label: "Semantic labels", type: "checkbox" }, { key: "keyboardPath", label: "Keyboard-operable path", type: "checkbox" }] },
      { type: "accessibility-audit", label: "Accessibility audit", subtitle: "Keyboard · labels · contrast", group: "Build & proof", icon: "diagnostics", rgb: "103, 230, 154", description: "Checks basic input, labeling, motion and contrast expectations.", input: true, output: true, permission: null, defaults: { level: "AA basics", reducedMotion: true }, fields: [{ key: "level", label: "Target", type: "select", options: ["AA basics", "Keyboard first", "Custom checklist"] }, { key: "reducedMotion", label: "Respect reduced motion", type: "checkbox" }] },
      { type: "localization", label: "Localization", subtitle: "Language contract", group: "Build & proof", icon: "text", rgb: "255, 193, 104", description: "Declares translatable strings and fallback language without automatic outside translation.", input: true, output: true, permission: null, defaults: { primary: "English", additional: "Dutch", fallback: "English" }, fields: [{ key: "primary", label: "Primary language", type: "text" }, { key: "additional", label: "Additional languages", type: "text" }, { key: "fallback", label: "Fallback", type: "text" }] }
    ],
    visual: [
      { type: "screen", label: "App screen", subtitle: "Interface root", group: "Structure", icon: "screen", rgb: "255, 184, 92", description: "Creates a responsive screen or website page.", input: true, output: true, defaults: { route: "/", layout: "Responsive" }, fields: [{ key: "route", label: "Route", type: "text" }, { key: "layout", label: "Layout", type: "select", options: ["Responsive", "Dashboard", "Full canvas", "Centered"] }], targets: ["website", "dashboard", "custom"] },
      { type: "game-scene", label: "Game scene", subtitle: "Playable world root", group: "Structure", icon: "scene", rgb: "255, 154, 91", description: "Creates a Canvas-based playable scene.", input: true, output: true, defaults: { camera: "Top down", world: "Compact district" }, fields: [{ key: "camera", label: "Camera", type: "select", options: ["Top down", "Side view", "Fixed board"] }, { key: "world", label: "World label", type: "text" }], targets: ["game", "custom"] },
      { type: "section", label: "Section", subtitle: "Layout region", group: "Structure", icon: "section", rgb: "252, 195, 105", description: "Groups related content into a clear region.", input: true, output: true, defaults: { layout: "Grid", columns: 3 }, fields: [{ key: "layout", label: "Layout", type: "select", options: ["Stack", "Grid", "Split", "Overlay"] }, { key: "columns", label: "Columns", type: "number", min: 1, max: 6 }] },
      { type: "navigation", label: "Navigation", subtitle: "Visible routes", group: "Structure", icon: "navigation", rgb: "122, 193, 255", description: "Shows explicit routes and movement between screens.", input: true, output: true, defaults: { items: "Home, About, Build" }, fields: [{ key: "items", label: "Items", type: "text" }] },
      { type: "heading", label: "Heading", subtitle: "Primary message", group: "Content", icon: "heading", rgb: "255, 205, 120", description: "Displays a strong semantic heading.", input: true, output: true, defaults: { text: "Build something useful", level: "H1" }, fields: [{ key: "text", label: "Text", type: "text" }, { key: "level", label: "Level", type: "select", options: ["H1", "H2", "H3"] }] },
      { type: "text", label: "Text", subtitle: "Readable content", group: "Content", icon: "text", rgb: "218, 191, 148", description: "Displays explanatory or dynamic text.", input: true, output: true, defaults: { text: "A clear description belongs here." }, fields: [{ key: "text", label: "Text", type: "textarea" }] },
      { type: "image", label: "Image / asset", subtitle: "Bound visual", group: "Content", icon: "image", rgb: "255, 146, 116", description: "Displays a locally provided image or generated asset.", input: true, output: true, defaults: { asset: "No asset selected", alt: "" }, fields: [{ key: "asset", label: "Asset reference", type: "text" }, { key: "alt", label: "Alternative text", type: "text" }] },
      { type: "button", label: "Button", subtitle: "Human action", group: "Content", icon: "button", rgb: "92, 207, 226", description: "Offers an explicit human-controlled action.", input: true, output: true, defaults: { text: "Continue", action: "next" }, fields: [{ key: "text", label: "Button label", type: "text" }, { key: "action", label: "Action binding", type: "text" }] },
      { type: "metric", label: "Metric", subtitle: "State readout", group: "Data display", icon: "metric", rgb: "103, 230, 154", description: "Shows a labeled value from shared state.", input: true, output: true, defaults: { label: "Progress", value: "72", unit: "%" }, fields: [{ key: "label", label: "Metric label", type: "text" }, { key: "value", label: "Preview value", type: "text" }, { key: "unit", label: "Unit", type: "text" }] },
      { type: "progress", label: "Progress", subtitle: "Goal feedback", group: "Data display", icon: "progress", rgb: "68, 215, 202", description: "Shows progress toward an explicit goal.", input: true, output: true, defaults: { label: "Goal", value: 60 }, fields: [{ key: "label", label: "Label", type: "text" }, { key: "value", label: "Preview percent", type: "number", min: 0, max: 100 }] },
      { type: "chart", label: "Chart", subtitle: "Metric pattern", group: "Data display", icon: "chart", rgb: "156, 124, 255", description: "Visualizes a small, labeled numeric trend.", input: true, output: true, defaults: { title: "Activity", series: "12, 18, 15, 24, 31, 28" }, fields: [{ key: "title", label: "Chart title", type: "text" }, { key: "series", label: "Preview values", type: "text" }] },
      { type: "list", label: "List", subtitle: "Structured rows", group: "Data display", icon: "list", rgb: "117, 183, 255", description: "Displays a collection as readable rows.", input: true, output: true, defaults: { title: "Recent activity", items: "Created project, Added route, Ran test" }, fields: [{ key: "title", label: "List title", type: "text" }, { key: "items", label: "Preview items", type: "textarea" }] },
      { type: "player-sprite", label: "Player", subtitle: "Controllable presence", group: "Game world", icon: "player", rgb: "95, 218, 204", description: "Shows a controllable player entity in a game scene.", input: true, output: true, influenceModule: "character", defaults: { name: "Player 1", role: "Controllable explorer", color: "#44d7ca", movementSpeed: 2, inputStyle: "Keyboard + touch", canMove: true, canSpeak: false }, fields: [{ key: "name", label: "Player name", type: "text" }, { key: "role", label: "Role or purpose", type: "text" }, { key: "color", label: "Player color", type: "color" }, { key: "movementSpeed", label: "Movement speed", type: "number", min: 0.25, max: 5 }, { key: "inputStyle", label: "Controls", type: "select", options: ["Keyboard + touch", "Keyboard", "Touch", "Connected controller"] }, { key: "canMove", label: "This person can move", type: "checkbox" }, { key: "canSpeak", label: "This person can speak", type: "checkbox" }], targets: ["game", "custom"] },
      { type: "world-object", label: "World object", subtitle: "Interactive prop", group: "Game world", icon: "object", rgb: "255, 184, 92", description: "Places an interactive objective or prop in the scene.", input: true, output: true, defaults: { name: "Parcel", interaction: "Collect" }, fields: [{ key: "name", label: "Object name", type: "text" }, { key: "interaction", label: "Interaction", type: "select", options: ["Collect", "Activate", "Deliver", "Inspect"] }], targets: ["game", "custom"] },
      { type: "hud", label: "Game HUD", subtitle: "Player information", group: "Game world", icon: "hud", rgb: "126, 176, 255", description: "Shows mission, score and status information over a game scene.", input: true, output: true, defaults: { title: "Mission", fields: "score, timer, objective" }, fields: [{ key: "title", label: "HUD title", type: "text" }, { key: "fields", label: "Visible fields", type: "text" }], targets: ["game", "custom"] },
      { type: "effect", label: "Visual effect", subtitle: "Visible feedback", group: "Game world", icon: "effect", rgb: "244, 132, 255", description: "Adds bounded visual feedback for a known event.", input: true, output: true, defaults: { effect: "Celebrate", duration: 800 }, fields: [{ key: "effect", label: "Effect", type: "select", options: ["Celebrate", "Pulse", "Shake", "Fade"] }, { key: "duration", label: "Duration (ms)", type: "number", min: 100, max: 5000 }], targets: ["game", "dashboard", "website", "custom"] },
      { type: "card", label: "Content card", subtitle: "Grouped information", group: "Interface patterns", icon: "section", rgb: "255, 196, 108", description: "Shows a titled piece of information or action in a reusable card.", input: true, output: true, defaults: { title: "Card title", body: "Useful information", action: "" }, fields: [{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }, { key: "action", label: "Optional action", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "form", label: "Local form", subtitle: "Explicit human input", group: "Interface patterns", icon: "collection", rgb: "106, 207, 225", description: "Collects declared fields without choosing an outside submission destination.", input: true, output: true, defaults: { title: "Input", fields: "name, message", submit: "Save locally" }, fields: [{ key: "title", label: "Form title", type: "text" }, { key: "fields", label: "Fields", type: "text" }, { key: "submit", label: "Submit label", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "modal", label: "Modal", subtitle: "Focused decision", group: "Interface patterns", icon: "screen", rgb: "167, 137, 255", description: "Shows a focused choice with a visible close route.", input: true, output: true, defaults: { title: "Review", close: "Keep editing" }, fields: [{ key: "title", label: "Title", type: "text" }, { key: "close", label: "Close action", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "tabs", label: "Tabs", subtitle: "Parallel views", group: "Interface patterns", icon: "navigation", rgb: "115, 180, 255", description: "Switches between declared views without changing source state.", input: true, output: true, defaults: { tabs: "Overview, Evidence, History" }, fields: [{ key: "tabs", label: "Tab labels", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "world-map", label: "World map", subtitle: "Regions and paths", group: "Cartoon world", icon: "scene", rgb: "101, 221, 157", description: "Defines a visual world palette, regions and path network.", input: true, output: true, defaults: { biome: "Enchanted forest", regions: "village, grove, river", pathStyle: "curved" }, fields: [{ key: "biome", label: "Biome", type: "select", options: ["Green district", "Enchanted forest", "Coastal village", "Tropical island", "Dutch city"] }, { key: "regions", label: "Regions", type: "text" }, { key: "pathStyle", label: "Paths", type: "select", options: ["curved", "grid", "organic"] }], targets: ["game", "custom"] },
      { type: "tile-layer", label: "Scenery layer", subtitle: "Terrain to atmosphere", group: "Cartoon world", icon: "section", rgb: "132, 207, 122", description: "Adds a named scenery layer with a clear draw order.", input: true, output: true, defaults: { layer: "nature", order: 3, density: "medium" }, fields: [{ key: "layer", label: "Layer", type: "select", options: ["terrain", "water", "paths", "structures", "nature", "props", "atmosphere"] }, { key: "order", label: "Draw order", type: "number", min: 0, max: 20 }, { key: "density", label: "Density", type: "select", options: ["sparse", "medium", "rich"] }], targets: ["game", "custom"] },
      { type: "npc", label: "World character", subtitle: "Visible local role", group: "Cartoon world", icon: "player", rgb: "255, 152, 137", description: "Places a named non-player character with a bounded role.", input: true, output: true, influenceModule: "character", defaults: { name: "Guide", role: "Offers the first quest", color: "#ff9889", movementSpeed: 1, dialogueStyle: "Warm and clear", knowledgeBoundary: "Only knows the visible world, task and safety instructions.", canMove: true, canSpeak: true, canChangeSharedState: false }, fields: [{ key: "name", label: "Name", type: "text" }, { key: "role", label: "Role", type: "text" }, { key: "color", label: "Color", type: "color" }, { key: "movementSpeed", label: "Movement speed", type: "number", min: 0, max: 5 }, { key: "dialogueStyle", label: "How they speak", type: "select", options: ["Warm and clear", "Brief and practical", "Playful", "Calm guide", "Silent"] }, { key: "knowledgeBoundary", label: "What they are allowed to know", type: "textarea" }, { key: "canMove", label: "This person can move", type: "checkbox" }, { key: "canSpeak", label: "This person can speak", type: "checkbox" }, { key: "canChangeSharedState", label: "This person can change shared state", type: "checkbox" }], targets: ["game", "custom"] },
      { type: "task-card", label: "AI task card", subtitle: "One bounded assignment", group: "Human + AI review", icon: "section", rgb: "117, 183, 255", description: "Shows one task with its source scope, expected result and stop conditions.", input: true, output: true, defaults: { title: "Bounded task", scope: "Current project", doneWhen: "Visible result and evidence" }, fields: [{ key: "title", label: "Task title", type: "text" }, { key: "scope", label: "Source scope", type: "text" }, { key: "doneWhen", label: "Done when", type: "textarea" }], targets: ["website", "dashboard", "custom"] },
      { type: "review-queue", label: "Proposal review queue", subtitle: "Human decision lane", group: "Human + AI review", icon: "list", rgb: "190, 119, 255", description: "Lists AI proposals awaiting review without applying them automatically.", input: true, output: true, defaults: { title: "Proposals awaiting review", states: "Draft, Validated, Revise, Approved, Rejected" }, fields: [{ key: "title", label: "Queue title", type: "text" }, { key: "states", label: "Visible states", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "evidence-panel", label: "Evidence panel", subtitle: "Tests and observed results", group: "Human + AI review", icon: "diagnostics", rgb: "103, 230, 154", description: "Shows declared tests, actual results and unresolved seams beside a proposal.", input: true, output: true, defaults: { title: "Evidence", fields: "test, result, status, boundary" }, fields: [{ key: "title", label: "Panel title", type: "text" }, { key: "fields", label: "Visible evidence fields", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "decision-panel", label: "Human decision panel", subtitle: "Apply · revise · reject", group: "Human + AI review", icon: "button", rgb: "255, 153, 125", description: "Presents the human-only decision that controls whether a reviewed proposal changes source.", input: true, output: true, defaults: { title: "Human decision", actions: "Apply reviewed proposal, Ask for revision, Reject" }, fields: [{ key: "title", label: "Panel title", type: "text" }, { key: "actions", label: "Decision actions", type: "textarea" }], targets: ["website", "dashboard", "custom"] },
      { type: "learning-panel", label: "Learning panel", subtitle: "Evidence-linked reflection", group: "Human + AI review", icon: "collection", rgb: "123, 205, 190", description: "Displays what changed, what the evidence taught and the next bounded attempt.", input: true, output: true, defaults: { title: "What we learned", fields: "observation, evidence, lesson, next attempt" }, fields: [{ key: "title", label: "Panel title", type: "text" }, { key: "fields", label: "Visible learning fields", type: "text" }], targets: ["website", "dashboard", "custom"] },
      { type: "agent-landmark", label: "AI-readable landmark", subtitle: "Semantic place in the interface", group: "Human + AI review", icon: "navigation", rgb: "255, 193, 104", description: "Names an interface region so humans, screen readers and browser agents can find the same place reliably.", input: true, output: true, defaults: { landmark: "Main task area", role: "region", description: "Contains the current bounded task" }, fields: [{ key: "landmark", label: "Landmark name", type: "text" }, { key: "role", label: "Semantic role", type: "select", options: ["region", "navigation", "status", "complementary"] }, { key: "description", label: "Description", type: "textarea" }], targets: ["website", "dashboard", "custom"] },
      { type: "camera", label: "Camera", subtitle: "Player viewpoint", group: "Cartoon world", icon: "render", rgb: "117, 183, 255", description: "Declares how the player sees and follows the world.", input: true, output: true, defaults: { mode: "Soft follow", zoom: 1, bounds: "world" }, fields: [{ key: "mode", label: "Camera mode", type: "select", options: ["Soft follow", "Fixed", "Room based", "Shared party"] }, { key: "zoom", label: "Zoom", type: "number", min: 0.5, max: 3 }, { key: "bounds", label: "Bounds", type: "text" }], targets: ["game", "custom"] }
    ]
  };

  const BLOCK_MAP = {};
  const REGISTERED_PACKS = new Map();
  Object.keys(BLOCKS).forEach(function (layer) {
    BLOCKS[layer].forEach(function (block) {
      block.layer = layer;
      block.targets = block.targets || ALL_TARGETS.slice();
      block.fields = block.fields || [];
      block.input = block.input !== false;
      block.output = block.output !== false;
      BLOCK_MAP[layer + ":" + block.type] = block;
    });
  });

  let idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + idCounter.toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function now() {
    return new Date().toISOString();
  }

  function validRgb(value) {
    const parts = String(value || "").split(",").map(function (part) { return Number(part.trim()); });
    return parts.length === 3 && parts.every(function (part) { return Number.isInteger(part) && part >= 0 && part <= 255; });
  }

  const INFLUENCE_SCHEMA_VERSION = 1;
  const MAX_INFLUENCE_RULES = 24;
  const MAX_CODE_HOOKS = 8;

  const INFLUENCE_MODULES = {
    "logic-flow": {
      id: "logic-flow",
      label: "Logic step",
      beginnerLabel: "How this step reacts",
      description: "Choose what wakes this logic step and what clear result it should send next.",
      triggers: [
        { id: "project_starts", label: "The project starts", help: "Runs when the experience first opens." },
        { id: "route_received", label: "A route reaches this step", help: "Runs when the previous logic block sends flow here." },
        { id: "condition_passes", label: "A decision is true", help: "Runs on the yes / true path." },
        { id: "condition_fails", label: "A decision is false", help: "Runs on the no / otherwise path." },
        { id: "timer_finishes", label: "A timer finishes", help: "Runs after the declared timer ends." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a named project value changes." },
        { id: "human_approves", label: "A human approves", help: "Runs only after a visible human decision." }
      ],
      actions: [
        { id: "send_route", label: "Send the next route", valueLabel: "Route label", placeholder: "next", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "questStatus = ready", needsValue: true },
        { id: "add_number", label: "Change a number", valueLabel: "Number change", placeholder: "score + 1", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "guide_greeted", needsValue: true },
        { id: "record_evidence", label: "Record evidence", valueLabel: "Evidence note", placeholder: "The changed path was tested", needsValue: true },
        { id: "ask_human", label: "Ask the human", valueLabel: "Question", placeholder: "Should this candidate be applied?", needsValue: true }
      ],
      visualStates: [],
      hooks: [
        { id: "onInput", label: "When flow arrives", signature: "onInput({ block, state, input })" },
        { id: "onPass", label: "When a decision passes", signature: "onPass({ block, state })" },
        { id: "onFail", label: "When a decision fails", signature: "onFail({ block, state })" },
        { id: "onTimer", label: "When a timer finishes", signature: "onTimer({ block, state })" },
        { id: "onStateChange", label: "When state changes", signature: "onStateChange({ block, state, change })" }
      ]
    },
    capability: {
      id: "capability",
      label: "Capability module",
      beginnerLabel: "How this capability responds",
      description: "Describe the request this capability may receive and the visible status it may return. Permissions stay separate and human-controlled.",
      triggers: [
        { id: "request_received", label: "A request arrives", help: "Runs when a connected block asks this capability for work." },
        { id: "source_changes", label: "Project source changes", help: "Runs after the visible project source is updated." },
        { id: "permission_approved", label: "A human approves permission", help: "Runs only after this project records human approval." },
        { id: "test_finishes", label: "A test finishes", help: "Runs when diagnostics return an observed result." },
        { id: "export_requested", label: "An export is requested", help: "Runs before a portable handoff is prepared." }
      ],
      actions: [
        { id: "report_status", label: "Report a status", valueLabel: "Status message", placeholder: "Ready for review", needsValue: true },
        { id: "record_evidence", label: "Record evidence", valueLabel: "Evidence note", placeholder: "Local save completed", needsValue: true },
        { id: "ask_human", label: "Ask the human", valueLabel: "Question", placeholder: "Allow this capability for this run?", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "asset_pack_ready", needsValue: true },
        { id: "prepare_output", label: "Prepare a local output", valueLabel: "Output kind", placeholder: "asset request packet", needsValue: true }
      ],
      visualStates: [],
      hooks: [
        { id: "onRequest", label: "When a request arrives", signature: "onRequest({ block, request, state })" },
        { id: "onSourceChange", label: "When source changes", signature: "onSourceChange({ block, source })" },
        { id: "onPermission", label: "After human permission", signature: "onPermission({ block, decision })" },
        { id: "onTest", label: "When a test finishes", signature: "onTest({ block, result })" }
      ]
    },
    character: {
      id: "character",
      label: "Person or character",
      beginnerLabel: "How this person behaves",
      description: "Give this placed person their own reactions, visual states and clear limits without changing every other person block.",
      triggers: [
        { id: "project_starts", label: "The scene starts", help: "Runs when the character first appears." },
        { id: "player_nearby", label: "Someone comes near", help: "Runs when the player or visitor enters this character's nearby area." },
        { id: "human_activates", label: "Someone interacts", help: "Runs after a click, tap or interact action." },
        { id: "message_received", label: "A message arrives", help: "Runs when a connected logic or AI block sends a message." },
        { id: "task_starts", label: "A task starts", help: "Runs when the connected task begins." },
        { id: "task_completed", label: "A task is completed", help: "Runs after visible completion evidence." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a named project value changes." }
      ],
      actions: [
        { id: "say_message", label: "Say a message", valueLabel: "What they say", placeholder: "Welcome to the workshop.", needsValue: true },
        { id: "change_visual_state", label: "Change their visual state", valueLabel: "Visual state", placeholder: "talking", needsValue: true },
        { id: "move_to_point", label: "Move to a named point", valueLabel: "Point name", placeholder: "workbench", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "guide_ready", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "guideStatus = listening", needsValue: true },
        { id: "ask_human", label: "Ask the human", valueLabel: "Question", placeholder: "Would you like a hint?", needsValue: true }
      ],
      visualStates: [
        { id: "idle", label: "Idle", help: "The normal resting appearance." },
        { id: "walking", label: "Walking", help: "Used while the character moves." },
        { id: "talking", label: "Talking", help: "Used while the character speaks." },
        { id: "listening", label: "Listening", help: "Used while waiting for a person." },
        { id: "celebrating", label: "Celebrating", help: "Used after a visible success." }
      ],
      hooks: [
        { id: "onStart", label: "When the scene starts", signature: "onStart({ self, world, state })" },
        { id: "onApproach", label: "When someone comes near", signature: "onApproach({ self, visitor, state })" },
        { id: "onInteract", label: "When someone interacts", signature: "onInteract({ self, visitor, state })" },
        { id: "onMessage", label: "When a message arrives", signature: "onMessage({ self, message, state })" },
        { id: "onTaskComplete", label: "When a task completes", signature: "onTaskComplete({ self, task, state })" }
      ]
    },
    interface: {
      id: "interface",
      label: "Screen control",
      beginnerLabel: "How this control reacts",
      description: "Choose what happens when a person opens, focuses, presses or submits this placed interface block.",
      triggers: [
        { id: "screen_opens", label: "The screen opens", help: "Runs when this interface becomes visible." },
        { id: "human_focuses", label: "Someone focuses it", help: "Runs when keyboard or pointer focus reaches the block." },
        { id: "human_activates", label: "Someone presses it", help: "Runs after a click, tap, Enter or Space activation." },
        { id: "form_submits", label: "A form is submitted", help: "Runs after a local form action." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a displayed project value changes." }
      ],
      actions: [
        { id: "show_message", label: "Show a message", valueLabel: "Message", placeholder: "The next step is ready.", needsValue: true },
        { id: "change_label", label: "Change its label", valueLabel: "New label", placeholder: "Opened", needsValue: true },
        { id: "change_visual_state", label: "Change its visual state", valueLabel: "Visual state", placeholder: "active", needsValue: true },
        { id: "show_block", label: "Show another block", valueLabel: "Block id or name", placeholder: "details-panel", needsValue: true },
        { id: "hide_block", label: "Hide another block", valueLabel: "Block id or name", placeholder: "intro-panel", needsValue: true },
        { id: "navigate", label: "Go to a route", valueLabel: "Route", placeholder: "/next", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "continue_pressed", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "panelOpen = true", needsValue: true }
      ],
      visualStates: [
        { id: "default", label: "Default", help: "The normal appearance." },
        { id: "focus", label: "Focus", help: "Visible keyboard or pointer focus." },
        { id: "active", label: "Pressed / active", help: "Used after deliberate activation." },
        { id: "disabled", label: "Disabled", help: "Visible but unavailable." }
      ],
      hooks: [
        { id: "onOpen", label: "When it opens", signature: "onOpen({ self, state })" },
        { id: "onFocus", label: "When it receives focus", signature: "onFocus({ self, state })" },
        { id: "onActivate", label: "When someone activates it", signature: "onActivate({ self, input, state })" },
        { id: "onSubmit", label: "When a form submits", signature: "onSubmit({ self, values, state })" }
      ]
    },
    scene: {
      id: "scene",
      label: "Scene or environment",
      beginnerLabel: "How this place changes",
      description: "Give this scene, map, scenery layer, camera or effect its own visible states and reactions.",
      triggers: [
        { id: "project_starts", label: "The scene starts", help: "Runs when the scene first loads." },
        { id: "player_enters", label: "The player enters", help: "Runs when the player enters this area." },
        { id: "player_leaves", label: "The player leaves", help: "Runs when the player exits this area." },
        { id: "timer_finishes", label: "A timer finishes", help: "Runs after a connected timer ends." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a world value changes." },
        { id: "task_completed", label: "A task is completed", help: "Runs after visible completion evidence." }
      ],
      actions: [
        { id: "change_visual_state", label: "Change the scene state", valueLabel: "Visual state", placeholder: "complete", needsValue: true },
        { id: "show_message", label: "Show a message", valueLabel: "Message", placeholder: "The grove is restored.", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "area_entered", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "weather = evening", needsValue: true },
        { id: "show_block", label: "Show a block", valueLabel: "Block id or name", placeholder: "celebration-effect", needsValue: true },
        { id: "hide_block", label: "Hide a block", valueLabel: "Block id or name", placeholder: "fog-layer", needsValue: true }
      ],
      visualStates: [
        { id: "default", label: "Default", help: "The normal scene appearance." },
        { id: "active", label: "Active", help: "Used during the main interaction." },
        { id: "complete", label: "Complete", help: "Used after the scene goal is reached." },
        { id: "hidden", label: "Hidden", help: "Stored but not currently visible." }
      ],
      hooks: [
        { id: "onSceneStart", label: "When the scene starts", signature: "onSceneStart({ scene, world, state })" },
        { id: "onEnter", label: "When the player enters", signature: "onEnter({ scene, player, state })" },
        { id: "onLeave", label: "When the player leaves", signature: "onLeave({ scene, player, state })" },
        { id: "onComplete", label: "When the scene completes", signature: "onComplete({ scene, state })" }
      ]
    },
    "world-object": {
      id: "world-object",
      label: "World object",
      beginnerLabel: "How this object reacts",
      description: "Give this one placed object its own interaction, state and asset slots without changing every object of the same type.",
      triggers: [
        { id: "project_starts", label: "The scene starts", help: "Runs when the object first appears." },
        { id: "player_nearby", label: "Someone comes near", help: "Runs when a player enters the nearby area." },
        { id: "human_activates", label: "Someone interacts", help: "Runs after a click, tap or interact action." },
        { id: "collision", label: "Something touches it", help: "Runs after a declared collision." },
        { id: "collected", label: "It is collected", help: "Runs after the object is collected." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a connected world value changes." }
      ],
      actions: [
        { id: "show_message", label: "Show a message", valueLabel: "Message", placeholder: "You found a star seed.", needsValue: true },
        { id: "change_visual_state", label: "Change its visual state", valueLabel: "Visual state", placeholder: "collected", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "star_seed_found", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "seedFound = true", needsValue: true },
        { id: "add_number", label: "Change a number", valueLabel: "Number change", placeholder: "seeds + 1", needsValue: true },
        { id: "hide_block", label: "Hide this object", valueLabel: "Optional note", placeholder: "Hide after collection", needsValue: false }
      ],
      visualStates: [
        { id: "idle", label: "Idle", help: "The normal object appearance." },
        { id: "highlighted", label: "Highlighted", help: "Used when the object can be interacted with." },
        { id: "active", label: "Active", help: "Used during its main action." },
        { id: "collected", label: "Collected / complete", help: "Used after its purpose is complete." }
      ],
      hooks: [
        { id: "onApproach", label: "When someone comes near", signature: "onApproach({ self, visitor, state })" },
        { id: "onInteract", label: "When someone interacts", signature: "onInteract({ self, visitor, state })" },
        { id: "onCollision", label: "When something touches it", signature: "onCollision({ self, other, state })" },
        { id: "onCollected", label: "When it is collected", signature: "onCollected({ self, collector, state })" }
      ]
    },
    content: {
      id: "content",
      label: "Content block",
      beginnerLabel: "How this content changes",
      description: "Choose when this placed text, image or panel changes and which visible state or message it should use.",
      triggers: [
        { id: "screen_opens", label: "The screen opens", help: "Runs when this content first appears." },
        { id: "human_activates", label: "Someone interacts", help: "Runs after a click, tap or keyboard activation." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a connected value changes." },
        { id: "task_completed", label: "A task is completed", help: "Runs after visible completion evidence." }
      ],
      actions: [
        { id: "change_text", label: "Change the text", valueLabel: "New text", placeholder: "The task is complete.", needsValue: true },
        { id: "change_visual_state", label: "Change its visual state", valueLabel: "Visual state", placeholder: "success", needsValue: true },
        { id: "show_block", label: "Show this content", valueLabel: "Optional note", placeholder: "Reveal after review", needsValue: false },
        { id: "hide_block", label: "Hide this content", valueLabel: "Optional note", placeholder: "Hide until needed", needsValue: false },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "evidence_opened", needsValue: true }
      ],
      visualStates: [
        { id: "default", label: "Default", help: "The normal content appearance." },
        { id: "emphasis", label: "Emphasis", help: "Used when this content needs attention." },
        { id: "success", label: "Success", help: "Used after a verified result." },
        { id: "warning", label: "Warning", help: "Used for an unresolved issue." }
      ],
      hooks: [
        { id: "onShow", label: "When it becomes visible", signature: "onShow({ self, state })" },
        { id: "onActivate", label: "When someone activates it", signature: "onActivate({ self, input, state })" },
        { id: "onStateChange", label: "When state changes", signature: "onStateChange({ self, change, state })" }
      ]
    },
    "data-display": {
      id: "data-display",
      label: "Status display",
      beginnerLabel: "How this display responds",
      description: "Choose how this metric, chart, list, progress bar or HUD reacts when its value changes.",
      triggers: [
        { id: "screen_opens", label: "The screen opens", help: "Runs when the display first appears." },
        { id: "state_changes", label: "Its value changes", help: "Runs when the connected state value changes." },
        { id: "value_rises", label: "Its value goes up", help: "Runs when a number increases." },
        { id: "value_falls", label: "Its value goes down", help: "Runs when a number decreases." },
        { id: "goal_reached", label: "Its goal is reached", help: "Runs when the declared target is met." }
      ],
      actions: [
        { id: "change_value", label: "Change the displayed value", valueLabel: "Value or formula", placeholder: "score", needsValue: true },
        { id: "change_visual_state", label: "Change its visual state", valueLabel: "Visual state", placeholder: "complete", needsValue: true },
        { id: "show_message", label: "Show a message", valueLabel: "Message", placeholder: "Goal reached.", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "goal_reached", needsValue: true }
      ],
      visualStates: [
        { id: "default", label: "Default", help: "The normal display appearance." },
        { id: "good", label: "Good / rising", help: "Used for a healthy or improving value." },
        { id: "warning", label: "Warning", help: "Used when attention is needed." },
        { id: "complete", label: "Complete", help: "Used when the declared goal is reached." }
      ],
      hooks: [
        { id: "onValueChange", label: "When the value changes", signature: "onValueChange({ self, value, previous, state })" },
        { id: "onGoal", label: "When the goal is reached", signature: "onGoal({ self, value, state })" }
      ]
    },
    generic: {
      id: "generic",
      label: "General block",
      beginnerLabel: "How this block reacts",
      description: "Use a small visible rule now. A future trusted module may offer more specialized choices.",
      triggers: [
        { id: "project_starts", label: "The project starts", help: "Runs when the experience first opens." },
        { id: "human_activates", label: "Someone interacts", help: "Runs after a click, tap or keyboard activation." },
        { id: "state_changes", label: "Shared state changes", help: "Runs when a named project value changes." }
      ],
      actions: [
        { id: "show_message", label: "Show a message", valueLabel: "Message", placeholder: "The block reacted.", needsValue: true },
        { id: "emit_event", label: "Send a named event", valueLabel: "Event name", placeholder: "block_reacted", needsValue: true },
        { id: "set_state", label: "Set shared state", valueLabel: "State change", placeholder: "status = ready", needsValue: true }
      ],
      visualStates: [],
      hooks: [
        { id: "onStart", label: "When the project starts", signature: "onStart({ self, state })" },
        { id: "onActivate", label: "When someone interacts", signature: "onActivate({ self, input, state })" },
        { id: "onStateChange", label: "When state changes", signature: "onStateChange({ self, change, state })" }
      ]
    }
  };

  const INFLUENCE_TYPE_MODULES = {
    "player-sprite": "character",
    npc: "character",
    "world-object": "world-object",
    "game-scene": "scene",
    "world-map": "scene",
    "tile-layer": "scene",
    camera: "scene",
    effect: "scene",
    screen: "interface",
    section: "interface",
    navigation: "interface",
    button: "interface",
    form: "interface",
    modal: "interface",
    tabs: "interface",
    card: "interface",
    heading: "content",
    text: "content",
    image: "content",
    "task-card": "content",
    "review-queue": "content",
    "evidence-panel": "content",
    "decision-panel": "content",
    "learning-panel": "content",
    "agent-landmark": "content",
    metric: "data-display",
    progress: "data-display",
    chart: "data-display",
    list: "data-display",
    hud: "data-display"
  };

  function getInfluenceModule(layer, type) {
    const definition = BLOCK_MAP[layer + ":" + type];
    const explicit = definition && definition.influenceModule;
    if (explicit && INFLUENCE_MODULES[explicit]) return explicit;
    if (INFLUENCE_TYPE_MODULES[type]) return INFLUENCE_TYPE_MODULES[type];
    if (layer === "logic") return "logic-flow";
    if (layer === "capabilities") return "capability";
    return "generic";
  }

  function getInfluenceProfile(layer, type) {
    return INFLUENCE_MODULES[getInfluenceModule(layer, type)] || INFLUENCE_MODULES.generic;
  }

  function defaultInfluence(layer, type) {
    return {
      schemaVersion: INFLUENCE_SCHEMA_VERSION,
      moduleId: getInfluenceModule(layer, type),
      mode: "GUIDED",
      rules: [],
      visualStates: {},
      codeHooks: [],
      updatedAt: now()
    };
  }

  function createInfluenceRule(trigger, action, value, note, enabled) {
    const timestamp = now();
    return {
      id: uid("rule"),
      enabled: enabled !== false,
      trigger: String(trigger || "").slice(0, 120),
      action: String(action || "").slice(0, 120),
      value: String(value == null ? "" : value).slice(0, 2000),
      note: String(note || "").slice(0, 1000),
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function normalizeInfluence(source, layer, type) {
    const base = defaultInfluence(layer, type);
    if (!source || typeof source !== "object" || Array.isArray(source)) return base;
    const result = Object.assign({}, clone(source), base);
    result.schemaVersion = INFLUENCE_SCHEMA_VERSION;
    result.moduleId = getInfluenceModule(layer, type);
    result.mode = "GUIDED";
    result.rules = (Array.isArray(source.rules) ? source.rules : []).slice(0, MAX_INFLUENCE_RULES).map(function (item) {
      item = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      return Object.assign({}, clone(item), {
        id: String(item.id || uid("rule")).slice(0, 160),
        enabled: item.enabled !== false,
        trigger: String(item.trigger || "").slice(0, 120),
        action: String(item.action || "").slice(0, 120),
        value: String(item.value == null ? "" : item.value).slice(0, 2000),
        note: String(item.note || "").slice(0, 1000),
        createdAt: item.createdAt || now(),
        updatedAt: item.updatedAt || item.createdAt || now()
      });
    });
    const states = source.visualStates && typeof source.visualStates === "object" && !Array.isArray(source.visualStates) ? source.visualStates : {};
    result.visualStates = {};
    Object.keys(states).slice(0, 20).forEach(function (stateId) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(stateId) || ["__proto__", "prototype", "constructor"].includes(stateId)) return;
      const state = states[stateId] && typeof states[stateId] === "object" && !Array.isArray(states[stateId]) ? states[stateId] : {};
      result.visualStates[stateId] = Object.assign({}, clone(state), {
        assetRef: String(state.assetRef || "").slice(0, 1000),
        color: state.color ? safeColor(state.color) : "",
        notes: String(state.notes || "").slice(0, 2000),
        updatedAt: state.updatedAt || now()
      });
    });
    result.codeHooks = (Array.isArray(source.codeHooks) ? source.codeHooks : []).slice(0, MAX_CODE_HOOKS).map(function (item) {
      item = item && typeof item === "object" && !Array.isArray(item) ? item : {};
      return Object.assign({}, clone(item), {
        id: String(item.id || uid("hook")).slice(0, 160),
        hook: String(item.hook || "").slice(0, 120),
        label: String(item.label || "Advanced hook draft").slice(0, 240),
        language: ["JavaScript", "JSON expression"].includes(String(item.language)) ? String(item.language) : "JavaScript",
        code: String(item.code || "").slice(0, 12000),
        execution: "CONTRACT_ONLY",
        enabled: false,
        updatedAt: item.updatedAt || now()
      });
    });
    result.updatedAt = source.updatedAt || now();
    return result;
  }

  function influenceOption(list, id) {
    return (list || []).find(function (item) { return item.id === id; }) || null;
  }

  function influenceRuleSentence(node, rule) {
    const profile = getInfluenceProfile(node.layer, node.type);
    const trigger = influenceOption(profile.triggers, rule.trigger);
    const action = influenceOption(profile.actions, rule.action);
    const whenText = trigger ? trigger.label : (rule.trigger || "an unknown moment");
    const actionText = action ? action.label : (rule.action || "an unknown action");
    const valueText = String(rule.value || "").trim();
    return "When " + whenText.toLowerCase() + ", “" + node.label + "” will " + actionText.toLowerCase() + (valueText ? ": " + valueText : ".");
  }

  function simulateInfluence(node, triggerId, ruleId) {
    const influence = normalizeInfluence(node && node.influence, node && node.layer, node && node.type);
    const rules = influence.rules.filter(function (rule) {
      return rule.enabled !== false && (!triggerId || rule.trigger === triggerId) && (!ruleId || rule.id === ruleId);
    });
    return {
      nodeId: node && node.id || null,
      moduleId: influence.moduleId,
      trigger: String(triggerId || ""),
      matched: rules.length,
      steps: rules.map(function (rule) {
        return { ruleId: rule.id, trigger: rule.trigger, action: rule.action, value: rule.value, sentence: influenceRuleSentence(node, rule) };
      }),
      disclosure: "This is a safe dry-run explanation. It does not execute code, change project source or prove a runtime works."
    };
  }

  function generateBlockAssetRequest(project, nodeId) {
    const node = findNode(project, nodeId);
    if (!node) throw new Error("The requested block could not be found.");
    const profile = getInfluenceProfile(node.layer, node.type);
    const influence = normalizeInfluence(node.influence, node.layer, node.type);
    return {
      schema: "axm.asset.block-request",
      schemaVersion: 1,
      createdAt: now(),
      source: {
        projectId: project.id,
        projectName: project.name,
        projectUpdatedAt: project.meta.updatedAt,
        builderVersion: APP_VERSION,
        blockId: node.id,
        blockType: node.layer + ":" + node.type,
        blockLabel: node.label
      },
      authority: "PROPOSE_ASSETS_ONLY",
      module: {
        id: profile.id,
        label: profile.label,
        purpose: node.summary || getDefinition(node.layer, node.type).description
      },
      continuity: [
        "Keep the identity and purpose of this exact placed block consistent across every requested state.",
        "Return each asset with its state id, source note, license status and editable generation settings.",
        "Do not replace project logic, permissions, routes, identity or human-approved text."
      ],
      states: (profile.visualStates || []).map(function (slot) {
        const current = influence.visualStates[slot.id] || {};
        return {
          id: slot.id,
          label: slot.label,
          purpose: slot.help,
          currentAssetRef: current.assetRef || "",
          preferredColor: current.color || (node.config && node.config.color) || "",
          notes: current.notes || ""
        };
      }),
      disclosure: "This request does not generate, upload, license or apply an asset. A human must review returned files before binding them to this block."
    };
  }

  function validateBlockPack(payload) {
    const errors = [];
    if (!payload || typeof payload !== "object") return { valid: false, errors: ["Pack source must be a JSON object."], pack: null };
    if (payload.schema !== "axm.shapeable.block-pack") errors.push("Pack schema must be axm.shapeable.block-pack.");
    if (Number(payload.schemaVersion) !== 1) errors.push("Only block-pack schema version 1 is supported.");
    const id = String(payload.id || "");
    if (!/^[a-z0-9][a-z0-9-]{2,48}$/.test(id)) errors.push("Pack id must use 3–49 lowercase letters, numbers or hyphens.");
    ["name", "version", "source", "testStatus", "licenseStatus"].forEach(function (field) {
      if (!String(payload[field] || "").trim()) errors.push("Pack must declare " + field + ".");
    });
    if (!Array.isArray(payload.blocks) || !payload.blocks.length) errors.push("Pack must contain at least one block.");
    if (Array.isArray(payload.blocks) && payload.blocks.length > 50) errors.push("A beta pack may contain at most 50 blocks.");
    const seen = new Set();
    (Array.isArray(payload.blocks) ? payload.blocks : []).forEach(function (block, index) {
      const prefix = "Block " + (index + 1) + ": ";
      if (!block || typeof block !== "object") { errors.push(prefix + "definition must be an object."); return; }
      if (!MAYBE_LAYER(block.layer)) errors.push(prefix + "layer must be logic, capabilities or visual.");
      if (!String(block.type || "").startsWith(id + "--") || !/^[a-z0-9-]+$/.test(String(block.type || ""))) errors.push(prefix + "type must be namespaced as " + id + "--block-name.");
      if (seen.has(block.type)) errors.push(prefix + "type is duplicated inside the pack.");
      seen.add(block.type);
      ["label", "subtitle", "description", "group"].forEach(function (field) { if (!String(block[field] || "").trim()) errors.push(prefix + "missing " + field + "."); });
      if (!ICON_PATHS[block.icon]) errors.push(prefix + "icon must name a built-in safe icon.");
      if (!validRgb(block.rgb)) errors.push(prefix + "rgb must contain three values from 0 to 255.");
      if (!Array.isArray(block.targets) || !block.targets.length || block.targets.some(function (target) { return !ALL_TARGETS.includes(target); })) errors.push(prefix + "targets must contain supported target ids.");
      if (block.influenceModule != null && !INFLUENCE_MODULES[String(block.influenceModule)]) errors.push(prefix + "influenceModule must name a built-in safe influence module.");
      if (block.permission != null) {
        if (typeof block.permission !== "object" || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(block.permission.id || "")) || !String(block.permission.label || "").trim() || !String(block.permission.reason || "").trim()) errors.push(prefix + "permission must declare a safe id, label and reason.");
      }
      if (block.fields != null && !Array.isArray(block.fields)) errors.push(prefix + "fields must be an array.");
      if (Array.isArray(block.fields) && block.fields.length > 20) errors.push(prefix + "a block may declare at most 20 fields.");
      const fieldKeys = new Set();
      (Array.isArray(block.fields) ? block.fields : []).forEach(function (field) {
        const key = String(field && field.key || "");
        if (!field || !/^[a-zA-Z][a-zA-Z0-9_-]{0,48}$/.test(key) || ["__proto__", "prototype", "constructor"].includes(key) || !String(field.label || "").trim() || !["text", "textarea", "number", "select", "checkbox", "color"].includes(field.type)) errors.push(prefix + "each field needs a safe key, label and supported type.");
        if (fieldKeys.has(key)) errors.push(prefix + "field keys must be unique.");
        fieldKeys.add(key);
        if (field && field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.length > 30 || field.options.some(function (option) { return typeof option !== "string" || option.length > 160; }))) errors.push(prefix + "select fields need 1–30 short string options.");
      });
      if (block.defaults != null && (typeof block.defaults !== "object" || Array.isArray(block.defaults))) errors.push(prefix + "defaults must be an object.");
      Object.entries(block.defaults && typeof block.defaults === "object" && !Array.isArray(block.defaults) ? block.defaults : {}).forEach(function (entry) {
        const key = entry[0], value = entry[1];
        if (!fieldKeys.has(key)) errors.push(prefix + "default key “" + key + "” has no declared field.");
        if (value != null && !["string", "number", "boolean"].includes(typeof value)) errors.push(prefix + "default values must be strings, numbers, booleans or null.");
      });
    });
    if (errors.length) return { valid: false, errors: errors, pack: null };
    const pack = {
      schema: "axm.shapeable.block-pack",
      schemaVersion: 1,
      id: id,
      name: String(payload.name).slice(0, 160),
      version: String(payload.version).slice(0, 80),
      source: String(payload.source).slice(0, 500),
      testStatus: String(payload.testStatus).slice(0, 160),
      licenseStatus: String(payload.licenseStatus).slice(0, 160),
      importedAt: now()
    };
    pack.blocks = payload.blocks.map(function (block) {
      return {
        type: String(block.type), layer: String(block.layer), label: String(block.label).slice(0, 120), subtitle: String(block.subtitle).slice(0, 120),
        description: String(block.description).slice(0, 1000), group: String(block.group).slice(0, 120), icon: String(block.icon), rgb: String(block.rgb),
        input: block.input !== false, output: block.output !== false, targets: clone(block.targets), permission: block.permission ? { id: String(block.permission.id), label: String(block.permission.label).slice(0, 160), reason: String(block.permission.reason).slice(0, 1000) } : null,
        influenceModule: block.influenceModule && INFLUENCE_MODULES[String(block.influenceModule)] ? String(block.influenceModule) : null,
        defaults: block.defaults && typeof block.defaults === "object" ? clone(block.defaults) : {}, fields: Array.isArray(block.fields) ? block.fields.map(function (field) {
          const safe = { key: String(field.key), label: String(field.label).slice(0, 120), type: String(field.type) };
          if (field.type === "select") safe.options = field.options.slice();
          if (field.type === "number") {
            if (Number.isFinite(field.min)) safe.min = Number(field.min);
            if (Number.isFinite(field.max)) safe.max = Number(field.max);
          }
          return safe;
        }) : []
      };
    });
    return { valid: true, errors: [], pack: pack };
  }

  function MAYBE_LAYER(layer) {
    return layer === "logic" || layer === "capabilities" || layer === "visual";
  }

  function unregisterBlockPack(packId) {
    const existing = REGISTERED_PACKS.get(packId);
    if (!existing) return false;
    existing.blocks.forEach(function (block) {
      BLOCKS[block.layer] = BLOCKS[block.layer].filter(function (candidate) { return candidate.packId !== packId; });
      delete BLOCK_MAP[block.layer + ":" + block.type];
    });
    REGISTERED_PACKS.delete(packId);
    return true;
  }

  function registerBlockPack(payload) {
    const result = validateBlockPack(payload);
    if (!result.valid) return result;
    const pack = result.pack;
    const collisions = pack.blocks.filter(function (block) {
      const existing = BLOCK_MAP[block.layer + ":" + block.type];
      return existing && existing.packId !== pack.id;
    });
    if (collisions.length) return { valid: false, errors: collisions.map(function (block) { return "Block type already exists: " + block.layer + ":" + block.type; }), pack: null };
    unregisterBlockPack(pack.id);
    pack.blocks.forEach(function (source) {
      const definition = clone(source);
      definition.packId = pack.id;
      definition.provenance = { source: pack.source, version: pack.version, testStatus: pack.testStatus, licenseStatus: pack.licenseStatus, packId: pack.id };
      BLOCKS[definition.layer].push(definition);
      BLOCK_MAP[definition.layer + ":" + definition.type] = definition;
    });
    REGISTERED_PACKS.set(pack.id, pack);
    return { valid: true, errors: [], pack: clone(pack) };
  }

  function getRegisteredPacks() {
    return Array.from(REGISTERED_PACKS.values()).map(clone);
  }

  function blockPackTemplate() {
    return {
      schema: "axm.shapeable.block-pack",
      schemaVersion: 1,
      id: "example-pack",
      name: "Example local block pack",
      version: "0.1.0",
      source: "Declare creator or source location",
      testStatus: "UNTESTED",
      licenseStatus: "NO LICENSE DECLARED",
      blocks: [{
        layer: "logic", type: "example-pack--visible-step", label: "Visible step", subtitle: "Example community block", group: "Example pack",
        icon: "spark", rgb: "68, 215, 202", description: "Explain exactly what this block does.", input: true, output: true,
        targets: ["website", "dashboard", "game", "custom"], permission: null, influenceModule: "logic-flow", defaults: { message: "Hello" },
        fields: [{ key: "message", label: "Message", type: "text" }]
      }]
    };
  }

  function getDefinition(layer, type) {
    return BLOCK_MAP[layer + ":" + type] || {
      type: type || "unknown",
      layer: layer,
      label: "Unknown block",
      subtitle: "Preserved from source",
      group: "Imported",
      icon: "code",
      rgb: LAYERS[layer] ? LAYERS[layer].rgb : "178, 194, 207",
      description: "This block type is not known by the current builder version. It has been preserved without rewriting.",
      input: true,
      output: true,
      targets: ALL_TARGETS,
      defaults: {},
      fields: []
    };
  }

  function createNode(layer, type, x, y, overrides) {
    const definition = getDefinition(layer, type);
    const node = {
      id: uid("node"),
      layer: layer,
      type: type,
      label: definition.label,
      summary: definition.description,
      x: Number.isFinite(x) ? x : 160,
      y: Number.isFinite(y) ? y : 120,
      enabled: true,
      config: clone(definition.defaults || {}),
      influence: defaultInfluence(layer, type),
      permission: definition.permission ? {
        id: definition.permission.id,
        approved: false,
        reviewedAt: null
      } : null,
      provenance: Object.assign({
        source: "AXM Shapeable Builder built-in",
        version: APP_VERSION,
        testStatus: "BUILT-IN BETA",
        licenseStatus: "See package license status",
        imported: false
      }, definition.provenance || {}),
      createdAt: now(),
      updatedAt: now()
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (key) {
        if (key === "config") {
          node.config = Object.assign({}, node.config, clone(overrides.config));
        } else if (key === "influence") {
          node.influence = normalizeInfluence(overrides.influence, layer, type);
        } else if (key === "permission" && overrides.permission) {
          node.permission = Object.assign({}, node.permission || {}, clone(overrides.permission));
        } else {
          node[key] = clone(overrides[key]);
        }
      });
    }
    return node;
  }

  function defaultCollaborationPolicy() {
    return {
      mode: "HUMAN_LED",
      youngAiSeat: "PROPOSE_ONLY",
      humanApplyRequired: true,
      permissionChanges: "HUMAN_ONLY",
      canonChanges: "HUMAN_ONLY",
      destructiveProjectActions: "HUMAN_ONLY",
      hiddenExecution: "BLOCKED",
      maxActionsPerProposal: 60,
      reviewLog: []
    };
  }

  function createBaseProject(options) {
    options = options || {};
    const timestamp = now();
    return {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      id: uid("project"),
      name: options.name || "Untitled project",
      description: options.description || "A local-first project shaped across logic, capability and visual layers.",
      target: options.target || "website",
      accent: options.accent || "#44d7ca",
      meta: {
        templateId: options.templateId || "blank",
        templateName: options.templateName || "Blank project",
        createdAt: timestamp,
        updatedAt: timestamp,
        builderVersion: APP_VERSION,
        sourceMode: "local-first",
        canonStatus: "EXPERIMENTAL BETA"
      },
      layers: {
        logic: { nodes: [], edges: [] },
        capabilities: { nodes: [], edges: [] },
        visual: { nodes: [], edges: [] }
      },
      bindings: [],
      spine: {
        goal: {
          statement: String(options.goal || ""),
          successMeasure: String(options.successMeasure || ""),
          status: "WORKING"
        },
        stateSchema: {},
        invariants: [
          "No capability gains permission without visible human approval.",
          "All generated output remains exportable as readable project files.",
          "Unknown imported blocks are preserved and reported, never silently replaced."
        ],
        compatibility: {
          runtime: "Modern browser",
          offline: true,
          externalDependencies: []
        },
        collaboration: defaultCollaborationPolicy(),
        provenance: {
          generator: "AXM Shapeable Builder",
          generatorVersion: APP_VERSION,
          sourceIntegrity: "Project source is canonical"
        }
      },
      ledger: [{
        id: uid("event"),
        at: timestamp,
        actor: "human",
        type: "project.created",
        message: "Created local project source truth",
        layer: null
      }]
    };
  }

  function templateBuilder(id, name, target, description, accent) {
    const project = createBaseProject({ name: name, target: target, description: description, accent: accent, templateId: id, templateName: name });
    const refs = {};
    function add(key, layer, type, x, y, overrides) {
      const node = createNode(layer, type, x, y, overrides);
      project.layers[layer].nodes.push(node);
      refs[key] = node;
      return node;
    }
    function edge(layer, from, to, label) {
      const fromNode = typeof from === "string" ? refs[from] : from;
      const toNode = typeof to === "string" ? refs[to] : to;
      const item = { id: uid("edge"), from: fromNode.id, to: toNode.id, label: label || "flow", createdAt: now() };
      project.layers[layer].edges.push(item);
      return item;
    }
    function bind(from, to, purpose) {
      const fromNode = typeof from === "string" ? refs[from] : from;
      const toNode = typeof to === "string" ? refs[to] : to;
      const item = { id: uid("binding"), source: fromNode.id, target: toNode.id, purpose: purpose || "contract", createdAt: now() };
      project.bindings.push(item);
      return item;
    }
    return { project: project, refs: refs, add: add, edge: edge, bind: bind };
  }

  function finishTemplate(context, stateSchema) {
    context.project.spine.stateSchema = stateSchema || {};
    if (!context.project.spine.goal.statement) context.project.spine.goal.statement = context.project.description;
    if (!context.project.spine.goal.successMeasure) context.project.spine.goal.successMeasure = context.project.target === "game" ? "The player can complete the primary playable route." : "A user can understand and complete the primary interaction route.";
    context.project.ledger.push({
      id: uid("event"), at: now(), actor: "human", type: "template.loaded",
      message: "Loaded rooted template: " + context.project.meta.templateName, layer: null
    });
    return context.project;
  }

  function blankTemplate() {
    return createBaseProject({ name: "Untitled project", target: "website", templateId: "blank", templateName: "Blank project" });
  }

  function websiteTemplate() {
    const c = templateBuilder("website", "Open invitation", "website", "A polished interactive website that keeps its message, actions and local behavior inspectable.", "#44d7ca");
    c.add("start", "logic", "start-event", 100, 120, { label: "Page opens", config: { trigger: "Project starts" } });
    c.add("route", "logic", "route", 390, 120, { label: "Show home", config: { destination: "/" } });
    c.add("buttonEvent", "logic", "event", 390, 320, { label: "Invitation pressed", config: { eventName: "Join button pressed" } });
    c.add("action", "logic", "action", 690, 320, { label: "Reveal next step", config: { action: "Show participation message" } });
    c.add("state", "logic", "state", 690, 120, { label: "Visitor state", config: { key: "visitorStatus", initialValue: "exploring" } });
    c.edge("logic", "start", "route"); c.edge("logic", "route", "state"); c.edge("logic", "buttonEvent", "action");

    c.add("storage", "capabilities", "local-storage", 160, 170, { label: "Remember locally", config: { namespace: "open-invitation", autosave: true } });
    c.add("assets", "capabilities", "asset-library", 460, 170, { label: "Project visuals" });
    c.add("diagnostics", "capabilities", "diagnostics", 760, 170, { label: "Proof checks", config: { level: "Strict" } });
    c.add("export", "capabilities", "export-packager", 1060, 170, { label: "Portable website" });
    c.edge("capabilities", "storage", "assets"); c.edge("capabilities", "assets", "diagnostics"); c.edge("capabilities", "diagnostics", "export");

    c.add("screen", "visual", "screen", 90, 100, { label: "Home screen", config: { route: "/", layout: "Responsive" } });
    c.add("nav", "visual", "navigation", 380, 70, { label: "Primary navigation", config: { items: "Purpose, How it works, Join" } });
    c.add("heading", "visual", "heading", 380, 230, { label: "Main invitation", config: { text: "Build what should exist.", level: "H1" } });
    c.add("text", "visual", "text", 690, 230, { label: "Purpose statement", config: { text: "Shape a useful idea with logic you can inspect, capabilities you control, and an experience people understand." } });
    const invitationButton = c.add("button", "visual", "button", 690, 410, { label: "Join action", config: { text: "Explore the project", action: "reveal" } });
    invitationButton.influence.rules.push(
      createInfluenceRule("human_activates", "show_message", "The next step is visible. Nothing was sent anywhere.", "Beginner example: this reaction belongs only to this placed button."),
      createInfluenceRule("human_activates", "change_label", "Opened", "The exported local preview can use this safe structured reaction.")
    );
    invitationButton.influence.visualStates.active = { assetRef: "", color: "#44d7ca", notes: "Use a brighter state after the invitation is opened.", updatedAt: now() };
    c.add("section", "visual", "section", 1000, 230, { label: "Three-layer story", config: { layout: "Grid", columns: 3 } });
    c.edge("visual", "screen", "nav"); c.edge("visual", "nav", "heading"); c.edge("visual", "heading", "text"); c.edge("visual", "text", "button"); c.edge("visual", "button", "section");

    c.bind("start", "screen", "opens"); c.bind("route", "screen", "routes to"); c.bind("buttonEvent", "button", "listens to"); c.bind("action", "button", "updates"); c.bind("state", "storage", "persists through"); c.bind("assets", "section", "supplies visuals"); c.bind("diagnostics", "screen", "validates");
    return finishTemplate(c, { visitorStatus: { type: "string", default: "exploring" }, invitationOpened: { type: "boolean", default: false } });
  }

  function dashboardTemplate() {
    const c = templateBuilder("dashboard", "Local stewardship board", "dashboard", "A calm local dashboard for observing metrics, actions and evidence without hidden cloud state.", "#9c7cff");
    c.add("start", "logic", "start-event", 90, 120, { label: "Board opens", config: { trigger: "Project starts" } });
    c.add("timer", "logic", "timer", 370, 120, { label: "Refresh rhythm", config: { duration: 5, mode: "Repeat" } });
    c.add("formula", "logic", "formula", 650, 120, { label: "Readiness formula", config: { formula: "healthySignals / totalSignals * 100" } });
    c.add("state", "logic", "state", 930, 120, { label: "Metric state", config: { key: "readiness", initialValue: "72" } });
    c.add("event", "logic", "event", 370, 330, { label: "Review pressed", config: { eventName: "Review activity pressed" } });
    c.add("action", "logic", "action", 650, 330, { label: "Open evidence", config: { action: "Show evidence panel" } });
    c.edge("logic", "start", "timer"); c.edge("logic", "timer", "formula"); c.edge("logic", "formula", "state"); c.edge("logic", "event", "action");

    c.add("storage", "capabilities", "local-storage", 110, 150, { label: "Local metric history", config: { namespace: "stewardship-board", autosave: true } });
    c.add("adapter", "capabilities", "mirror-adapter", 400, 150, { label: "Approved state mirror", config: { mode: "Read only", fields: "readiness, activity, warnings" } });
    c.add("diagnostics", "capabilities", "diagnostics", 690, 150, { label: "Metric verification", config: { level: "Strict" } });
    c.add("export", "capabilities", "export-packager", 980, 150, { label: "Board suitcase" });
    c.edge("capabilities", "storage", "adapter"); c.edge("capabilities", "adapter", "diagnostics"); c.edge("capabilities", "diagnostics", "export");

    c.add("screen", "visual", "screen", 70, 90, { label: "Stewardship screen", config: { route: "/board", layout: "Dashboard" } });
    c.add("heading", "visual", "heading", 350, 70, { label: "Board title", config: { text: "Stewardship overview", level: "H1" } });
    c.add("metric1", "visual", "metric", 350, 250, { label: "Build readiness", config: { label: "Build readiness", value: "84", unit: "%" } });
    c.add("metric2", "visual", "metric", 630, 250, { label: "Active routes", config: { label: "Active routes", value: "12", unit: "" } });
    c.add("chart", "visual", "chart", 910, 250, { label: "Activity pattern", config: { title: "Verified activity", series: "12, 16, 14, 22, 27, 31, 29" } });
    c.add("list", "visual", "list", 630, 440, { label: "Evidence list", config: { title: "Recent evidence", items: "Local save verified, Permission review pending, Export contract passed" } });
    c.edge("visual", "screen", "heading"); c.edge("visual", "heading", "metric1"); c.edge("visual", "heading", "metric2"); c.edge("visual", "metric2", "chart"); c.edge("visual", "chart", "list");

    c.bind("start", "screen", "opens"); c.bind("timer", "adapter", "requests approved refresh"); c.bind("formula", "metric1", "calculates"); c.bind("state", "storage", "persists through"); c.bind("state", "metric1", "displays in"); c.bind("adapter", "chart", "supplies approved metrics"); c.bind("diagnostics", "list", "supplies evidence");
    return finishTemplate(c, { readiness: { type: "number", default: 72 }, activeRoutes: { type: "number", default: 12 }, evidence: { type: "array", default: [] } });
  }

  function gameTemplate() {
    const c = templateBuilder("game", "Parcel run", "game", "A small playable top-down cooperative mission proving logic, local capabilities and visualization together.", "#ffb85c");
    c.add("start", "logic", "start-event", 80, 100, { label: "Mission starts", config: { trigger: "Mission starts" } });
    c.add("timer", "logic", "timer", 350, 100, { label: "Mission timer", config: { duration: 60, mode: "Countdown" } });
    c.add("counter", "logic", "counter", 620, 100, { label: "Parcels collected", config: { key: "parcels", start: 0, step: 1 } });
    c.add("condition", "logic", "condition", 890, 100, { label: "Goal reached?", config: { expression: "parcels >= 5" } });
    c.add("action", "logic", "action", 1160, 100, { label: "Reward team", config: { action: "Add 250 team credits" } });
    c.add("event", "logic", "event", 350, 320, { label: "Parcel touched", config: { eventName: "Player collects parcel" } });
    c.edge("logic", "start", "timer"); c.edge("logic", "timer", "counter"); c.edge("logic", "counter", "condition"); c.edge("logic", "condition", "action"); c.edge("logic", "event", "counter");

    c.add("multi", "capabilities", "local-multiplayer", 80, 140, { label: "Shared local session", config: { seats: 4, authority: "Host authoritative" } });
    c.add("phone", "capabilities", "phone-controls", 360, 140, { label: "Phone controller seats", config: { seats: 4, layout: "Casual gamepad" } });
    c.add("storage", "capabilities", "local-storage", 640, 140, { label: "Local high score", config: { namespace: "parcel-run", autosave: true } });
    c.add("assets", "capabilities", "asset-library", 920, 140, { label: "District assets" });
    c.add("diagnostics", "capabilities", "diagnostics", 1200, 140, { label: "Session checks", config: { level: "Strict" } });
    c.edge("capabilities", "multi", "phone"); c.edge("capabilities", "phone", "storage"); c.edge("capabilities", "storage", "assets"); c.edge("capabilities", "assets", "diagnostics");

    c.add("scene", "visual", "game-scene", 70, 100, { label: "District scene", config: { camera: "Top down", world: "Compact parcel district" } });
    c.add("player", "visual", "player-sprite", 360, 100, { label: "Courier", config: { name: "Courier", color: "#44d7ca" } });
    c.add("parcel", "visual", "world-object", 650, 100, { label: "Parcel", config: { name: "Parcel", interaction: "Collect" } });
    c.add("hud", "visual", "hud", 940, 100, { label: "Mission HUD", config: { title: "Parcel run", fields: "parcels, timer, reward" } });
    c.add("progress", "visual", "progress", 940, 300, { label: "Parcel progress", config: { label: "Parcels", value: 0 } });
    c.add("effect", "visual", "effect", 1230, 100, { label: "Goal celebration", config: { effect: "Celebrate", duration: 900 } });
    c.edge("visual", "scene", "player"); c.edge("visual", "scene", "parcel"); c.edge("visual", "scene", "hud"); c.edge("visual", "hud", "progress"); c.edge("visual", "progress", "effect");

    c.bind("start", "scene", "opens"); c.bind("timer", "hud", "displays in"); c.bind("counter", "progress", "updates"); c.bind("condition", "effect", "triggers"); c.bind("event", "parcel", "listens to"); c.bind("multi", "player", "owns state for"); c.bind("phone", "player", "controls"); c.bind("storage", "counter", "persists"); c.bind("assets", "scene", "supplies visuals"); c.bind("diagnostics", "scene", "validates");
    return finishTemplate(c, { parcels: { type: "number", default: 0 }, missionTime: { type: "number", default: 60 }, reward: { type: "number", default: 250 }, missionStatus: { type: "string", default: "ready" } });
  }

  function handsTemplate() {
    const c = templateBuilder("hands-loop", "Human + AI build loop", "dashboard", "A reviewable Scout, Builder, Tester, Repair and Nugget workflow where AI may propose work but a human controls every apply boundary.", "#74b9ff");
    c.project.spine.goal.statement = "Turn a human goal into a tested, reviewable change without granting hidden authority.";
    c.project.spine.goal.successMeasure = "Every proposed change has source evidence, a test result and a visible human decision before merge.";

    c.add("start", "logic", "start-event", 70, 110, { label: "Goal submitted", config: { trigger: "Project starts" } });
    c.add("scout", "logic", "hand-step", 330, 110, { label: "Scout context", config: { hand: "Scout", instruction: "Gather relevant source truth and constraints", review: "Human review" } });
    c.add("builder", "logic", "hand-step", 610, 110, { label: "Builder proposal", config: { hand: "Builder", instruction: "Create a bounded patch without rewriting unrelated work", review: "Manual merge gate" } });
    c.add("tester", "logic", "hand-step", 890, 110, { label: "Tester proof", config: { hand: "Tester", instruction: "Run proportionate checks and report exact evidence", review: "Diagnostics pass" } });
    c.add("decision", "logic", "condition", 1170, 110, { label: "Human accepts?", config: { expression: "humanDecision === 'accept'" } });
    c.add("repair", "logic", "hand-step", 890, 330, { label: "Repair route", config: { hand: "Repair", instruction: "Repair only the failed proof or rejected detail", review: "Human review" } });
    c.add("nugget", "logic", "hand-step", 1170, 330, { label: "Nugget return", config: { hand: "Nugget", instruction: "Return reusable learning with provenance", review: "Human review" } });
    c.add("proof", "logic", "validator", 1450, 110, { label: "Completion proof", config: { check: "Accepted patch and passing evidence both exist", onFail: "Stop and report" } });
    c.edge("logic", "start", "scout"); c.edge("logic", "scout", "builder"); c.edge("logic", "builder", "tester"); c.edge("logic", "tester", "decision"); c.edge("logic", "decision", "proof", "accepted"); c.edge("logic", "decision", "repair", "repair requested"); c.edge("logic", "repair", "tester", "retest"); c.edge("logic", "proof", "nugget");

    c.add("router", "capabilities", "hand-router", 80, 130, { label: "Hands return router", config: { sequence: "Scout, Builder, Tester, Repair, Nugget", applyMode: "Propose only" } });
    c.add("skills", "capabilities", "skill-pack", 360, 130, { label: "Project skill pack", config: { skill: "Shapeable project specialist", version: "0.1.0", source: "Local reviewed pack" } });
    c.add("ai", "capabilities", "ai-collaborator", 640, 130, { label: "Optional AI seat", config: { role: "Bounded collaborator", provider: "Not connected", approval: "Ask every run" } });
    c.add("diagnostics", "capabilities", "diagnostics", 920, 130, { label: "Proof runner", config: { level: "Strict" } });
    c.add("storage", "capabilities", "local-storage", 1200, 130, { label: "Local evidence vault", config: { namespace: "hands-build-loop", autosave: true } });
    c.add("export", "capabilities", "export-packager", 1480, 130, { label: "Review packet export" });
    c.edge("capabilities", "router", "skills"); c.edge("capabilities", "skills", "ai"); c.edge("capabilities", "ai", "diagnostics"); c.edge("capabilities", "diagnostics", "storage"); c.edge("capabilities", "storage", "export");

    c.add("screen", "visual", "screen", 60, 90, { label: "Build loop board", config: { route: "/build-loop", layout: "Dashboard" } });
    c.add("heading", "visual", "heading", 330, 70, { label: "Loop title", config: { text: "Human + AI build loop", level: "H1" } });
    c.add("metric1", "visual", "metric", 330, 250, { label: "Proposal state", config: { label: "Proposal state", value: "1", unit: " open" } });
    c.add("metric2", "visual", "metric", 600, 250, { label: "Proof checks", config: { label: "Proof checks", value: "4", unit: "/4" } });
    c.add("chart", "visual", "chart", 870, 250, { label: "Loop progress", config: { title: "Scout to Nugget", series: "12, 32, 56, 78, 100" } });
    c.add("list", "visual", "list", 600, 440, { label: "Evidence trail", config: { title: "Visible decisions", items: "Goal received,Source truth gathered,Patch proposed,Tests reported,Human decision pending" } });
    c.add("tabs", "visual", "tabs", 1140, 250, { label: "Review views", config: { tabs: "Proposal, Diff, Tests, Decision, Learning" } });
    c.edge("visual", "screen", "heading"); c.edge("visual", "heading", "metric1"); c.edge("visual", "heading", "metric2"); c.edge("visual", "metric2", "chart"); c.edge("visual", "chart", "list"); c.edge("visual", "list", "tabs");

    c.bind("start", "screen", "opens"); c.bind("scout", "router", "routes through"); c.bind("builder", "ai", "may request proposal from"); c.bind("tester", "diagnostics", "requests proof from"); c.bind("decision", "tabs", "is reviewed in"); c.bind("proof", "list", "records evidence in"); c.bind("storage", "list", "persists locally"); c.bind("export", "tabs", "packages visible review");
    return finishTemplate(c, { goal: { type: "string", default: "" }, proposalStatus: { type: "string", default: "open" }, humanDecision: { type: "string", default: "pending" }, proofChecks: { type: "array", default: [] } });
  }

  function youngAiWorkshopTemplate() {
    const c = templateBuilder("young-ai-workshop", "Young AI learning workshop", "dashboard", "A human-led workspace where an early-stage AI can observe the same project spine, propose bounded builder actions, receive a human decision, test and record evidence-linked learning.", "#be77ff");
    c.project.spine.goal.statement = "Let a young AI use the same builder source as a human through a clear observe, propose, review, test and learn loop.";
    c.project.spine.goal.successMeasure = "The AI can export a complete workspace packet, submit a valid bounded proposal, and see it remain unapplied until a human reviews and accepts it; permissions and canon never change automatically.";

    c.add("start", "logic", "start-event", 40, 90, { label: "Bounded task begins", config: { trigger: "Project starts" } });
    c.add("observe", "logic", "observe-step", 300, 90, { label: "Read shared source", config: { scope: "Whole project", output: "Facts, IDs, boundaries and diagnostics" } });
    c.add("hypothesis", "logic", "hypothesis-step", 560, 90, { label: "Explain one likely change", config: { hypothesis: "One bounded source change can improve the human goal", evidenceNeeded: "Source trace, dry-run impact and test plan" } });
    c.add("ask", "logic", "ask-human", 820, 90, { label: "Ask when meaning is missing", config: { question: "Is the goal, source or authority boundary unclear?", blocking: true } });
    c.add("proposal", "logic", "proposal-step", 1080, 90, { label: "Create action packet", config: { authority: "Propose only", maxActions: 12, expectedResult: "One reviewable improvement" } });
    c.add("decision", "logic", "human-decision", 1340, 90, { label: "Human reviews proposal", config: { choices: "Apply, Revise, Reject", defaultChoice: "Revise" } });
    c.add("evidence", "logic", "evidence-step", 820, 330, { label: "Run visible proof", config: { test: "Run diagnostics and the changed path", result: "Not run", status: "PENDING" } });
    c.add("reflect", "logic", "reflection-step", 1080, 330, { label: "Record bounded learning", config: { learned: "Only evidence-backed lessons enter the review log", nextAttempt: "Use the result on the next bounded task" } });
    c.add("proof", "logic", "validator", 1340, 330, { label: "Completion gate", config: { check: "Human decision, applied source and actual evidence agree", onFail: "Stop and report" } });
    c.edge("logic", "start", "observe"); c.edge("logic", "observe", "hypothesis"); c.edge("logic", "hypothesis", "ask"); c.edge("logic", "ask", "proposal"); c.edge("logic", "proposal", "decision"); c.edge("logic", "decision", "evidence", "approved"); c.edge("logic", "decision", "ask", "revise or clarify"); c.edge("logic", "evidence", "reflect"); c.edge("logic", "reflect", "proof");

    c.add("workspace", "capabilities", "agent-workspace", 40, 100, { label: "Shared young AI seat", config: { mode: "Observe and propose", actionLimit: 60, context: "Whole project" } });
    c.add("context", "capabilities", "context-window", 300, 100, { label: "Bounded context", config: { scope: "Whole project summary", maxItems: 200, includeLedger: "Recent only" } });
    c.add("tools", "capabilities", "tool-boundary", 560, 100, { label: "Allowed builder verbs", config: { allowed: "set project, set goal, add/update/move blocks, connect, bind, add state and invariants", blocked: "permissions, canon, project deletion, hidden execution" } });
    c.add("sandbox", "capabilities", "simulation-sandbox", 820, 100, { label: "Dry-run clone", config: { mode: "Clone only", keepPreview: false } });
    c.add("proposalCheck", "capabilities", "proposal-validator", 1080, 100, { label: "Authority and schema check", config: { staleSource: "Block", forbiddenActions: "Block", diagnosticsDelta: true } });
    c.add("diagnostics", "capabilities", "diagnostics", 1340, 100, { label: "Actual proof runner", config: { level: "Strict" } });
    c.add("journal", "capabilities", "learning-journal", 560, 340, { label: "Evidence-linked journal", config: { scope: "This project", evidenceRequired: true, retention: "Visible review log" } });
    c.add("access", "capabilities", "agent-accessibility", 820, 340, { label: "Semantic builder path", config: { stableIds: true, semanticLabels: true, keyboardPath: true } });
    c.add("export", "capabilities", "export-packager", 1080, 340, { label: "Portable collaboration packet" });
    c.edge("capabilities", "workspace", "context"); c.edge("capabilities", "context", "tools"); c.edge("capabilities", "tools", "sandbox"); c.edge("capabilities", "sandbox", "proposalCheck"); c.edge("capabilities", "proposalCheck", "diagnostics"); c.edge("capabilities", "diagnostics", "journal"); c.edge("capabilities", "journal", "access"); c.edge("capabilities", "access", "export");

    c.add("screen", "visual", "screen", 40, 90, { label: "Learning workshop screen", config: { route: "/young-ai-workshop", layout: "Dashboard" } });
    c.add("heading", "visual", "heading", 300, 70, { label: "Workshop title", config: { text: "One builder, human and young AI", level: "H1" } });
    c.add("task", "visual", "task-card", 300, 270, { label: "Current bounded task", config: { title: "Current bounded task", scope: "Shared project spine", doneWhen: "Human-visible improvement plus actual evidence" } });
    c.add("queue", "visual", "review-queue", 560, 270, { label: "Proposal queue", config: { title: "Proposals awaiting review", states: "Draft, Validated, Revise, Approved, Rejected" } });
    c.add("decisionPanel", "visual", "decision-panel", 820, 270, { label: "Human apply gate", config: { title: "Human decision", actions: "Apply reviewed proposal, Ask for revision, Reject" } });
    c.add("evidencePanel", "visual", "evidence-panel", 1080, 270, { label: "Evidence beside the change", config: { title: "Actual evidence", fields: "test, observed result, status, unresolved boundary" } });
    c.add("learningPanel", "visual", "learning-panel", 1340, 270, { label: "Learning return", config: { title: "What the evidence taught", fields: "observation, evidence, lesson, next attempt" } });
    c.add("landmark", "visual", "agent-landmark", 820, 500, { label: "Review workspace landmark", config: { landmark: "Proposal review workspace", role: "region", description: "Contains the proposal, impact, evidence and human decision" } });
    c.add("tabs", "visual", "tabs", 1080, 500, { label: "Shared review views", config: { tabs: "Observe, Protocol, Proposal, Impact, Evidence, Learning" } });
    c.edge("visual", "screen", "heading"); c.edge("visual", "heading", "task"); c.edge("visual", "task", "queue"); c.edge("visual", "queue", "decisionPanel"); c.edge("visual", "decisionPanel", "evidencePanel"); c.edge("visual", "evidencePanel", "learningPanel"); c.edge("visual", "decisionPanel", "landmark"); c.edge("visual", "landmark", "tabs");

    c.bind("observe", "workspace", "reads through"); c.bind("hypothesis", "context", "uses bounded context from"); c.bind("ask", "decisionPanel", "surfaces question in"); c.bind("proposal", "proposalCheck", "is validated by"); c.bind("proposal", "queue", "appears in"); c.bind("decision", "decisionPanel", "is controlled in"); c.bind("evidence", "diagnostics", "requests proof from"); c.bind("evidence", "evidencePanel", "records result in"); c.bind("reflect", "journal", "writes reviewed learning to"); c.bind("reflect", "learningPanel", "displays in"); c.bind("access", "landmark", "makes discoverable"); c.bind("proof", "export", "permits portable return through");
    return finishTemplate(c, { taskStatus: { type: "string", default: "observe" }, proposalStatus: { type: "string", default: "none" }, humanDecision: { type: "string", default: "pending" }, evidenceStatus: { type: "string", default: "not-run" }, learningNotes: { type: "array", default: [] } });
  }

  function cartoonWorldTemplate() {
    const c = templateBuilder("cartoon-world", "Cartoon world quest", "game", "A colorful playable forest quest with layered scenery, characters, physics rules and an optional external-engine handoff.", "#7ddd9e");
    c.project.spine.goal.statement = "Explore a readable cartoon world and collect five star seeds before the lantern fades.";
    c.project.spine.goal.successMeasure = "Keyboard, touch and collision routes work; the player can collect five star seeds and receive visible completion feedback.";

    c.add("start", "logic", "start-event", 60, 100, { label: "Quest begins", config: { trigger: "Mission starts" } });
    c.add("timer", "logic", "timer", 320, 100, { label: "Lantern timer", config: { duration: 75, mode: "Countdown" } });
    c.add("random", "logic", "random", 580, 100, { label: "Seed locations", config: { outcomes: "grove, bridge, village, riverbank", mode: "Per session" } });
    c.add("event", "logic", "event", 580, 320, { label: "Star seed found", config: { eventName: "Player collects star seed" } });
    c.add("counter", "logic", "counter", 840, 100, { label: "Seeds gathered", config: { key: "seeds", start: 0, step: 1 } });
    c.add("condition", "logic", "condition", 1100, 100, { label: "Grove restored?", config: { expression: "seeds >= 5" } });
    c.add("action", "logic", "action", 1360, 100, { label: "Light the grove", config: { action: "Celebrate and unlock the village path" } });
    c.add("proof", "logic", "validator", 1360, 320, { label: "Quest proof", config: { check: "seeds === 5 and completion feedback visible", onFail: "Stop and report" } });
    c.edge("logic", "start", "timer"); c.edge("logic", "timer", "random"); c.edge("logic", "random", "counter"); c.edge("logic", "event", "counter"); c.edge("logic", "counter", "condition"); c.edge("logic", "condition", "action"); c.edge("logic", "action", "proof");

    c.add("scenery", "capabilities", "scenery-factory", 70, 130, { label: "Forest scenery kit", config: { style: "Warm cartoon", biome: "Enchanted forest", layers: "terrain, water, paths, structures, nature, props, atmosphere" } });
    c.add("physics", "capabilities", "physics-adapter", 350, 130, { label: "Quest physics", config: { preset: "Top-down casual", gravity: "none", collisions: "trees, water and village structures" } });
    c.add("assets", "capabilities", "asset-library", 630, 130, { label: "Local world assets", config: { collection: "Cartoon forest kit" } });
    c.add("a11y", "capabilities", "accessibility-audit", 910, 130, { label: "Input and motion check", config: { level: "Keyboard first", reducedMotion: true } });
    c.add("diagnostics", "capabilities", "diagnostics", 1190, 130, { label: "Quest diagnostics", config: { level: "Strict" } });
    c.add("engine", "capabilities", "engine-dock", 1470, 130, { label: "Optional Unreal handoff", enabled: false, config: { engine: "Unreal Engine", mode: "Handoff only", adapter: "AXM External Engine Dock v0.1.0" } });
    c.edge("capabilities", "scenery", "physics"); c.edge("capabilities", "physics", "assets"); c.edge("capabilities", "assets", "a11y"); c.edge("capabilities", "a11y", "diagnostics"); c.edge("capabilities", "diagnostics", "engine");

    c.add("scene", "visual", "game-scene", 50, 90, { label: "Moonleaf Grove", config: { camera: "Top down", world: "Moonleaf Grove" } });
    c.add("map", "visual", "world-map", 310, 90, { label: "Forest regions", config: { biome: "Enchanted forest", regions: "village, moon grove, river bridge, lantern meadow", pathStyle: "organic" } });
    c.add("terrain", "visual", "tile-layer", 570, 70, { label: "Ground and river", config: { layer: "terrain", order: 0, density: "rich" } });
    c.add("nature", "visual", "tile-layer", 570, 250, { label: "Trees and flowers", config: { layer: "nature", order: 3, density: "rich" } });
    const playerNode = c.add("player", "visual", "player-sprite", 840, 90, { label: "Milo the Keeper", config: { name: "Milo", role: "Player keeper", color: "#74d9ff", movementSpeed: 2.2, inputStyle: "Keyboard + touch", canMove: true, canSpeak: false } });
    playerNode.influence.visualStates.idle = { assetRef: "", color: "#74d9ff", notes: "Milo's normal resting look.", updatedAt: now() };
    playerNode.influence.visualStates.walking = { assetRef: "", color: "#8ae4ff", notes: "A brighter motion state used while the player moves.", updatedAt: now() };
    const npcNode = c.add("npc", "visual", "npc", 840, 290, { label: "Luma the Guide", config: { name: "Luma", role: "Explains the lantern quest", color: "#ff9889", movementSpeed: 0, dialogueStyle: "Warm and clear", knowledgeBoundary: "Only knows the visible Moonleaf Grove quest and its safety instructions.", canMove: false, canSpeak: true, canChangeSharedState: false } });
    npcNode.influence.rules.push(
      createInfluenceRule("player_nearby", "say_message", "Welcome, Milo. Five star seeds will relight the grove.", "A visible local greeting when the player comes near Luma."),
      createInfluenceRule("player_nearby", "change_visual_state", "talking", "Show that Luma is speaking."),
      createInfluenceRule("task_completed", "say_message", "You restored the grove. The village path is open.", "Completion feedback remains tied to the visible quest result."),
      createInfluenceRule("task_completed", "change_visual_state", "celebrating", "Use the celebration state only after completion.")
    );
    npcNode.influence.visualStates.idle = { assetRef: "", color: "#ff9889", notes: "Luma waiting beside the village path.", updatedAt: now() };
    npcNode.influence.visualStates.talking = { assetRef: "", color: "#ffb39f", notes: "Luma speaking with a warm, readable expression.", updatedAt: now() };
    npcNode.influence.visualStates.celebrating = { assetRef: "", color: "#ffe36e", notes: "Luma celebrating after the grove is visibly restored.", updatedAt: now() };
    const seedNode = c.add("seed", "visual", "world-object", 1110, 90, { label: "Star seed", config: { name: "Star seed", interaction: "Collect" } });
    seedNode.influence.rules.push(
      createInfluenceRule("collected", "show_message", "Star seed gathered.", "Give immediate visible feedback without hidden execution."),
      createInfluenceRule("collected", "change_visual_state", "collected", "The placed object can change only its own visual state.")
    );
    seedNode.influence.visualStates.idle = { assetRef: "", color: "#ffe36e", notes: "Visible collectible state.", updatedAt: now() };
    seedNode.influence.visualStates.collected = { assetRef: "", color: "#fff4b2", notes: "Brief collection flash before the object leaves the scene.", updatedAt: now() };
    c.add("camera", "visual", "camera", 1110, 290, { label: "Soft follow camera", config: { mode: "Soft follow", zoom: 1, bounds: "Moonleaf Grove" } });
    c.add("hud", "visual", "hud", 1380, 90, { label: "Lantern HUD", config: { title: "Moonleaf Quest", fields: "seeds, lantern time, grove status" } });
    c.add("effect", "visual", "effect", 1380, 290, { label: "Grove bloom", config: { effect: "Celebrate", duration: 1200 } });
    c.edge("visual", "scene", "map"); c.edge("visual", "map", "terrain"); c.edge("visual", "terrain", "nature"); c.edge("visual", "map", "player"); c.edge("visual", "map", "npc"); c.edge("visual", "map", "seed"); c.edge("visual", "player", "camera"); c.edge("visual", "camera", "hud"); c.edge("visual", "hud", "effect");

    c.bind("start", "scene", "opens"); c.bind("timer", "hud", "displays in"); c.bind("random", "map", "places within"); c.bind("event", "seed", "listens to"); c.bind("counter", "hud", "updates"); c.bind("condition", "effect", "triggers"); c.bind("scenery", "terrain", "generates palette for"); c.bind("scenery", "nature", "generates palette for"); c.bind("physics", "player", "constrains movement for"); c.bind("assets", "map", "supplies local visuals"); c.bind("diagnostics", "scene", "validates"); c.bind("engine", "map", "exports optional handoff for");
    return finishTemplate(c, { seeds: { type: "number", default: 0 }, lanternTime: { type: "number", default: 75 }, groveStatus: { type: "string", default: "waiting" }, playerRegion: { type: "string", default: "village" } });
  }

  const TEMPLATES = [
    { id: "blank", name: "Blank project", kicker: "Start with source truth", description: "An empty project with the shared spine, invariants and export path already in place.", target: "website", rgb: "125, 159, 177", blocks: "0 blocks", build: blankTemplate },
    { id: "website", name: "Open invitation", kicker: "Interactive website", description: "A polished public-facing page with a visible action route and local state.", target: "website", rgb: "68, 215, 202", blocks: "15 blocks", build: websiteTemplate },
    { id: "dashboard", name: "Stewardship board", kicker: "Local app", description: "A metric dashboard with bounded state input, proof checks and evidence display.", target: "dashboard", rgb: "156, 124, 255", blocks: "16 blocks", build: dashboardTemplate },
    { id: "game", name: "Parcel run", kicker: "Playable mini-game", description: "A working top-down collection mission with controls, timer, state and rewards.", target: "game", rgb: "255, 184, 92", blocks: "17 blocks", build: gameTemplate },
    { id: "hands-loop", name: "Human + AI build loop", kicker: "Hands workflow", description: "Scout, Builder, Tester, Repair and Nugget with proof and human apply gates.", target: "dashboard", rgb: "116, 185, 255", blocks: "21 blocks", build: handsTemplate },
    { id: "young-ai-workshop", name: "Young AI learning workshop", kicker: "Shared builder seat", description: "Observe, propose, human review, proof and evidence-linked learning on one shared project spine.", target: "dashboard", rgb: "190, 119, 255", blocks: "27 blocks", build: youngAiWorkshopTemplate },
    { id: "cartoon-world", name: "Cartoon world quest", kicker: "Layered game world", description: "A playable enchanted-forest quest with scenery, physics and an optional engine handoff.", target: "game", rgb: "125, 221, 158", blocks: "24 blocks", build: cartoonWorldTemplate }
  ];

  function getTemplate(id) {
    return TEMPLATES.find(function (template) { return template.id === id; }) || TEMPLATES[0];
  }

  function findNode(project, id) {
    let result = null;
    Object.keys(LAYERS).some(function (layer) {
      result = project.layers[layer].nodes.find(function (node) { return node.id === id; }) || null;
      return Boolean(result);
    });
    return result;
  }

  function nodeLayer(project, id) {
    return Object.keys(LAYERS).find(function (layer) {
      return project.layers[layer].nodes.some(function (node) { return node.id === id; });
    }) || null;
  }

  function allNodes(project) {
    return Object.keys(LAYERS).reduce(function (list, layer) {
      return list.concat(project.layers[layer].nodes);
    }, []);
  }

  function bindingCount(project, nodeId) {
    return project.bindings.filter(function (binding) {
      return binding.source === nodeId || binding.target === nodeId;
    }).length;
  }

  function slugify(value) {
    return String(value || "axm-project")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "axm-project";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#44d7ca";
  }

  const CONTRACT_ONLY_CAPABILITIES = new Set(["phone-controls", "local-multiplayer", "ai-collaborator", "mirror-adapter", "media-render", "hand-router", "engine-dock", "lan-sync"]);

  function validateProject(project) {
    const checks = [];
    function add(level, title, detail, layer, code) {
      checks.push({ id: uid("check"), level: level, title: title, detail: detail, layer: layer || "project", code: code || "general" });
    }

    if (!project || project.schema !== SCHEMA) {
      add("error", "Project schema is missing", "The source does not identify itself as an AXM Shapeable project.", "project", "schema");
      return { score: 0, checks: checks, errors: 1, warnings: 0, passes: 0, blocked: true };
    } else {
      add("pass", "Project schema recognized", SCHEMA + " v" + project.schemaVersion, "project", "schema");
    }

    if (!String(project.name || "").trim()) {
      add("error", "Project needs a name", "Give the source truth a human-readable name before building.", "project", "name");
    } else {
      add("pass", "Project identity is explicit", project.name, "project", "name");
    }

    if (!TARGETS[project.target]) {
      add("error", "Unknown build target", "Choose a supported browser target in the project spine.", "project", "target");
    } else {
      add("pass", "Build target is declared", TARGETS[project.target].label, "project", "target");
    }

    const goal = project.spine && project.spine.goal;
    if (!goal || !String(goal.statement || "").trim()) {
      add("warning", "Project goal is not stated", "Use the Goal Builder to record what this project should change for a person.", "spine", "goal");
    } else if (!String(goal.successMeasure || "").trim()) {
      add("warning", "Goal needs a success measure", "Add observable evidence that will show when the goal is met.", "spine", "goal");
    } else {
      add("pass", "Goal and proof are explicit", String(goal.statement).slice(0, 180), "spine", "goal");
    }

    const collaboration = project.spine && project.spine.collaboration;
    if (!collaboration) {
      add("warning", "Young AI collaboration policy is missing", "Add an explicit human-led, propose-only policy before sharing project context with an AI seat.", "spine", "collaboration-policy");
    } else {
      const unsafe = [];
      if (collaboration.mode !== "HUMAN_LED") unsafe.push("mode must remain HUMAN_LED");
      if (collaboration.youngAiSeat !== "PROPOSE_ONLY") unsafe.push("the young AI seat must remain PROPOSE_ONLY");
      if (collaboration.humanApplyRequired !== true) unsafe.push("human apply review is required");
      if (collaboration.permissionChanges !== "HUMAN_ONLY") unsafe.push("permission changes must remain human-only");
      if (collaboration.canonChanges !== "HUMAN_ONLY") unsafe.push("canon changes must remain human-only");
      if (collaboration.destructiveProjectActions !== "HUMAN_ONLY") unsafe.push("destructive project actions must remain human-only");
      if (collaboration.hiddenExecution !== "BLOCKED") unsafe.push("hidden execution must remain blocked");
      if (unsafe.length) {
        add("error", "Young AI authority boundary is unsafe", unsafe.join("; ") + ".", "spine", "collaboration-policy");
      } else {
        add("pass", "Young AI seat is human-led", "Observation and proposals are available; apply, permissions, destructive project actions and canon remain human-controlled.", "spine", "collaboration-policy");
      }
      const reviewCount = Array.isArray(collaboration.reviewLog) ? collaboration.reviewLog.length : 0;
      if (reviewCount) add("pass", "AI review trail is visible", reviewCount + " reviewed proposal" + (reviewCount === 1 ? "" : "s") + " recorded in project source.", "spine", "collaboration-review");
    }

    const nodes = allNodes(project);
    const ids = new Set();
    const duplicates = [];
    nodes.forEach(function (node) {
      if (ids.has(node.id)) duplicates.push(node.id);
      ids.add(node.id);
    });
    if (duplicates.length) {
      add("error", "Duplicate block identities", duplicates.length + " duplicate IDs would make routes ambiguous.", "project", "identity");
    } else if (nodes.length) {
      add("pass", "Block identities are unique", nodes.length + " blocks checked.", "project", "identity");
    }

    if (!nodes.length) {
      add("error", "The project is still empty", "Choose a template or add blocks to at least one layer.", "project", "empty");
    }

    let influenceRuleCount = 0;
    let visualStateCount = 0;
    let codeHookCount = 0;

    Object.keys(LAYERS).forEach(function (layer) {
      const layerData = project.layers[layer] || { nodes: [], edges: [] };
      const layerIds = new Set(layerData.nodes.map(function (node) { return node.id; }));
      layerData.edges.forEach(function (edge) {
        if (!layerIds.has(edge.from) || !layerIds.has(edge.to)) {
          add("error", "Broken route endpoint", "A " + LAYERS[layer].label.toLowerCase() + " connection points to a missing block.", layer, "edge");
        }
        if (edge.from === edge.to) {
          add("warning", "Self-referencing route", "A block is connected to itself. Confirm that this loop is intentional.", layer, "edge");
        }
      });

      const connected = new Set();
      layerData.edges.forEach(function (edge) { connected.add(edge.from); connected.add(edge.to); });
      const isolated = layerData.nodes.filter(function (node) { return node.enabled !== false && !connected.has(node.id); });
      if (layerData.nodes.length > 1 && isolated.length) {
        add("warning", "Unconnected " + LAYERS[layer].label.toLowerCase() + " blocks", isolated.length + " enabled block" + (isolated.length === 1 ? " is" : "s are") + " not part of a route.", layer, "isolated");
      } else if (layerData.nodes.length > 1) {
        add("pass", LAYERS[layer].label + " routes are connected", layerData.edges.length + " visible connections checked.", layer, "connected");
      }

      layerData.nodes.forEach(function (node) {
        const definition = getDefinition(layer, node.type);
        if (!BLOCK_MAP[layer + ":" + node.type]) {
          add("warning", "Unknown block preserved", '“' + node.label + '” remains untouched but needs a compatible adapter.', layer, "unknown");
        }
        if (node.enabled !== false && definition.targets && !definition.targets.includes(project.target)) {
          add("error", "Block is incompatible with this target", '“' + node.label + '” does not support ' + (TARGETS[project.target] ? TARGETS[project.target].label : project.target) + ".", layer, "compatibility");
        }
        if (layer === "capabilities" && node.enabled !== false && definition.permission && (!node.permission || !node.permission.approved)) {
          add("error", "Capability consent required", 'Review “' + node.label + '” before it can enter a build.', layer, "permission");
        }
        if (layer === "capabilities" && node.enabled !== false && CONTRACT_ONLY_CAPABILITIES.has(node.type)) {
          add("warning", "Adapter remains contract-only in beta", '“' + node.label + '” is modeled and validated, but the standalone HTML exporter does not activate its external runtime.', layer, "contract-only");
        }

        const profile = getInfluenceProfile(layer, node.type);
        const influence = node.influence && typeof node.influence === "object" && !Array.isArray(node.influence) ? node.influence : defaultInfluence(layer, node.type);
        const rules = Array.isArray(influence.rules) ? influence.rules : [];
        const states = influence.visualStates && typeof influence.visualStates === "object" && !Array.isArray(influence.visualStates) ? influence.visualStates : {};
        const hooks = Array.isArray(influence.codeHooks) ? influence.codeHooks : [];
        influenceRuleCount += rules.length;
        visualStateCount += Object.keys(states).filter(function (stateId) {
          const state = states[stateId] || {};
          return Boolean(String(state.assetRef || "").trim() || String(state.color || "").trim() || String(state.notes || "").trim());
        }).length;
        codeHookCount += hooks.length;
        if (influence.moduleId && influence.moduleId !== profile.id) {
          add("warning", "Block influence module is out of sync", '“' + node.label + '” declares ' + influence.moduleId + " but this block uses the " + profile.label + " module. Re-open and save the project to normalize the contract.", layer, "influence-module");
        }
        if (rules.length > MAX_INFLUENCE_RULES) add("error", "Too many reactions on one block", '“' + node.label + '” has more than ' + MAX_INFLUENCE_RULES + " guided reactions.", layer, "influence-rule");
        const ruleIds = new Set();
        rules.forEach(function (rule) {
          const ruleId = String(rule && rule.id || "");
          if (!ruleId || ruleIds.has(ruleId)) add("error", "Reaction identity is ambiguous", '“' + node.label + '” has a missing or duplicate reaction id.', layer, "influence-rule");
          ruleIds.add(ruleId);
          const trigger = influenceOption(profile.triggers, rule && rule.trigger);
          const action = influenceOption(profile.actions, rule && rule.action);
          if (!trigger) add("warning", "Reaction uses an unknown moment", '“' + node.label + '” keeps the imported moment “' + String(rule && rule.trigger || "missing") + '”, but this module cannot preview it yet.', layer, "influence-rule");
          if (!action) add("warning", "Reaction uses an unknown action", '“' + node.label + '” keeps the imported action “' + String(rule && rule.action || "missing") + '”, but this module cannot preview it yet.', layer, "influence-rule");
          if (action && action.needsValue && !String(rule && rule.value || "").trim()) add("warning", "Reaction needs a detail", '“' + node.label + '” has a “' + action.label + '” reaction without its ' + action.valueLabel.toLowerCase() + ".", layer, "influence-rule");
        });
        const knownStates = new Set((profile.visualStates || []).map(function (slot) { return slot.id; }));
        Object.keys(states).forEach(function (stateId) {
          if (!knownStates.has(stateId)) add("warning", "Visual state is not declared by this module", '“' + node.label + '” preserves the imported state “' + stateId + '”, but the ' + profile.label + " module does not advertise it.", layer, "visual-state");
        });
        if (hooks.length > MAX_CODE_HOOKS) add("error", "Too many code hook drafts", '“' + node.label + '” has more than ' + MAX_CODE_HOOKS + " advanced hook drafts.", layer, "code-hook");
        const hookIds = new Set();
        hooks.forEach(function (hook) {
          const hookId = String(hook && hook.id || "");
          if (!hookId || hookIds.has(hookId)) add("error", "Code hook identity is ambiguous", '“' + node.label + '” has a missing or duplicate advanced hook id.', layer, "code-hook");
          hookIds.add(hookId);
        });
      });
    });

    if (influenceRuleCount || visualStateCount) {
      add("pass", "Per-block influence is explicit", influenceRuleCount + " guided reaction" + (influenceRuleCount === 1 ? "" : "s") + " and " + visualStateCount + " configured visual state" + (visualStateCount === 1 ? "" : "s") + " travel with their exact placed blocks.", "spine", "influence");
    }
    if (codeHookCount) {
      add("warning", "Advanced code hooks remain contract-only", codeHookCount + " hook draft" + (codeHookCount === 1 ? " is" : "s are") + " saved transparently but not executed by this browser beta.", "spine", "code-hook");
    }

    const logicNodes = project.layers.logic.nodes.filter(function (node) { return node.enabled !== false; });
    if (logicNodes.length && !logicNodes.some(function (node) { return node.type === "start-event" || node.type === "event"; })) {
      add("warning", "No visible logic entry point", "Add a Start event or Event so the project route has an explicit beginning.", "logic", "entry");
    } else if (logicNodes.length) {
      add("pass", "Logic entry point found", "The project has a visible trigger.", "logic", "entry");
    }

    const visualNodes = project.layers.visual.nodes.filter(function (node) { return node.enabled !== false; });
    const needsGameScene = project.target === "game";
    const hasRoot = visualNodes.some(function (node) { return needsGameScene ? node.type === "game-scene" : node.type === "screen"; });
    if (!hasRoot) {
      add("error", needsGameScene ? "Game scene is missing" : "Screen root is missing", needsGameScene ? "Add a Game scene to host the playable world." : "Add an App screen to host the visible experience.", "visual", "visual-root");
    } else {
      add("pass", "Visual root is present", needsGameScene ? "Playable scene found." : "Responsive screen found.", "visual", "visual-root");
    }

    project.bindings.forEach(function (binding) {
      const sourceLayer = nodeLayer(project, binding.source);
      const targetLayer = nodeLayer(project, binding.target);
      if (!sourceLayer || !targetLayer) {
        add("error", "Broken cross-layer binding", "A shared-spine binding points to a missing block.", "spine", "binding");
      } else if (sourceLayer === targetLayer) {
        add("warning", "Binding stays inside one layer", "Use a route connection for same-layer flow; bindings are intended to cross layers.", "spine", "binding");
      }
    });
    if (project.bindings.length) {
      add("pass", "Cross-layer contract is explicit", project.bindings.length + " binding" + (project.bindings.length === 1 ? "" : "s") + " recorded in the shared spine.", "spine", "binding");
    } else if (nodes.length) {
      add("warning", "Layers are not bound yet", "Connect at least one visual block to logic or capability state.", "spine", "binding");
    }

    if (!project.spine || !Array.isArray(project.spine.invariants) || !project.spine.invariants.length) {
      add("warning", "No skeleton invariants", "Record at least one rule that future changes must preserve.", "spine", "invariant");
    } else {
      add("pass", "Skeleton rules are preserved", project.spine.invariants.length + " invariant" + (project.spine.invariants.length === 1 ? "" : "s") + " travel with the source.", "spine", "invariant");
    }

    if (!Array.isArray(project.ledger) || !project.ledger.length) {
      add("warning", "Change ledger is empty", "Future changes would lose their visible trail.", "spine", "ledger");
    } else {
      add("pass", "Change trail is present", project.ledger.length + " source event" + (project.ledger.length === 1 ? "" : "s") + " recorded.", "spine", "ledger");
    }

    const errors = checks.filter(function (check) { return check.level === "error"; }).length;
    const warnings = checks.filter(function (check) { return check.level === "warning"; }).length;
    const passes = checks.filter(function (check) { return check.level === "pass"; }).length;
    let score = Math.max(0, Math.min(100, 100 - errors * 17 - warnings * 4));
    if (!nodes.length) score = Math.min(score, 18);
    return { score: score, checks: checks, errors: errors, warnings: warnings, passes: passes, blocked: errors > 0 };
  }

  function normalizeProject(payload, options) {
    options = options || {};
    if (!payload || typeof payload !== "object" || payload.schema !== SCHEMA) {
      throw new Error("This file is not an AXM Shapeable project source.");
    }
    if (Number(payload.schemaVersion) > SCHEMA_VERSION) {
      throw new Error("This project uses a newer schema version. It was not imported or rewritten.");
    }
    const project = clone(payload);
    project.schemaVersion = Number(project.schemaVersion) || SCHEMA_VERSION;
    project.id = String(project.id || uid("project"));
    project.name = String(project.name || "Imported project").slice(0, 160);
    project.description = String(project.description || "").slice(0, 2000);
    project.target = TARGETS[project.target] ? project.target : "custom";
    project.accent = safeColor(project.accent);
    project.meta = Object.assign({
      templateId: "imported",
      templateName: "Imported project",
      createdAt: now(),
      updatedAt: now(),
      builderVersion: APP_VERSION,
      sourceMode: "local-first",
      canonStatus: "EXPERIMENTAL BETA"
    }, project.meta || {});
    project.layers = project.layers || {};
    Object.keys(LAYERS).forEach(function (layer) {
      const source = project.layers[layer] || {};
      const nodes = Array.isArray(source.nodes) ? source.nodes : [];
      const edges = Array.isArray(source.edges) ? source.edges : [];
      project.layers[layer] = {
        nodes: nodes.map(function (sourceNode) {
          const node = Object.assign(createNode(layer, String(sourceNode.type || "unknown"), 120, 120), clone(sourceNode));
          node.id = String(sourceNode.id || uid("node"));
          node.layer = layer;
          node.type = String(sourceNode.type || "unknown");
          node.label = String(sourceNode.label || getDefinition(layer, node.type).label).slice(0, 200);
          node.summary = String(sourceNode.summary || "").slice(0, 2000);
          node.x = Math.max(0, Math.min(1500, Number(sourceNode.x) || 0));
          node.y = Math.max(0, Math.min(930, Number(sourceNode.y) || 0));
          node.config = sourceNode.config && typeof sourceNode.config === "object" ? clone(sourceNode.config) : {};
          node.influence = normalizeInfluence(sourceNode.influence, layer, node.type);
          node.provenance = Object.assign({}, node.provenance, sourceNode.provenance || {}, { imported: true });
          return node;
        }),
        edges: edges.map(function (edge) {
          return { id: String(edge.id || uid("edge")), from: String(edge.from || ""), to: String(edge.to || ""), label: String(edge.label || "flow").slice(0, 100), createdAt: edge.createdAt || now() };
        })
      };
    });
    project.bindings = Array.isArray(project.bindings) ? project.bindings.map(function (binding) {
      return { id: String(binding.id || uid("binding")), source: String(binding.source || ""), target: String(binding.target || ""), purpose: String(binding.purpose || "contract").slice(0, 160), createdAt: binding.createdAt || now() };
    }) : [];
    project.spine = Object.assign({ goal: {}, stateSchema: {}, invariants: [], compatibility: {}, collaboration: defaultCollaborationPolicy(), provenance: {} }, project.spine || {});
    project.spine.goal = Object.assign({ statement: "", successMeasure: "", status: "WORKING" }, project.spine.goal || {});
    project.spine.goal.statement = String(project.spine.goal.statement || "").slice(0, 2000);
    project.spine.goal.successMeasure = String(project.spine.goal.successMeasure || "").slice(0, 2000);
    project.spine.goal.status = ["WORKING", "READY FOR REVIEW", "PROVEN", "PAUSED"].includes(project.spine.goal.status) ? project.spine.goal.status : "WORKING";
    project.spine.stateSchema = project.spine.stateSchema && typeof project.spine.stateSchema === "object" ? project.spine.stateSchema : {};
    project.spine.invariants = Array.isArray(project.spine.invariants) ? project.spine.invariants.map(function (item) { return String(item).slice(0, 1000); }) : [];
    project.spine.collaboration = Object.assign(defaultCollaborationPolicy(), project.spine.collaboration && typeof project.spine.collaboration === "object" ? project.spine.collaboration : {});
    project.spine.collaboration.mode = String(project.spine.collaboration.mode || "HUMAN_LED").slice(0, 80);
    project.spine.collaboration.youngAiSeat = String(project.spine.collaboration.youngAiSeat || "PROPOSE_ONLY").slice(0, 80);
    project.spine.collaboration.permissionChanges = String(project.spine.collaboration.permissionChanges || "HUMAN_ONLY").slice(0, 80);
    project.spine.collaboration.canonChanges = String(project.spine.collaboration.canonChanges || "HUMAN_ONLY").slice(0, 80);
    project.spine.collaboration.destructiveProjectActions = String(project.spine.collaboration.destructiveProjectActions || "HUMAN_ONLY").slice(0, 80);
    project.spine.collaboration.hiddenExecution = String(project.spine.collaboration.hiddenExecution || "BLOCKED").slice(0, 80);
    project.spine.collaboration.humanApplyRequired = project.spine.collaboration.humanApplyRequired !== false;
    project.spine.collaboration.maxActionsPerProposal = Math.max(1, Math.min(60, Number(project.spine.collaboration.maxActionsPerProposal) || 60));
    project.spine.collaboration.reviewLog = Array.isArray(project.spine.collaboration.reviewLog) ? project.spine.collaboration.reviewLog.slice(-30).map(function (entry) {
      return {
        id: String(entry && entry.id || uid("review")),
        proposalId: String(entry && entry.proposalId || "unknown").slice(0, 160),
        title: String(entry && entry.title || "Reviewed proposal").slice(0, 240),
        reviewedAt: entry && entry.reviewedAt || now(),
        actionCount: Math.max(0, Math.min(60, Number(entry && entry.actionCount) || 0)),
        decision: String(entry && entry.decision || "HUMAN_APPROVED").slice(0, 80),
        diagnosticsBefore: Number(entry && entry.diagnosticsBefore) || 0,
        diagnosticsAfter: Number(entry && entry.diagnosticsAfter) || 0
      };
    }) : [];
    project.ledger = Array.isArray(project.ledger) ? project.ledger.slice(-500) : [];
    if (options.recordImport !== false) {
      project.ledger.push({ id: uid("event"), at: now(), actor: "human", type: "project.imported", message: "Imported project after schema validation", layer: null });
    }
    project.meta.updatedAt = now();
    return project;
  }

  function compactNodeContract(node) {
    return {
      id: node.id,
      layer: node.layer,
      type: node.type,
      label: node.label,
      enabled: node.enabled !== false,
      config: clone(node.config || {}),
      influence: normalizeInfluence(node.influence, node.layer, node.type),
      provenance: clone(node.provenance || {})
    };
  }


  const AGENT_WORKSPACE_SCHEMA = "axm.agent.workspace";
  const AGENT_PROPOSAL_SCHEMA = "axm.agent.proposal";
  const AGENT_PROPOSAL_VERSION = 1;
  const AGENT_ALLOWED_VERBS = [
    "set_project",
    "set_goal",
    "add_node",
    "update_node",
    "move_node",
    "connect",
    "remove_edge",
    "bind",
    "remove_binding",
    "set_state",
    "add_invariant",
    "add_influence_rule",
    "update_influence_rule",
    "remove_influence_rule",
    "set_visual_state",
    "set_code_hook",
    "remove_code_hook"
  ];
  const AGENT_FORBIDDEN_AUTHORITY = [
    "approve or revoke a capability permission",
    "change canon or merge status",
    "delete, trash or restore a project",
    "empty recoverable trash",
    "overwrite checkpoints or imported source",
    "publish, host, contact a provider or make a network request",
    "execute external commands or an external engine",
    "activate or secretly execute a per-block code hook",
    "hide an action, test result, uncertainty or source change"
  ];

  function plainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function safeAgentKey(value) {
    const key = String(value || "");
    return /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key) && !["__proto__", "prototype", "constructor"].includes(key);
  }

  function collaborationPolicySafe(project) {
    const policy = project && project.spine && project.spine.collaboration;
    return Boolean(policy && policy.mode === "HUMAN_LED" && policy.youngAiSeat === "PROPOSE_ONLY" && policy.humanApplyRequired === true && policy.permissionChanges === "HUMAN_ONLY" && policy.canonChanges === "HUMAN_ONLY" && policy.destructiveProjectActions === "HUMAN_ONLY" && policy.hiddenExecution === "BLOCKED");
  }

  function agentActionProtocol() {
    return {
      schema: AGENT_PROPOSAL_SCHEMA,
      schemaVersion: AGENT_PROPOSAL_VERSION,
      referenceRule: "Use an existing node id, or @alias after an add_node action declares that alias earlier in the same proposal.",
      requiredPerAction: ["id", "verb", "why"],
      verbs: [
        { verb: "set_project", purpose: "Change bounded project identity fields.", accepts: { fields: ["name", "description", "target", "accent"] } },
        { verb: "set_goal", purpose: "Change the human outcome, proof statement or working status.", accepts: { fields: ["statement", "successMeasure", "status"] } },
        { verb: "add_node", purpose: "Add one known block. Capability permission always starts unapproved.", accepts: { fields: ["alias", "layer", "type", "label", "summary", "x", "y", "enabled", "config"] } },
        { verb: "update_node", purpose: "Change the label, purpose, enabled state or declared config fields of one block.", accepts: { fields: ["node", "label", "summary", "enabled", "config"] } },
        { verb: "move_node", purpose: "Move one block on its existing canvas.", accepts: { fields: ["node", "x", "y"] } },
        { verb: "connect", purpose: "Create one same-layer route.", accepts: { fields: ["layer", "from", "to", "label"] } },
        { verb: "remove_edge", purpose: "Remove one named same-layer route after human review.", accepts: { fields: ["layer", "edgeId"] } },
        { verb: "bind", purpose: "Create one explicit cross-layer binding.", accepts: { fields: ["source", "target", "purpose"] } },
        { verb: "remove_binding", purpose: "Remove one named cross-layer binding after human review.", accepts: { fields: ["bindingId"] } },
        { verb: "set_state", purpose: "Add or update one declared shared-state key.", accepts: { fields: ["key", "valueType", "default"] } },
        { verb: "add_invariant", purpose: "Add one rule future changes must preserve.", accepts: { fields: ["text"] } },
        { verb: "add_influence_rule", purpose: "Add one guided reaction to one exact placed block.", accepts: { fields: ["node", "trigger", "action", "value", "note", "enabled"] } },
        { verb: "update_influence_rule", purpose: "Change one named guided reaction on one exact placed block.", accepts: { fields: ["node", "ruleId", "trigger", "action", "value", "note", "enabled"] } },
        { verb: "remove_influence_rule", purpose: "Remove one named guided reaction after human review.", accepts: { fields: ["node", "ruleId"] } },
        { verb: "set_visual_state", purpose: "Set the asset reference, color or notes for one module-declared visual state.", accepts: { fields: ["node", "state", "assetRef", "color", "notes"] } },
        { verb: "set_code_hook", purpose: "Add or update a transparent advanced hook draft. It remains disabled and contract-only.", accepts: { fields: ["node", "hookId", "hook", "label", "language", "code"] } },
        { verb: "remove_code_hook", purpose: "Remove one named advanced hook draft after human review.", accepts: { fields: ["node", "hookId"] } }
      ],
      forbiddenAuthority: AGENT_FORBIDDEN_AUTHORITY.slice(),
      applyBoundary: "A valid proposal is still only a candidate. The builder applies it only after a human reviews every action and confirms the apply gate."
    };
  }

  function agentNodeContract(node) {
    const definition = getDefinition(node.layer, node.type);
    return {
      id: node.id,
      layer: node.layer,
      type: node.type,
      label: node.label,
      summary: node.summary,
      enabled: node.enabled !== false,
      position: { x: node.x, y: node.y },
      input: definition.input !== false,
      output: definition.output !== false,
      config: clone(node.config || {}),
      influence: normalizeInfluence(node.influence, node.layer, node.type),
      influenceModule: clone(getInfluenceProfile(node.layer, node.type)),
      permission: node.permission ? { id: node.permission.id, approved: Boolean(node.permission.approved), humanControlled: true } : null,
      provenance: clone(node.provenance || {})
    };
  }

  function generateAgentWorkspace(project, selectedNodeId) {
    const validation = validateProject(project);
    const selected = selectedNodeId ? findNode(project, selectedNodeId) : null;
    const permissions = project.layers.capabilities.nodes.map(function (node) {
      const definition = getDefinition("capabilities", node.type);
      if (!definition.permission) return null;
      return {
        nodeId: node.id,
        label: node.label,
        permissionId: definition.permission.id,
        approved: Boolean(node.permission && node.permission.approved),
        control: "HUMAN_ONLY"
      };
    }).filter(Boolean);
    const catalog = [];
    Object.keys(LAYERS).forEach(function (layer) {
      BLOCKS[layer].forEach(function (block) {
        catalog.push({
          layer: layer,
          type: block.type,
          label: block.label,
          description: block.description,
          targets: clone(block.targets || ALL_TARGETS),
          input: block.input !== false,
          output: block.output !== false,
          permission: block.permission ? { id: block.permission.id, label: block.permission.label, humanControlled: true } : null,
          fields: clone(block.fields || []),
          influenceModule: clone(getInfluenceProfile(layer, block.type))
        });
      });
    });
    return {
      schema: AGENT_WORKSPACE_SCHEMA,
      schemaVersion: 1,
      createdAt: now(),
      source: {
        projectId: project.id,
        projectName: project.name,
        projectUpdatedAt: project.meta.updatedAt,
        builderVersion: APP_VERSION,
        target: project.target
      },
      seat: {
        name: "Young AI seat",
        meaning: "An early-stage AI working through guided, inspectable steps under creator oversight.",
        authority: "PROPOSE_ONLY",
        mayObserve: true,
        mayDraftBuilderActions: true,
        mayApply: false,
        mayGrantPermissions: false,
        mayChangeCanon: false,
        humanApplyRequired: true
      },
      collaborationPolicy: clone(project.spine.collaboration || defaultCollaborationPolicy()),
      task: {
        goal: clone(project.spine.goal || {}),
        invariants: clone(project.spine.invariants || []),
        selectedNode: selected ? agentNodeContract(selected) : null
      },
      observation: {
        project: { name: project.name, description: project.description, target: project.target, accent: project.accent },
        layers: Object.keys(LAYERS).reduce(function (result, layer) {
          result[layer] = {
            label: LAYERS[layer].label,
            description: LAYERS[layer].description,
            nodes: project.layers[layer].nodes.map(agentNodeContract),
            edges: clone(project.layers[layer].edges)
          };
          return result;
        }, {}),
        bindings: clone(project.bindings || []),
        stateSchema: clone(project.spine.stateSchema || {}),
        permissions: permissions,
        reviewLog: clone(project.spine.collaboration && project.spine.collaboration.reviewLog || []),
        recentLedger: clone((project.ledger || []).slice(-120)),
        diagnostics: {
          score: validation.score,
          errors: validation.errors,
          warnings: validation.warnings,
          blocked: validation.blocked,
          checks: validation.checks.map(function (check) { return { level: check.level, title: check.title, detail: check.detail, layer: check.layer, code: check.code }; })
        }
      },
      interface: {
        landmarks: [
          { id: "templateButton", label: "Starter templates", humanAction: "Choose a rooted starting shape" },
          { id: "projectVaultButton", label: "Project vault", humanAction: "Open, duplicate, checkpoint, trash or restore projects" },
          { id: "goalBuilderButton", label: "Goal builder", humanAction: "Set human outcome and observable proof" },
          { id: "spineMapButton", label: "Whole-project map", humanAction: "See every block and cross-layer binding" },
          { id: "aiWorkbenchButton", label: "Young AI workbench", humanAction: "Export observation, validate proposals and control apply" },
          { id: "inspectorPanel", label: "Selected block inspector", humanAction: "Edit this placed block's settings, guided reactions, visual states and transparent hook drafts" },
          { id: "testButton", label: "Diagnostics", humanAction: "Run source and build checks" },
          { id: "previewButton", label: "Preview", humanAction: "Render the current project" },
          { id: "buildButton", label: "Build and export", humanAction: "Choose what leaves the builder" }
        ],
        nodeSelector: "[data-axm-node-id]",
        blockCatalogSelector: "[data-axm-block-type]",
        note: "The visual interface and this packet describe the same canonical project spine."
      },
      blockCatalog: catalog,
      actionProtocol: agentActionProtocol(),
      proposalTemplate: agentProposalTemplate(project),
      disclosure: "This local packet does not contact an AI provider, execute a proposal, grant permission or change project source."
    };
  }

  function agentProposalTemplate(project) {
    return {
      schema: AGENT_PROPOSAL_SCHEMA,
      schemaVersion: AGENT_PROPOSAL_VERSION,
      proposalId: "proposal-" + slugify(project.name) + "-replace-me",
      source: {
        projectId: project.id,
        projectUpdatedAt: project.meta.updatedAt,
        builderVersion: APP_VERSION
      },
      title: "Replace with one bounded improvement",
      summary: "Explain the intended human-visible result and why this is the smallest coherent change.",
      assumptions: [],
      actions: [],
      tests: ["Name the exact changed path to test.", "Report the observed result rather than predicting success."],
      unresolvedRisks: []
    };
  }

  function normalizeAgentConfig(definition, config, path, errors) {
    if (config == null) return {};
    if (!plainObject(config)) {
      errors.push(path + " config must be an object.");
      return {};
    }
    const fields = new Map((definition.fields || []).map(function (field) { return [field.key, field]; }));
    const output = {};
    Object.keys(config).forEach(function (key) {
      if (!safeAgentKey(key)) {
        errors.push(path + " config key “" + key + "” is not safe.");
        return;
      }
      const field = fields.get(key);
      if (!field) {
        errors.push(path + " config key “" + key + "” is not declared by " + definition.label + ".");
        return;
      }
      const value = config[key];
      if (field.type === "checkbox") {
        if (typeof value !== "boolean") errors.push(path + " config “" + key + "” must be true or false.");
        else output[key] = value;
      } else if (field.type === "number") {
        if (!Number.isFinite(Number(value))) errors.push(path + " config “" + key + "” must be a finite number.");
        else {
          const number = Number(value);
          if (field.min != null && number < field.min) errors.push(path + " config “" + key + "” is below its minimum of " + field.min + ".");
          else if (field.max != null && number > field.max) errors.push(path + " config “" + key + "” exceeds its maximum of " + field.max + ".");
          else output[key] = number;
        }
      } else if (field.type === "select") {
        if (!(field.options || []).includes(String(value))) errors.push(path + " config “" + key + "” must be one of: " + (field.options || []).join(", ") + ".");
        else output[key] = String(value);
      } else {
        if (typeof value !== "string") errors.push(path + " config “" + key + "” must be text.");
        else output[key] = value.slice(0, field.type === "textarea" ? 4000 : 500);
      }
    });
    return output;
  }

  function agentNodeRef(project, aliases, value, path, errors) {
    const ref = String(value || "");
    if (!ref) {
      errors.push(path + " must name a node id or @alias.");
      return null;
    }
    const id = ref.startsWith("@") ? aliases[ref.slice(1)] : ref;
    if (!id) {
      errors.push(path + " references an unknown alias “" + ref + "”. Add it earlier in this proposal.");
      return null;
    }
    const node = findNode(project, id);
    if (!node) errors.push(path + " references a missing node “" + ref + "”.");
    return node || null;
  }

  function countProjectParts(project) {
    const nodes = allNodes(project);
    return {
      nodes: nodes.length,
      edges: Object.keys(LAYERS).reduce(function (count, layer) { return count + project.layers[layer].edges.length; }, 0),
      bindings: project.bindings.length,
      invariants: project.spine.invariants.length,
      stateKeys: Object.keys(project.spine.stateSchema || {}).length,
      influenceRules: nodes.reduce(function (count, node) { return count + (node.influence && Array.isArray(node.influence.rules) ? node.influence.rules.length : 0); }, 0),
      visualStates: nodes.reduce(function (count, node) {
        const states = node.influence && node.influence.visualStates && typeof node.influence.visualStates === "object" ? node.influence.visualStates : {};
        return count + Object.keys(states).filter(function (stateId) {
          const state = states[stateId] || {};
          return Boolean(String(state.assetRef || "").trim() || String(state.color || "").trim() || String(state.notes || "").trim());
        }).length;
      }, 0),
      codeHooks: nodes.reduce(function (count, node) { return count + (node.influence && Array.isArray(node.influence.codeHooks) ? node.influence.codeHooks.length : 0); }, 0)
    };
  }

  function validateAgentProposal(payload, project) {
    const errors = [];
    const warnings = [];
    const changes = [];
    if (!plainObject(payload)) return { valid: false, errors: ["Proposal source must be a JSON object."], warnings: [], changes: [], previewProject: null };
    if (payload.schema !== AGENT_PROPOSAL_SCHEMA) errors.push("Proposal schema must be " + AGENT_PROPOSAL_SCHEMA + ".");
    if (Number(payload.schemaVersion) !== AGENT_PROPOSAL_VERSION) errors.push("Only agent proposal schema version " + AGENT_PROPOSAL_VERSION + " is supported.");
    if (!collaborationPolicySafe(project)) errors.push("The active project does not have a safe HUMAN_LED / PROPOSE_ONLY collaboration policy.");
    const proposalId = String(payload.proposalId || "").trim();
    if (!proposalId || proposalId.length > 160) errors.push("proposalId is required and must be 160 characters or fewer.");
    const title = String(payload.title || "").trim();
    if (!title || title.length > 240) errors.push("Proposal title is required and must be 240 characters or fewer.");
    const source = plainObject(payload.source) ? payload.source : {};
    if (String(source.projectId || "") !== project.id) errors.push("Proposal source projectId does not match the active project.");
    if (!String(source.projectUpdatedAt || "")) errors.push("Proposal source must include projectUpdatedAt so stale proposals can be blocked.");
    else if (String(source.projectUpdatedAt) !== String(project.meta.updatedAt)) errors.push("Proposal source is stale. Export a fresh workspace packet and rebase the proposal before review.");
    if (source.builderVersion && String(source.builderVersion) !== APP_VERSION) warnings.push("Proposal was authored for builder " + source.builderVersion + "; active builder is " + APP_VERSION + ".");
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    const maxActions = Math.max(1, Math.min(60, Number(project.spine.collaboration.maxActionsPerProposal) || 60));
    if (!actions.length) errors.push("Proposal must contain at least one action.");
    if (actions.length > maxActions) errors.push("Proposal contains " + actions.length + " actions; this project allows at most " + maxActions + ".");
    const assumptions = Array.isArray(payload.assumptions) ? payload.assumptions.map(function (item) { return String(item).slice(0, 1000); }) : [];
    const tests = Array.isArray(payload.tests) ? payload.tests.map(function (item) { return String(item).slice(0, 1000); }).filter(Boolean) : [];
    const unresolvedRisks = Array.isArray(payload.unresolvedRisks) ? payload.unresolvedRisks.map(function (item) { return String(item).slice(0, 1000); }).filter(Boolean) : [];
    if (!tests.length) warnings.push("No test plan is declared. Applying a proposal never proves that it works.");
    const working = clone(project);
    const aliases = Object.create(null);
    const actionIds = new Set();
    const permissionBefore = new Map(project.layers.capabilities.nodes.filter(function (node) { return node.permission; }).map(function (node) { return [node.id, Boolean(node.permission.approved)]; }));

    actions.forEach(function (rawAction, index) {
      const path = "Action " + (index + 1);
      if (!plainObject(rawAction)) {
        errors.push(path + " must be an object.");
        return;
      }
      const actionId = String(rawAction.id || "").trim();
      const verb = String(rawAction.verb || "").trim();
      const why = String(rawAction.why || "").trim();
      if (!actionId || actionId.length > 120) errors.push(path + " needs a short id.");
      else if (actionIds.has(actionId)) errors.push(path + " reuses action id “" + actionId + "”.");
      actionIds.add(actionId);
      if (!AGENT_ALLOWED_VERBS.includes(verb)) {
        errors.push(path + " uses forbidden or unknown verb “" + verb + "”.");
        return;
      }
      if (!why) errors.push(path + " must explain why the action supports the human goal.");

      if (verb === "set_project") {
        if (!plainObject(rawAction.fields)) { errors.push(path + " fields must be an object."); return; }
        const allowed = ["name", "description", "target", "accent"];
        const used = Object.keys(rawAction.fields);
        if (!used.length) errors.push(path + " must change at least one project field.");
        used.forEach(function (key) { if (!allowed.includes(key)) errors.push(path + " cannot change project field “" + key + "”."); });
        if (rawAction.fields.name != null) {
          const value = String(rawAction.fields.name).trim();
          if (!value || value.length > 160) errors.push(path + " project name must contain 1–160 characters.");
          else working.name = value;
        }
        if (rawAction.fields.description != null) working.description = String(rawAction.fields.description).slice(0, 2000);
        if (rawAction.fields.target != null) {
          if (!TARGETS[rawAction.fields.target]) errors.push(path + " target is not supported.");
          else working.target = rawAction.fields.target;
        }
        if (rawAction.fields.accent != null) {
          if (!/^#[0-9a-f]{6}$/i.test(String(rawAction.fields.accent))) errors.push(path + " accent must be a six-digit hex color.");
          else working.accent = String(rawAction.fields.accent);
        }
        changes.push({ actionId: actionId, verb: verb, summary: "Update project identity fields: " + used.join(", ") });
      } else if (verb === "set_goal") {
        if (!plainObject(rawAction.fields)) { errors.push(path + " fields must be an object."); return; }
        const allowed = ["statement", "successMeasure", "status"];
        const used = Object.keys(rawAction.fields);
        if (!used.length) errors.push(path + " must change at least one goal field.");
        used.forEach(function (key) { if (!allowed.includes(key)) errors.push(path + " cannot change goal field “" + key + "”."); });
        if (rawAction.fields.statement != null) working.spine.goal.statement = String(rawAction.fields.statement).slice(0, 2000);
        if (rawAction.fields.successMeasure != null) working.spine.goal.successMeasure = String(rawAction.fields.successMeasure).slice(0, 2000);
        if (rawAction.fields.status != null) {
          if (!["WORKING", "READY FOR REVIEW", "PROVEN", "PAUSED"].includes(rawAction.fields.status)) errors.push(path + " goal status is not supported.");
          else working.spine.goal.status = rawAction.fields.status;
        }
        changes.push({ actionId: actionId, verb: verb, summary: "Update human goal fields: " + used.join(", ") });
      } else if (verb === "add_node") {
        const layer = String(rawAction.layer || "");
        const type = String(rawAction.type || "");
        const alias = String(rawAction.alias || "").replace(/^@/, "");
        if (!MAYBE_LAYER(layer)) { errors.push(path + " layer must be logic, capabilities or visual."); return; }
        const definition = BLOCK_MAP[layer + ":" + type];
        if (!definition) { errors.push(path + " type “" + type + "” is not in the current block catalog."); return; }
        if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(alias) || aliases[alias]) { errors.push(path + " needs a unique safe alias."); return; }
        const x = Number(rawAction.x);
        const y = Number(rawAction.y);
        if (!Number.isFinite(x) || x < 0 || x > 1500 || !Number.isFinite(y) || y < 0 || y > 930) errors.push(path + " position must stay inside the 1600 × 1000 canvas.");
        const config = normalizeAgentConfig(definition, rawAction.config, path, errors);
        const node = createNode(layer, type, Number.isFinite(x) ? x : 120, Number.isFinite(y) ? y : 120);
        if (rawAction.label != null) {
          const label = String(rawAction.label).trim();
          if (!label || label.length > 200) errors.push(path + " label must contain 1–200 characters when supplied.");
          else node.label = label;
        }
        node.summary = rawAction.summary == null ? node.summary : String(rawAction.summary).slice(0, 2000);
        if (rawAction.enabled != null && typeof rawAction.enabled !== "boolean") errors.push(path + " enabled must be true or false.");
        else if (rawAction.enabled != null) node.enabled = rawAction.enabled;
        node.config = Object.assign({}, node.config, config);
        if (node.permission) {
          node.permission.approved = false;
          node.permission.reviewedAt = null;
          warnings.push(path + " adds a capability that will remain unapproved until a human reviews its consent gate.");
        }
        working.layers[layer].nodes.push(node);
        aliases[alias] = node.id;
        changes.push({ actionId: actionId, verb: verb, summary: "Add " + layer + " block “" + node.label + "” as @" + alias, nodeId: node.id });
      } else if (verb === "update_node") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        const definition = BLOCK_MAP[node.layer + ":" + node.type];
        if (!definition) { errors.push(path + " cannot rewrite the config of an unknown preserved block."); return; }
        const used = [];
        if (rawAction.label != null) {
          const label = String(rawAction.label).trim();
          if (!label || label.length > 200) errors.push(path + " label must contain 1–200 characters when supplied.");
          else { node.label = label; used.push("label"); }
        }
        if (rawAction.summary != null) { node.summary = String(rawAction.summary).slice(0, 2000); used.push("summary"); }
        if (rawAction.enabled != null) {
          if (typeof rawAction.enabled !== "boolean") errors.push(path + " enabled must be true or false.");
          else { node.enabled = rawAction.enabled; used.push("enabled"); }
        }
        if (rawAction.config != null) {
          const config = normalizeAgentConfig(definition, rawAction.config, path, errors);
          node.config = Object.assign({}, node.config, config);
          used.push("config");
        }
        if (!used.length) errors.push(path + " must change label, summary, enabled or config.");
        node.updatedAt = now();
        changes.push({ actionId: actionId, verb: verb, summary: "Update “" + node.label + "”: " + used.join(", "), nodeId: node.id });
      } else if (verb === "add_influence_rule") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const profile = getInfluenceProfile(node.layer, node.type);
        const trigger = String(rawAction.trigger || "");
        const action = String(rawAction.action || "");
        const triggerDefinition = influenceOption(profile.triggers, trigger);
        const actionDefinition = influenceOption(profile.actions, action);
        const value = String(rawAction.value == null ? "" : rawAction.value).slice(0, 2000);
        const note = String(rawAction.note || "").slice(0, 1000);
        if (!triggerDefinition) errors.push(path + " trigger is not offered by the " + profile.label + " module.");
        if (!actionDefinition) errors.push(path + " action is not offered by the " + profile.label + " module.");
        if (actionDefinition && actionDefinition.needsValue && !value.trim()) errors.push(path + " must include " + actionDefinition.valueLabel.toLowerCase() + ".");
        if (rawAction.enabled != null && typeof rawAction.enabled !== "boolean") errors.push(path + " enabled must be true or false.");
        if (node.influence.rules.length >= MAX_INFLUENCE_RULES) errors.push(path + " would exceed the " + MAX_INFLUENCE_RULES + "-reaction limit for one block.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          const rule = {
            id: uid("rule"),
            enabled: rawAction.enabled !== false,
            trigger: trigger,
            action: action,
            value: value,
            note: note,
            createdAt: now(),
            updatedAt: now()
          };
          node.influence.rules.push(rule);
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: "Add reaction to “" + node.label + "”: " + influenceRuleSentence(node, rule), nodeId: node.id, ruleId: rule.id });
        }
      } else if (verb === "update_influence_rule") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const profile = getInfluenceProfile(node.layer, node.type);
        const ruleId = String(rawAction.ruleId || "");
        const rule = node.influence.rules.find(function (item) { return item.id === ruleId; });
        if (!rule) { errors.push(path + " could not find reaction “" + ruleId + "”."); return; }
        const used = [];
        if (rawAction.trigger != null) {
          const trigger = String(rawAction.trigger);
          if (!influenceOption(profile.triggers, trigger)) errors.push(path + " trigger is not offered by the " + profile.label + " module.");
          else { rule.trigger = trigger; used.push("moment"); }
        }
        if (rawAction.action != null) {
          const action = String(rawAction.action);
          if (!influenceOption(profile.actions, action)) errors.push(path + " action is not offered by the " + profile.label + " module.");
          else { rule.action = action; used.push("action"); }
        }
        if (rawAction.value != null) { rule.value = String(rawAction.value).slice(0, 2000); used.push("detail"); }
        if (rawAction.note != null) { rule.note = String(rawAction.note).slice(0, 1000); used.push("note"); }
        if (rawAction.enabled != null) {
          if (typeof rawAction.enabled !== "boolean") errors.push(path + " enabled must be true or false.");
          else { rule.enabled = rawAction.enabled; used.push("enabled state"); }
        }
        if (!used.length) errors.push(path + " must change the reaction moment, action, detail, note or enabled state.");
        const finalAction = influenceOption(profile.actions, rule.action);
        if (finalAction && finalAction.needsValue && !String(rule.value || "").trim()) errors.push(path + " must include " + finalAction.valueLabel.toLowerCase() + ".");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          rule.updatedAt = now();
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: "Update reaction on “" + node.label + "”: " + used.join(", "), nodeId: node.id, ruleId: rule.id });
        }
      } else if (verb === "remove_influence_rule") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const ruleId = String(rawAction.ruleId || "");
        const ruleIndex = node.influence.rules.findIndex(function (item) { return item.id === ruleId; });
        if (ruleIndex < 0) errors.push(path + " could not find reaction “" + ruleId + "”.");
        else {
          node.influence.rules.splice(ruleIndex, 1);
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: "Remove reaction " + ruleId + " from “" + node.label + "”", nodeId: node.id, ruleId: ruleId });
          warnings.push(path + " removes a per-block reaction. Confirm no visible path relies on it.");
        }
      } else if (verb === "set_visual_state") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const profile = getInfluenceProfile(node.layer, node.type);
        const stateId = String(rawAction.state || "");
        const slot = influenceOption(profile.visualStates, stateId);
        if (!slot) errors.push(path + " visual state is not offered by the " + profile.label + " module.");
        const supplied = ["assetRef", "color", "notes"].filter(function (key) { return Object.prototype.hasOwnProperty.call(rawAction, key); });
        if (!supplied.length) errors.push(path + " must set assetRef, color or notes.");
        if (rawAction.color != null && String(rawAction.color) && !/^#[0-9a-f]{6}$/i.test(String(rawAction.color))) errors.push(path + " color must be empty or a six-digit hex color.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          const state = Object.assign({}, node.influence.visualStates[stateId] || {});
          if (rawAction.assetRef != null) state.assetRef = String(rawAction.assetRef).slice(0, 1000);
          if (rawAction.color != null) state.color = String(rawAction.color) ? safeColor(rawAction.color) : "";
          if (rawAction.notes != null) state.notes = String(rawAction.notes).slice(0, 2000);
          state.updatedAt = now();
          node.influence.visualStates[stateId] = state;
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: "Set “" + slot.label + "” visual state on “" + node.label + "”: " + supplied.join(", "), nodeId: node.id, state: stateId });
        }
      } else if (verb === "set_code_hook") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const profile = getInfluenceProfile(node.layer, node.type);
        const hookName = String(rawAction.hook || "");
        const hookDefinition = influenceOption(profile.hooks, hookName);
        if (!hookDefinition) errors.push(path + " hook is not offered by the " + profile.label + " module.");
        const language = String(rawAction.language || "JavaScript");
        if (!["JavaScript", "JSON expression"].includes(language)) errors.push(path + " language must be JavaScript or JSON expression.");
        const code = String(rawAction.code || "");
        if (!code.trim() || code.length > 12000) errors.push(path + " code must contain 1–12000 characters.");
        if (Object.prototype.hasOwnProperty.call(rawAction, "enabled") && rawAction.enabled !== false) errors.push(path + " cannot enable a code hook. This builder stores transparent drafts only.");
        if (rawAction.execution != null && String(rawAction.execution) !== "CONTRACT_ONLY") errors.push(path + " execution must remain CONTRACT_ONLY.");
        const requestedId = String(rawAction.hookId || "");
        let hook = requestedId ? node.influence.codeHooks.find(function (item) { return item.id === requestedId; }) : null;
        if (requestedId && !hook) errors.push(path + " could not find hook draft “" + requestedId + "”.");
        if (!requestedId && node.influence.codeHooks.length >= MAX_CODE_HOOKS) errors.push(path + " would exceed the " + MAX_CODE_HOOKS + "-hook limit for one block.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          if (!hook) {
            hook = { id: uid("hook") };
            node.influence.codeHooks.push(hook);
          }
          hook.hook = hookName;
          hook.label = String(rawAction.label || hookDefinition.label || "Advanced hook draft").slice(0, 240);
          hook.language = language;
          hook.code = code.slice(0, 12000);
          hook.execution = "CONTRACT_ONLY";
          hook.enabled = false;
          hook.updatedAt = now();
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: (requestedId ? "Update" : "Add") + " contract-only hook draft “" + hook.label + "” on “" + node.label + "”", nodeId: node.id, hookId: hook.id });
          warnings.push(path + " stores code transparently but does not execute it. A separately trusted sandbox/runtime is still required.");
        }
      } else if (verb === "remove_code_hook") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        node.influence = normalizeInfluence(node.influence, node.layer, node.type);
        const hookId = String(rawAction.hookId || "");
        const hookIndex = node.influence.codeHooks.findIndex(function (item) { return item.id === hookId; });
        if (hookIndex < 0) errors.push(path + " could not find hook draft “" + hookId + "”.");
        else {
          node.influence.codeHooks.splice(hookIndex, 1);
          node.influence.updatedAt = now();
          node.updatedAt = now();
          changes.push({ actionId: actionId, verb: verb, summary: "Remove contract-only hook draft " + hookId + " from “" + node.label + "”", nodeId: node.id, hookId: hookId });
        }
      } else if (verb === "move_node") {
        const node = agentNodeRef(working, aliases, rawAction.node, path + " node", errors);
        if (!node) return;
        const x = Number(rawAction.x), y = Number(rawAction.y);
        if (!Number.isFinite(x) || x < 0 || x > 1500 || !Number.isFinite(y) || y < 0 || y > 930) errors.push(path + " position must stay inside the 1600 × 1000 canvas.");
        else { node.x = x; node.y = y; node.updatedAt = now(); }
        changes.push({ actionId: actionId, verb: verb, summary: "Move “" + node.label + "” to " + x + ", " + y, nodeId: node.id });
      } else if (verb === "connect") {
        const layer = String(rawAction.layer || "");
        if (!MAYBE_LAYER(layer)) { errors.push(path + " layer must be logic, capabilities or visual."); return; }
        const from = agentNodeRef(working, aliases, rawAction.from, path + " from", errors);
        const to = agentNodeRef(working, aliases, rawAction.to, path + " to", errors);
        if (!from || !to) return;
        if (from.layer !== layer || to.layer !== layer) errors.push(path + " endpoints must both belong to the declared layer.");
        if (from.id === to.id) errors.push(path + " cannot connect a block to itself.");
        const fromDef = getDefinition(layer, from.type), toDef = getDefinition(layer, to.type);
        if (fromDef.output === false) errors.push(path + " source block has no output port.");
        if (toDef.input === false) errors.push(path + " target block has no input port.");
        if (working.layers[layer].edges.some(function (edge) { return edge.from === from.id && edge.to === to.id; })) errors.push(path + " duplicates an existing route.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          const edge = { id: uid("edge"), from: from.id, to: to.id, label: String(rawAction.label || "flow").slice(0, 100), createdAt: now() };
          working.layers[layer].edges.push(edge);
          changes.push({ actionId: actionId, verb: verb, summary: "Connect “" + from.label + "” to “" + to.label + "”", edgeId: edge.id });
        }
      } else if (verb === "remove_edge") {
        const layer = String(rawAction.layer || "");
        const edgeId = String(rawAction.edgeId || "");
        if (!MAYBE_LAYER(layer)) { errors.push(path + " layer must be logic, capabilities or visual."); return; }
        const indexOfEdge = working.layers[layer].edges.findIndex(function (edge) { return edge.id === edgeId; });
        if (indexOfEdge < 0) errors.push(path + " could not find route “" + edgeId + "” in " + layer + ".");
        else {
          const edge = working.layers[layer].edges.splice(indexOfEdge, 1)[0];
          changes.push({ actionId: actionId, verb: verb, summary: "Remove route " + edge.id, edgeId: edge.id });
          warnings.push(path + " removes an existing route. Confirm the downstream path remains understandable.");
        }
      } else if (verb === "bind") {
        const sourceNode = agentNodeRef(working, aliases, rawAction.source, path + " source", errors);
        const targetNode = agentNodeRef(working, aliases, rawAction.target, path + " target", errors);
        if (!sourceNode || !targetNode) return;
        if (sourceNode.layer === targetNode.layer) errors.push(path + " must bind nodes from different layers; use connect for same-layer flow.");
        if (working.bindings.some(function (binding) { return (binding.source === sourceNode.id && binding.target === targetNode.id) || (binding.source === targetNode.id && binding.target === sourceNode.id); })) errors.push(path + " duplicates an existing cross-layer binding.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          const binding = { id: uid("binding"), source: sourceNode.id, target: targetNode.id, purpose: String(rawAction.purpose || "contract").slice(0, 160), createdAt: now() };
          working.bindings.push(binding);
          changes.push({ actionId: actionId, verb: verb, summary: "Bind “" + sourceNode.label + "” to “" + targetNode.label + "”", bindingId: binding.id });
        }
      } else if (verb === "remove_binding") {
        const bindingId = String(rawAction.bindingId || "");
        const bindingIndex = working.bindings.findIndex(function (binding) { return binding.id === bindingId; });
        if (bindingIndex < 0) errors.push(path + " could not find binding “" + bindingId + "”.");
        else {
          working.bindings.splice(bindingIndex, 1);
          changes.push({ actionId: actionId, verb: verb, summary: "Remove cross-layer binding " + bindingId, bindingId: bindingId });
          warnings.push(path + " removes an existing cross-layer contract. Confirm both layers remain connected elsewhere.");
        }
      } else if (verb === "set_state") {
        const key = String(rawAction.key || "");
        const valueType = String(rawAction.valueType || "");
        if (!safeAgentKey(key)) errors.push(path + " state key must begin with a letter and use only letters, numbers, underscores or hyphens.");
        if (!["string", "number", "boolean", "array", "object"].includes(valueType)) errors.push(path + " valueType must be string, number, boolean, array or object.");
        const value = rawAction.default;
        const typeMatches = valueType === "array" ? Array.isArray(value) : valueType === "object" ? plainObject(value) : typeof value === valueType && (valueType !== "number" || Number.isFinite(value));
        if (!typeMatches) errors.push(path + " default value does not match valueType " + valueType + ".");
        if (working.spine.stateSchema[key]) warnings.push(path + " updates existing state key “" + key + "”. Check every route that relies on its prior default.");
        if (!errors.some(function (item) { return item.startsWith(path); })) {
          working.spine.stateSchema[key] = { type: valueType, default: clone(value) };
          changes.push({ actionId: actionId, verb: verb, summary: "Set shared state “" + key + "” as " + valueType });
        }
      } else if (verb === "add_invariant") {
        const text = String(rawAction.text || "").trim();
        if (!text || text.length > 1000) errors.push(path + " invariant must contain 1–1000 characters.");
        else if (working.spine.invariants.includes(text)) errors.push(path + " duplicates an existing invariant.");
        else {
          working.spine.invariants.push(text);
          changes.push({ actionId: actionId, verb: verb, summary: "Add invariant: " + text.slice(0, 180) });
        }
      }
    });

    permissionBefore.forEach(function (approved, nodeId) {
      const node = findNode(working, nodeId);
      if (!node || !node.permission || Boolean(node.permission.approved) !== approved) errors.push("Proposal changed or removed an existing human-controlled permission decision for node " + nodeId + ".");
    });
    working.meta.updatedAt = now();
    const beforeValidation = validateProject(project);
    const afterValidation = validateProject(working);
    const beforeCounts = countProjectParts(project);
    const afterCounts = countProjectParts(working);
    if (afterValidation.errors > beforeValidation.errors) warnings.push("Dry-run diagnostics add " + (afterValidation.errors - beforeValidation.errors) + " critical error" + (afterValidation.errors - beforeValidation.errors === 1 ? "" : "s") + ". The proposal may still be reviewable, but the working build will be blocked until resolved.");
    if (afterValidation.warnings > beforeValidation.warnings) warnings.push("Dry-run diagnostics add " + (afterValidation.warnings - beforeValidation.warnings) + " warning" + (afterValidation.warnings - beforeValidation.warnings === 1 ? "" : "s") + ".");
    const normalizedProposal = {
      schema: AGENT_PROPOSAL_SCHEMA,
      schemaVersion: AGENT_PROPOSAL_VERSION,
      proposalId: proposalId,
      source: { projectId: String(source.projectId || ""), projectUpdatedAt: String(source.projectUpdatedAt || ""), builderVersion: String(source.builderVersion || "") },
      title: title,
      summary: String(payload.summary || "").slice(0, 3000),
      assumptions: assumptions,
      actions: clone(actions),
      tests: tests,
      unresolvedRisks: unresolvedRisks
    };
    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      changes: changes,
      normalizedProposal: normalizedProposal,
      previewProject: errors.length ? null : working,
      aliasMap: clone(aliases),
      impact: {
        before: beforeCounts,
        after: afterCounts,
        delta: {
          nodes: afterCounts.nodes - beforeCounts.nodes,
          edges: afterCounts.edges - beforeCounts.edges,
          bindings: afterCounts.bindings - beforeCounts.bindings,
          invariants: afterCounts.invariants - beforeCounts.invariants,
          stateKeys: afterCounts.stateKeys - beforeCounts.stateKeys,
          influenceRules: afterCounts.influenceRules - beforeCounts.influenceRules,
          visualStates: afterCounts.visualStates - beforeCounts.visualStates,
          codeHooks: afterCounts.codeHooks - beforeCounts.codeHooks
        },
        diagnosticsBefore: { score: beforeValidation.score, errors: beforeValidation.errors, warnings: beforeValidation.warnings, blocked: beforeValidation.blocked },
        diagnosticsAfter: { score: afterValidation.score, errors: afterValidation.errors, warnings: afterValidation.warnings, blocked: afterValidation.blocked }
      }
    };
  }

  function applyAgentProposal(project, payload) {
    const review = validateAgentProposal(payload, project);
    if (!review.valid) return review;
    const next = clone(review.previewProject);
    next.spine.collaboration = Object.assign(defaultCollaborationPolicy(), next.spine.collaboration || {});
    next.spine.collaboration.reviewLog = Array.isArray(next.spine.collaboration.reviewLog) ? next.spine.collaboration.reviewLog : [];
    next.spine.collaboration.reviewLog.push({
      id: uid("review"),
      proposalId: review.normalizedProposal.proposalId,
      title: review.normalizedProposal.title,
      reviewedAt: now(),
      actionCount: review.normalizedProposal.actions.length,
      decision: "HUMAN_APPROVED",
      diagnosticsBefore: review.impact.diagnosticsBefore.score,
      diagnosticsAfter: review.impact.diagnosticsAfter.score
    });
    next.spine.collaboration.reviewLog = next.spine.collaboration.reviewLog.slice(-30);
    next.meta.updatedAt = now();
    return Object.assign({}, review, { project: next });
  }

  function generateAiIntentPacket(project) {
    const validation = validateProject(project);
    const capabilities = project.layers.capabilities.nodes.filter(function (node) { return node.enabled !== false; }).map(function (node) {
      const definition = getDefinition("capabilities", node.type);
      const needsConsent = Boolean(definition.permission);
      return {
        id: node.id,
        type: node.type,
        label: node.label,
        permissionId: needsConsent ? definition.permission.id : null,
        authority: needsConsent ? (node.permission && node.permission.approved ? "APPROVED IN PROJECT" : "NOT APPROVED") : "NO EXTRA PERMISSION DECLARED",
        contractOnly: CONTRACT_ONLY_CAPABILITIES.has(node.type),
        config: clone(node.config || {})
      };
    });
    return {
      schema: "axm.intent.packet",
      schemaVersion: 2,
      createdAt: now(),
      source: { projectId: project.id, projectName: project.name, projectUpdatedAt: project.meta.updatedAt, builderVersion: APP_VERSION },
      intent: {
        action: "PROPOSE ONLY",
        goal: clone(project.spine.goal || { statement: "", successMeasure: "", status: "WORKING" }),
        requestedReturn: "A valid axm.agent.proposal packet with assumptions, bounded actions, tests and unresolved risks."
      },
      authority: {
        mayInspectIncludedContext: true,
        mayProposeChanges: true,
        mayApplyChanges: false,
        mayGrantPermissions: false,
        mayRewriteCanon: false,
        humanApprovalRequiredBeforeApply: true
      },
      collaboration: {
        policy: clone(project.spine.collaboration || defaultCollaborationPolicy()),
        workspaceSchema: AGENT_WORKSPACE_SCHEMA,
        proposalSchema: AGENT_PROPOSAL_SCHEMA,
        proposalSchemaVersion: AGENT_PROPOSAL_VERSION,
        actionProtocol: agentActionProtocol()
      },
      invariants: clone(project.spine.invariants || []),
      capabilities: capabilities,
      graph: {
        logic: project.layers.logic.nodes.map(compactNodeContract),
        capabilities: project.layers.capabilities.nodes.map(compactNodeContract),
        visual: project.layers.visual.nodes.map(compactNodeContract),
        edges: {
          logic: clone(project.layers.logic.edges),
          capabilities: clone(project.layers.capabilities.edges),
          visual: clone(project.layers.visual.edges)
        },
        bindings: clone(project.bindings)
      },
      diagnostics: { score: validation.score, errors: validation.errors, warnings: validation.warnings, blocked: validation.blocked },
      disclosure: "This packet does not contact an AI provider. It is a portable, human-reviewable request contract."
    };
  }

  function generateEngineHandoff(project) {
    const engineNode = project.layers.capabilities.nodes.find(function (node) { return node.type === "engine-dock"; });
    const worldMap = project.layers.visual.nodes.find(function (node) { return node.enabled !== false && node.type === "world-map"; });
    const scene = project.layers.visual.nodes.find(function (node) { return node.enabled !== false && node.type === "game-scene"; });
    const physics = project.layers.capabilities.nodes.find(function (node) { return node.enabled !== false && node.type === "physics-adapter"; });
    const controls = project.layers.capabilities.nodes.filter(function (node) { return node.enabled !== false && ["phone-controls", "local-multiplayer", "lan-sync"].includes(node.type); });
    const permissionApproved = Boolean(engineNode && engineNode.permission && engineNode.permission.approved);
    return {
      schema: "axm.engine.handoff",
      schemaVersion: 1,
      createdAt: now(),
      source: { projectId: project.id, projectName: project.name, projectUpdatedAt: project.meta.updatedAt, builderVersion: APP_VERSION },
      target: {
        projectTarget: project.target,
        engine: engineNode ? engineNode.config.engine : "Not selected",
        adapter: engineNode ? engineNode.config.adapter : "AXM External Engine Dock v0.1.0",
        mode: engineNode ? engineNode.config.mode : "Handoff only"
      },
      authority: {
        status: "CONTRACT ONLY — NO ENGINE PROJECT GENERATED",
        engineExecutionApproved: permissionApproved,
        mayExecuteCommands: false,
        mayOverwriteFiles: false,
        commandApprovalRequiredAtDock: true,
        note: permissionApproved ? "The project records consent for the capability, but this export still cannot execute an engine command." : "External execution permission is not approved in this project."
      },
      goal: clone(project.spine.goal || {}),
      world: {
        scene: scene ? clone(scene.config || {}) : null,
        map: worldMap ? clone(worldMap.config || {}) : null,
        sceneryLayers: project.layers.visual.nodes.filter(function (node) { return node.enabled !== false && node.type === "tile-layer"; }).map(compactNodeContract),
        characters: project.layers.visual.nodes.filter(function (node) { return node.enabled !== false && ["player-sprite", "npc"].includes(node.type); }).map(compactNodeContract),
        objects: project.layers.visual.nodes.filter(function (node) { return node.enabled !== false && node.type === "world-object"; }).map(compactNodeContract),
        camera: project.layers.visual.nodes.filter(function (node) { return node.enabled !== false && node.type === "camera"; }).map(compactNodeContract)
      },
      systems: {
        logic: project.layers.logic.nodes.filter(function (node) { return node.enabled !== false; }).map(compactNodeContract),
        physics: physics ? compactNodeContract(physics) : null,
        controls: controls.map(compactNodeContract),
        stateSchema: clone(project.spine.stateSchema || {})
      },
      bindings: clone(project.bindings),
      invariants: clone(project.spine.invariants || []),
      nextBoundary: "Import this packet into a separately installed, approval-gated Engine Dock adapter and review its proposed file and command plan."
    };
  }

  function visualConfig(project, type, fallback) {
    const node = visualNode(project, type);
    return node ? node.config || {} : (fallback || {});
  }

  function visualNode(project, type) {
    return project.layers.visual.nodes.find(function (candidate) { return candidate.enabled !== false && candidate.type === type; }) || null;
  }

  function visualConfigs(project, type) {
    return project.layers.visual.nodes.filter(function (candidate) { return candidate.enabled !== false && candidate.type === type; }).map(function (node) { return node.config || {}; });
  }

  function hasApprovedCapability(project, type) {
    return project.layers.capabilities.nodes.some(function (node) {
      return node.enabled !== false && node.type === type && (!getDefinition("capabilities", type).permission || (node.permission && node.permission.approved));
    });
  }

  function influenceValue(node, trigger, action, fallback) {
    if (!node) return fallback;
    const influence = normalizeInfluence(node.influence, node.layer, node.type);
    const rule = influence.rules.find(function (candidate) {
      return candidate.enabled !== false && candidate.trigger === trigger && candidate.action === action && String(candidate.value || "").trim();
    });
    return rule ? String(rule.value) : fallback;
  }

  function sharedStandaloneStyles(accent) {
    return `
      :root{color-scheme:dark;--accent:${accent};--bg:#061019;--panel:#0b1a27;--panel2:#102435;--text:#effaff;--muted:#8ca7b9;--line:rgba(174,214,235,.17);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}body{min-height:100vh;background:radial-gradient(circle at 70% -10%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 40%),linear-gradient(145deg,#061019,#081521 55%,#07111a)}button{font:inherit}a{color:inherit}.shell{width:min(1160px,calc(100% - 32px));margin:0 auto}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px;border-bottom:1px solid var(--line)}.mark{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em}.mark i{display:grid;place-items:center;width:34px;height:34px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:10px;color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent);font-style:normal}.tag{padding:5px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font:700 10px ui-monospace,monospace;letter-spacing:.08em}.footer{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:70px;margin-top:38px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#67e69a;box-shadow:0 0 10px rgba(103,230,154,.5)}
      @media(max-width:620px){.shell{width:min(100% - 20px,1160px)}.top{min-height:60px}.tag{display:none}.footer{align-items:flex-start;flex-direction:column;justify-content:center;gap:5px}}
    `;
  }

  function websiteBuild(project, accent) {
    const heading = visualConfig(project, "heading", { text: project.name }).text || project.name;
    const textNodes = visualConfigs(project, "text");
    const bodyText = (textNodes[0] && textNodes[0].text) || project.description;
    const buttonNode = visualNode(project, "button");
    const button = buttonNode ? buttonNode.config || {} : { text: "Continue" };
    const nav = String(visualConfig(project, "navigation", { items: "Purpose, Build, Share" }).items || "Purpose, Build, Share").split(",").map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 6);
    const canStore = hasApprovedCapability(project, "local-storage");
    const buttonMessage = influenceValue(buttonNode, "human_activates", "show_message", "The next step is visible. Nothing was submitted or uploaded.");
    const buttonLabel = influenceValue(buttonNode, "human_activates", "change_label", "Invitation opened");
    const buttonState = influenceValue(buttonNode, "human_activates", "change_visual_state", "active");
    return {
      body: `
        <header class="shell top"><div class="mark"><i>◇</i>${escapeHtml(project.name)}</div><nav>${nav.map(function (item) { return '<a href="#features">' + escapeHtml(item) + "</a>"; }).join("")}</nav><span class="tag">LOCAL · READABLE</span></header>
        <main>
          <section class="shell hero"><div class="eyebrow">SHAPED WITH THREE CONNECTED LAYERS</div><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(bodyText)}</p><div class="hero-actions"><button id="mainAction">${escapeHtml(button.text || "Continue")}</button><span id="actionState">You remain in control.</span></div><div class="orb" aria-hidden="true"><span>01</span><span>02</span><span>03</span><b>AXM</b></div></section>
          <section class="shell features" id="features"><article><i>01</i><h2>Logic you can inspect</h2><p>Events, state and decisions stay visible instead of disappearing behind hidden automation.</p></article><article><i>02</i><h2>Capabilities you approve</h2><p>Every storage, network or AI capability has an explicit boundary and permission state.</p></article><article><i>03</i><h2>Experience people understand</h2><p>Visual components bind to the same source truth rather than becoming a disconnected mock-up.</p></article></section>
        </main>
        <footer class="shell footer"><span><i class="dot"></i>Local build · supported guided rules may run · code drafts never run</span><span>Generated from ${escapeHtml(project.meta.templateName)} · ${escapeHtml(APP_VERSION)}</span></footer>`,
      style: `
        nav{display:flex;gap:20px}nav a{color:var(--muted);font-size:12px;text-decoration:none}nav a:hover{color:var(--text)}.hero{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:570px;padding:70px 390px 70px 0}.eyebrow{margin-bottom:18px;color:var(--accent);font:800 10px ui-monospace,monospace;letter-spacing:.18em}.hero h1{max-width:720px;margin:0;font-size:clamp(50px,7vw,91px);line-height:.92;letter-spacing:-.065em}.hero p{max-width:660px;margin:25px 0;color:var(--muted);font-size:17px;line-height:1.65}.hero-actions{display:flex;align-items:center;gap:14px}.hero-actions button{min-height:45px;padding:0 20px;border:1px solid color-mix(in srgb,var(--accent) 65%,white 10%);border-radius:11px;color:#061019;background:var(--accent);font-weight:850;box-shadow:0 15px 38px color-mix(in srgb,var(--accent) 22%,transparent);cursor:pointer}.hero-actions button:hover{filter:brightness(1.1);transform:translateY(-1px)}#actionState{color:var(--muted);font-size:12px}.orb{position:absolute;right:20px;top:50%;width:310px;height:310px;border:1px solid color-mix(in srgb,var(--accent) 27%,transparent);border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 14%,transparent),transparent 62%);transform:translateY(-50%)}.orb:before,.orb:after{content:"";position:absolute;border:1px solid color-mix(in srgb,var(--accent) 16%,transparent);border-radius:50%}.orb:before{inset:35px}.orb:after{inset:78px}.orb b{position:absolute;inset:0;display:grid;place-items:center;color:var(--accent);font:900 22px ui-monospace,monospace;letter-spacing:.2em}.orb span{position:absolute;z-index:2;display:grid;place-items:center;width:44px;height:44px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:13px;color:var(--accent);background:#091722;font:800 10px ui-monospace,monospace;box-shadow:0 10px 25px rgba(0,0,0,.25)}.orb span:nth-child(1){left:14px;top:55px}.orb span:nth-child(2){right:11px;top:82px}.orb span:nth-child(3){left:127px;bottom:5px}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.features article{min-height:205px;padding:24px;border:1px solid var(--line);border-radius:17px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 5%,transparent),rgba(255,255,255,.015))}.features i{display:inline-grid;place-items:center;width:35px;height:35px;border:1px solid color-mix(in srgb,var(--accent) 27%,transparent);border-radius:10px;color:var(--accent);font:700 9px ui-monospace,monospace;font-style:normal}.features h2{margin:24px 0 10px;font-size:18px}.features p{margin:0;color:var(--muted);font-size:13px;line-height:1.6}@media(max-width:880px){.hero{min-height:680px;padding:70px 0 300px}.orb{left:50%;right:auto;top:auto;bottom:15px;width:260px;height:260px;transform:translateX(-50%)}.features{grid-template-columns:1fr}.hero h1{font-size:clamp(45px,13vw,75px)}}@media(max-width:620px){nav{display:none}.hero{min-height:650px;padding-top:55px}.hero p{font-size:15px}.hero-actions{align-items:flex-start;flex-direction:column}.features article{min-height:170px}}
      `,
      script: `
        const action=document.getElementById("mainAction"),state=document.getElementById("actionState");
        action.addEventListener("click",()=>{state.textContent=${JSON.stringify(buttonMessage)};action.textContent=${JSON.stringify(buttonLabel)};action.dataset.visualState=${JSON.stringify(buttonState)};action.disabled=true;${canStore ? 'try{localStorage.setItem("axm:' + slugify(project.id) + ':invitation","opened")}catch(_){/* Sandboxed preview storage is intentionally unavailable. */}' : ""}});
        ${canStore ? 'try{if(localStorage.getItem("axm:' + slugify(project.id) + ':invitation")){state.textContent="Welcome back — restored from this device only."}}catch(_){/* Standalone builds retain local storage; opaque previews do not. */}' : ""}
      `
    };
  }

  function dashboardBuild(project, accent) {
    let metrics = visualConfigs(project, "metric");
    if (!metrics.length) metrics = [{ label: "Readiness", value: "84", unit: "%" }, { label: "Active routes", value: "12", unit: "" }, { label: "Evidence", value: "31", unit: "" }];
    while (metrics.length < 3) metrics.push({ label: "Verified signal", value: String(17 + metrics.length * 5), unit: "" });
    metrics = metrics.slice(0, 4);
    const chart = visualConfig(project, "chart", { title: "Verified activity", series: "12,16,14,22,27,31,29" });
    const series = String(chart.series || "12,16,14,22,27,31,29").split(",").map(Number).filter(Number.isFinite).slice(0, 12);
    const list = visualConfig(project, "list", { title: "Recent evidence", items: "Project loaded,Routes verified,Export ready" });
    const items = String(list.items || "").split(/,|\n/).map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 7);
    return {
      body: `
        <header class="shell top"><div class="mark"><i>◇</i>${escapeHtml(project.name)}</div><span class="tag">LOCAL STEWARDSHIP</span></header>
        <main class="shell dashboard"><div class="dash-head"><div><div class="eyebrow">TRUTHFUL PROJECT READOUT</div><h1>${escapeHtml(visualConfig(project, "heading", { text: "Stewardship overview" }).text || "Stewardship overview")}</h1><p>${escapeHtml(project.description)}</p></div><button id="reviewButton"><span class="dot"></span>Review evidence</button></div>
          <section class="metrics">${metrics.map(function (metric, index) { return '<article><span>' + escapeHtml(metric.label || "Metric") + '</span><b data-base="' + escapeHtml(metric.value || "0") + '">' + escapeHtml(metric.value || "0") + '<i>' + escapeHtml(metric.unit || "") + '</i></b><small>' + (index === 0 ? "verified now" : "local source") + "</small></article>"; }).join("")}</section>
          <section class="dash-grid"><article class="chart-card"><div class="card-title"><div><span>ACTIVITY PATTERN</span><h2>${escapeHtml(chart.title || "Activity")}</h2></div><b>LIVE</b></div><div class="bars">${series.map(function (value, index) { const max = Math.max.apply(null, series.concat([1])); return '<i style="height:' + Math.max(8, Math.round(value / max * 100)) + '%"><span>' + value + "</span></i>"; }).join("")}</div></article><article class="evidence-card"><div class="card-title"><div><span>VISIBLE TRAIL</span><h2>${escapeHtml(list.title || "Evidence")}</h2></div><b>${items.length}</b></div><ul>${items.map(function (item, index) { return '<li><i>' + String(index + 1).padStart(2, "0") + "</i><span>" + escapeHtml(item) + '</span><b>PASS</b></li>'; }).join("")}</ul></article></section>
          <section class="proof-strip"><span><i class="dot"></i>Shared project spine active</span><span>${project.bindings.length} cross-layer bindings</span><span>${project.spine.invariants.length} protected rules</span><span id="localClock">--:--:--</span></section>
        </main><footer class="shell footer"><span>Local build · supported guided rules may run · code drafts never run</span><span>Generated by AXM Shapeable Builder ${escapeHtml(APP_VERSION)}</span></footer>`,
      style: `
        .dashboard{padding:55px 0 0}.dash-head{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:31px}.eyebrow,.card-title span{color:var(--accent);font:800 9px ui-monospace,monospace;letter-spacing:.16em}.dash-head h1{margin:8px 0 6px;font-size:clamp(35px,5vw,60px);letter-spacing:-.05em}.dash-head p{max-width:640px;margin:0;color:var(--muted);font-size:13px;line-height:1.55}.dash-head button{display:flex;align-items:center;min-height:42px;padding:0 15px;border:1px solid var(--line);border-radius:11px;color:var(--text);background:var(--panel);font-size:11px;font-weight:750;cursor:pointer}.dash-head button:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent)}.metrics{display:grid;grid-template-columns:repeat(${metrics.length},1fr);gap:10px}.metrics article{position:relative;min-height:132px;padding:17px;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 6%,transparent),rgba(255,255,255,.012))}.metrics article:after{content:"";position:absolute;right:-20px;bottom:-35px;width:100px;height:100px;border:1px solid color-mix(in srgb,var(--accent) 10%,transparent);border-radius:50%}.metrics span,.metrics small{display:block;color:var(--muted);font-size:10px}.metrics b{display:block;margin:13px 0 5px;font:800 34px ui-monospace,monospace;letter-spacing:-.04em}.metrics b i{margin-left:2px;color:var(--accent);font-size:14px;font-style:normal}.metrics small{font:8px ui-monospace,monospace;text-transform:uppercase}.dash-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,1fr);gap:10px;margin-top:10px}.chart-card,.evidence-card{min-height:330px;padding:19px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.card-title{display:flex;align-items:center;justify-content:space-between}.card-title h2{margin:5px 0 0;font-size:15px}.card-title>b{padding:4px 7px;border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:6px;color:var(--accent);font:800 8px ui-monospace,monospace}.bars{display:flex;align-items:flex-end;gap:8px;height:235px;padding-top:32px;border-bottom:1px solid var(--line);background:repeating-linear-gradient(to top,transparent 0,transparent 52px,var(--line) 53px)}.bars>i{position:relative;flex:1;min-height:8px;border-radius:6px 6px 1px 1px;background:linear-gradient(to top,color-mix(in srgb,var(--accent) 38%,#0d3140),var(--accent));box-shadow:0 0 18px color-mix(in srgb,var(--accent) 12%,transparent);transition:filter .2s}.bars>i:hover{filter:brightness(1.25)}.bars>i span{position:absolute;left:50%;top:-18px;color:var(--muted);font:7px ui-monospace,monospace;opacity:0;transform:translateX(-50%)}.bars>i:hover span{opacity:1}.evidence-card ul{padding:0;margin:18px 0 0;list-style:none}.evidence-card li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:41px;border-bottom:1px solid var(--line);color:var(--muted);font-size:10px}.evidence-card li i{color:var(--accent);font:8px ui-monospace,monospace;font-style:normal}.evidence-card li b{color:#67e69a;font:7px ui-monospace,monospace}.proof-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:12px 14px;border:1px solid var(--line);border-radius:11px;color:var(--muted);background:rgba(255,255,255,.012);font:8px ui-monospace,monospace}@media(max-width:860px){.metrics{grid-template-columns:repeat(2,1fr)}.dash-grid{grid-template-columns:1fr}.dash-head{align-items:flex-start;flex-direction:column}.proof-strip{align-items:flex-start;flex-direction:column}}@media(max-width:500px){.dashboard{padding-top:35px}.metrics{grid-template-columns:1fr 1fr}.metrics article{min-height:112px;padding:13px}.metrics b{font-size:27px}.chart-card,.evidence-card{padding:14px}.dash-head button{width:100%;justify-content:center}}
      `,
      script: `
        const clock=document.getElementById("localClock");setInterval(()=>clock.textContent=new Date().toLocaleTimeString(),1000);clock.textContent=new Date().toLocaleTimeString();
        document.getElementById("reviewButton").addEventListener("click",()=>{document.querySelector(".evidence-card").scrollIntoView({behavior:"smooth"});document.querySelector(".evidence-card").animate([{boxShadow:"0 0 0 0 ${accent}55"},{boxShadow:"0 0 0 12px transparent"}],{duration:700})});
      `
    };
  }

  function gameBuild(project, accent) {
    const timerConfig = project.layers.logic.nodes.find(function (node) { return node.enabled !== false && node.type === "timer"; });
    const goalConfig = project.layers.logic.nodes.find(function (node) { return node.enabled !== false && node.type === "condition"; });
    const counterConfig = project.layers.logic.nodes.find(function (node) { return node.enabled !== false && node.type === "counter"; });
    const playerNode = visualNode(project, "player-sprite");
    const player = playerNode ? playerNode.config || {} : { name: "Courier", color: "#44d7ca", movementSpeed: 2.2 };
    const npcNode = visualNode(project, "npc");
    const npc = npcNode ? npcNode.config || {} : null;
    const objectNode = visualNode(project, "world-object");
    const object = objectNode ? objectNode.config || {} : { name: "Parcel" };
    const map = visualConfig(project, "world-map", { biome: "Green district", regions: "district" });
    const sceneryNode = project.layers.capabilities.nodes.find(function (node) { return node.enabled !== false && node.type === "scenery-factory"; });
    const biome = String(map.biome || (sceneryNode && sceneryNode.config.biome) || "Green district");
    const palettes = {
      "Enchanted forest": { ground: "#15382d", tileA: "#173d30", tileB: "#194433", road: "#485b48", treeA: "#215c43", treeB: "#31815a", buildings: ["#493a54", "#405447", "#5c453c"], collectible: "#ffe36e" },
      "Coastal village": { ground: "#183d42", tileA: "#1a4447", tileB: "#1e4a4d", road: "#b89368", treeA: "#246750", treeB: "#3c9870", buildings: ["#35506a", "#6b4d4a", "#4d6175"], collectible: "#ffd06b" },
      "Tropical island": { ground: "#174638", tileA: "#194c3b", tileB: "#1c523f", road: "#c0a768", treeA: "#236d44", treeB: "#45a65b", buildings: ["#6b4f40", "#4d6375", "#755e3e"], collectible: "#ffcf5c" },
      "Dutch city": { ground: "#203b3d", tileA: "#233f42", tileB: "#274449", road: "#34444d", treeA: "#315d4c", treeB: "#438064", buildings: ["#5d4051", "#3f5a6b", "#6c513f"], collectible: "#ffb85c" },
      "Green district": { ground: "#0d2729", tileA: "#0e2929", tileB: "#102d2c", road: "#172a31", treeA: "#183e34", treeB: "#23634b", buildings: ["#183342", "#203447", "#273745"], collectible: "#ffb85c" }
    };
    const palette = palettes[biome] || palettes["Green district"];
    const missionSeconds = Math.max(15, Math.min(300, Number(timerConfig && timerConfig.config.duration) || 60));
    const goalMatch = String(goalConfig && goalConfig.config.expression || "parcels >= 5").match(/>=\s*(\d+)/);
    const goal = Math.max(1, Math.min(20, goalMatch ? Number(goalMatch[1]) : 5));
    const objectiveName = String(object.name || (counterConfig && counterConfig.config.key) || "Objective");
    const objectivePlural = goal === 1 || /s$/i.test(objectiveName) ? objectiveName : objectiveName + "s";
    const worldLabel = String((visualConfig(project, "game-scene", { world: "the world" }).world || map.regions || "the world"));
    const movementSpeed = Math.max(65, Math.min(360, (Number(player.movementSpeed) || 2.2) * 84));
    const nearbyMessage = influenceValue(npcNode, "player_nearby", "say_message", npc ? "Hello from " + (npc.name || "your guide") + "." : "");
    const completedMessage = influenceValue(npcNode, "task_completed", "say_message", "The mission goal is complete. No score was uploaded.");
    const collectedMessage = influenceValue(objectNode, "collected", "show_message", objectiveName + " gathered.");
    const npcColor = npc ? safeColor(npc.color || "#ff9889") : "#ff9889";
    return {
      body: `
        <header class="shell top"><div class="mark"><i>◇</i>${escapeHtml(project.name)}</div><span class="tag">SINGLE-DEVICE BETA RUNTIME</span></header>
        <main class="shell game-shell"><section class="game-head"><div><span>PLAYABLE LOCAL PROOF · ${escapeHtml(biome.toUpperCase())}</span><h1>${escapeHtml(visualConfig(project, "hud", { title: project.name }).title || project.name)}</h1></div><div class="mission-readout"><article><span>${escapeHtml(objectivePlural.toUpperCase().slice(0, 20))}</span><b id="score">0 / ${goal}</b></article><article><span>TIME</span><b id="time">${missionSeconds}</b></article><article><span>STATUS</span><b id="status">READY</b></article></div></section><section class="game-frame"><canvas id="game" width="960" height="580" aria-label="Playable top-down collection game"></canvas><div class="game-message" id="gameMessage" aria-live="polite"></div><div class="game-overlay" id="intro"><div><span class="mini">ARROW KEYS · WASD · TOUCH</span><h2>Collect ${goal} ${escapeHtml(objectivePlural.toLowerCase())}</h2><p>Move ${escapeHtml(player.name || "the player")} through ${escapeHtml(worldLabel)} before time runs out.</p><button id="startGame">Start mission</button></div></div><div class="touch-controls"><button data-key="up" aria-label="Move up">↑</button><button data-key="left" aria-label="Move left">←</button><button data-key="down" aria-label="Move down">↓</button><button data-key="right" aria-label="Move right">→</button></div></section><p class="runtime-note"><span class="dot"></span>Guided per-block reactions may run here as structured local rules. Advanced code-hook drafts remain saved but never execute in this beta.</p></main>
        <footer class="shell footer"><span>Local canvas · supported guided rules may run · code drafts never run</span><span>Generated by AXM Shapeable Builder ${escapeHtml(APP_VERSION)}</span></footer>`,
      style: `
        .game-shell{padding-top:26px}.game-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:13px}.game-head>div>span{color:var(--accent);font:800 8px ui-monospace,monospace;letter-spacing:.17em}.game-head h1{margin:5px 0 0;font-size:clamp(30px,4vw,49px);letter-spacing:-.05em}.mission-readout{display:flex;gap:6px}.mission-readout article{min-width:98px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}.mission-readout span,.mission-readout b{display:block}.mission-readout span{margin-bottom:4px;color:var(--muted);font:7px ui-monospace,monospace;letter-spacing:.1em}.mission-readout b{font:800 13px ui-monospace,monospace}.game-frame{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 25%,var(--line));border-radius:17px;background:#07151a;box-shadow:0 25px 70px rgba(0,0,0,.35)}canvas{display:block;width:100%;height:auto;max-height:calc(100vh - 255px);min-height:380px;object-fit:contain;touch-action:none}.game-message{position:absolute;left:50%;top:14px;z-index:3;max-width:min(620px,calc(100% - 30px));padding:9px 13px;border:1px solid rgba(255,255,255,.2);border-radius:10px;color:#efffff;background:rgba(5,18,23,.86);font-size:12px;line-height:1.45;opacity:0;pointer-events:none;transform:translate(-50%,-8px);transition:opacity .2s,transform .2s}.game-message.visible{opacity:1;transform:translate(-50%,0)}.game-overlay{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:rgba(3,9,12,.75);backdrop-filter:blur(7px);transition:opacity .25s}.game-overlay.hidden{opacity:0;pointer-events:none}.game-overlay>div{max-width:440px;padding:28px;border:1px solid var(--line);border-radius:17px;background:rgba(9,22,29,.93);text-align:center;box-shadow:0 25px 70px rgba(0,0,0,.4)}.mini{color:var(--accent);font:800 8px ui-monospace,monospace;letter-spacing:.13em}.game-overlay h2{margin:10px 0 8px;font-size:28px}.game-overlay p{margin:0 0 19px;color:var(--muted);font-size:12px;line-height:1.55}.game-overlay button{min-height:43px;padding:0 20px;border:1px solid color-mix(in srgb,var(--accent) 65%,white 10%);border-radius:10px;color:#071019;background:var(--accent);font-weight:850;cursor:pointer}.touch-controls{position:absolute;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,42px);grid-template-rows:repeat(2,42px);gap:4px}.touch-controls button{border:1px solid rgba(255,255,255,.2);border-radius:9px;color:#fff;background:rgba(3,12,17,.7);font-size:18px;backdrop-filter:blur(4px);touch-action:none}.touch-controls button[data-key=up]{grid-column:2}.touch-controls button[data-key=left]{grid-column:1;grid-row:2}.touch-controls button[data-key=down]{grid-column:2;grid-row:2}.touch-controls button[data-key=right]{grid-column:3;grid-row:2}.runtime-note{display:flex;align-items:center;gap:5px;margin:10px 3px 0;color:var(--muted);font-size:9px;line-height:1.45}@media(max-width:760px){.game-head{align-items:flex-start;flex-direction:column}.mission-readout{width:100%}.mission-readout article{min-width:0;flex:1}.game-overlay>div{padding:20px}.game-overlay h2{font-size:23px}canvas{min-height:360px}.runtime-note{align-items:flex-start}}
      `,
      script: `
        const C=document.getElementById("game"),X=C.getContext("2d"),W=C.width,H=C.height,keys={},goal=${goal},duration=${missionSeconds},P=${JSON.stringify(palette)},objective=${JSON.stringify(objectivePlural)},moveSpeed=${movementSpeed},nearbyMessage=${JSON.stringify(nearbyMessage)},completedMessage=${JSON.stringify(completedMessage)},collectedMessage=${JSON.stringify(collectedMessage)},npcData=${JSON.stringify(npc ? { name: String(npc.name || "Guide"), color: npcColor, x: 245, y: 300 } : null)};
        let player={x:95,y:H/2,r:14,color:${JSON.stringify(safeColor(player.color || accent))}},parcels=[],score=0,time=duration,running=false,last=0,second=0,won=false,npcNearby=false,messageTimer=0;
        const roads=[{x:0,y:235,w:W,h:110},{x:410,y:0,w:125,h:H},{x:0,y:72,w:W,h:72}],buildings=[{x:28,y:18,w:155,h:46,c:P.buildings[0]},{x:210,y:18,w:166,h:46,c:P.buildings[1]},{x:566,y:18,w:150,h:46,c:P.buildings[2]},{x:744,y:18,w:180,h:46,c:P.buildings[0]},{x:25,y:365,w:205,h:165,c:P.buildings[1]},{x:265,y:382,w:112,h:146,c:P.buildings[2]},{x:570,y:368,w:160,h:160,c:P.buildings[0]},{x:770,y:372,w:160,h:155,c:P.buildings[1]}];
        function showMessage(text,seconds=2.4){if(!text)return;const el=document.getElementById("gameMessage");el.textContent=text;el.classList.add("visible");messageTimer=seconds}
        function reset(){player.x=95;player.y=H/2;score=0;time=duration;won=false;npcNearby=false;messageTimer=0;document.getElementById("gameMessage").classList.remove("visible");parcels=[];for(let i=0;i<goal+2;i++)spawn();updateHud()}
        function spawn(){let p;do{p={x:55+Math.random()*(W-110),y:95+Math.random()*(H-140),r:10}}while(buildings.some(b=>p.x>b.x-15&&p.x<b.x+b.w+15&&p.y>b.y-15&&p.y<b.y+b.h+15));parcels.push(p)}
        function updateHud(){document.getElementById("score").textContent=score+" / "+goal;document.getElementById("time").textContent=Math.ceil(time);document.getElementById("status").textContent=won?"COMPLETE":running?"ACTIVE":"READY"}
        function start(){reset();running=true;last=performance.now();second=0;document.getElementById("intro").classList.add("hidden");updateHud();requestAnimationFrame(loop)}
        function collides(nx,ny){return buildings.some(b=>nx+player.r>b.x&&nx-player.r<b.x+b.w&&ny+player.r>b.y&&ny-player.r<b.y+b.h)}
        function finish(success){running=false;won=success;updateHud();if(success)showMessage(completedMessage,4);const intro=document.getElementById("intro"),box=intro.querySelector("div");intro.classList.remove("hidden");box.querySelector(".mini").textContent=success?"MISSION COMPLETE · LOCAL RESULT":"TIME EXPIRED · TRY AGAIN";box.querySelector("h2").textContent=success?"All "+objective.toLowerCase()+" secured":"The world keeps moving";box.querySelector("p").textContent=success?completedMessage:"Restart when you are ready. The project remains entirely local.";box.querySelector("button").textContent="Play again"}
        function loop(t){if(!running)return;const dt=Math.min(.035,(t-last)/1000);last=t;let dx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),dy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);if(dx||dy){const len=Math.hypot(dx,dy),nx=player.x+dx/len*moveSpeed*dt,ny=player.y+dy/len*moveSpeed*dt;if(!collides(nx,player.y))player.x=Math.max(player.r,Math.min(W-player.r,nx));if(!collides(player.x,ny))player.y=Math.max(player.r,Math.min(H-player.r,ny))}if(npcData){const near=Math.hypot(player.x-npcData.x,player.y-npcData.y)<88;if(near&&!npcNearby)showMessage(nearbyMessage,3.2);npcNearby=near}for(let i=parcels.length-1;i>=0;i--){if(Math.hypot(player.x-parcels[i].x,player.y-parcels[i].y)<player.r+15){parcels.splice(i,1);score++;showMessage(collectedMessage,1.2);if(score<goal)spawn();updateHud();if(score>=goal){finish(true);draw();return}}}if(messageTimer>0){messageTimer-=dt;if(messageTimer<=0)document.getElementById("gameMessage").classList.remove("visible")}time-=dt;if(time<=0){time=0;finish(false);draw();return}draw(t);requestAnimationFrame(loop)}
        function draw(t=0){X.clearRect(0,0,W,H);X.fillStyle=P.ground;X.fillRect(0,0,W,H);for(let x=0;x<W;x+=32)for(let y=0;y<H;y+=32){X.fillStyle=(x/32+y/32)%2?P.tileA:P.tileB;X.fillRect(x,y,32,32)}roads.forEach(r=>{X.fillStyle=P.road;X.fillRect(r.x,r.y,r.w,r.h);X.strokeStyle="rgba(255,255,255,.13)";X.setLineDash([18,18]);X.beginPath();if(r.w>r.h){X.moveTo(r.x,r.y+r.h/2);X.lineTo(r.x+r.w,r.y+r.h/2)}else{X.moveTo(r.x+r.w/2,r.y);X.lineTo(r.x+r.w/2,r.y+r.h)}X.stroke();X.setLineDash([])});buildings.forEach((b,i)=>{X.fillStyle="rgba(0,0,0,.22)";X.fillRect(b.x+7,b.y+8,b.w,b.h);X.fillStyle=b.c;X.fillRect(b.x,b.y,b.w,b.h);X.strokeStyle="rgba(255,255,255,.12)";X.strokeRect(b.x+.5,b.y+.5,b.w-1,b.h-1);X.fillStyle=i%2?"#f1b45f":"#55c1bd";for(let wx=b.x+18;wx<b.x+b.w-12;wx+=34){X.globalAlpha=.35;X.fillRect(wx,b.y+14,13,8);X.globalAlpha=1}});for(let i=0;i<22;i++){const tx=(i*149)%W,ty=(i*83+180)%H;if(!roads.some(r=>tx>r.x&&tx<r.x+r.w&&ty>r.y&&ty<r.y+r.h)){X.fillStyle=P.treeA;X.beginPath();X.arc(tx,ty,9,0,Math.PI*2);X.fill();X.fillStyle=P.treeB;X.beginPath();X.arc(tx-2,ty-3,7,0,Math.PI*2);X.fill()}}parcels.forEach((p,i)=>{const bob=Math.sin(t/240+i)*2;X.save();X.translate(p.x,p.y+bob);X.rotate(Math.PI/4);X.fillStyle=P.collectible;X.shadowColor=P.collectible;X.shadowBlur=15;X.fillRect(-8,-8,16,16);X.shadowBlur=0;X.strokeStyle="#fff8d7";X.strokeRect(-8,-8,16,16);X.restore()});if(npcData){X.fillStyle="rgba(0,0,0,.25)";X.beginPath();X.ellipse(npcData.x+3,npcData.y+10,16,8,0,0,Math.PI*2);X.fill();X.fillStyle=npcData.color;X.beginPath();X.arc(npcData.x,npcData.y,14,0,Math.PI*2);X.fill();X.strokeStyle="#fff";X.stroke();X.fillStyle="#061019";X.beginPath();X.arc(npcData.x+4,npcData.y-3,3,0,Math.PI*2);X.fill();X.fillStyle="#efffff";X.font="700 10px ui-monospace,monospace";X.textAlign="center";X.fillText(npcData.name,npcData.x,npcData.y-24)}X.fillStyle="rgba(0,0,0,.28)";X.beginPath();X.ellipse(player.x+3,player.y+10,16,8,0,0,Math.PI*2);X.fill();X.fillStyle=player.color;X.shadowColor=player.color;X.shadowBlur=15;X.beginPath();X.arc(player.x,player.y,player.r,0,Math.PI*2);X.fill();X.shadowBlur=0;X.strokeStyle="#efffff";X.lineWidth=2;X.stroke();X.fillStyle="#061019";X.beginPath();X.arc(player.x+4,player.y-3,3,0,Math.PI*2);X.fill()}
        addEventListener("keydown",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=true;if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(k))e.preventDefault()});addEventListener("keyup",e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=false});document.querySelectorAll("[data-key]").forEach(b=>{const map={up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight"},k=map[b.dataset.key];b.addEventListener("pointerdown",e=>{e.preventDefault();keys[k]=true;b.setPointerCapture(e.pointerId)});b.addEventListener("pointerup",()=>keys[k]=false);b.addEventListener("pointercancel",()=>keys[k]=false)});document.getElementById("startGame").addEventListener("click",start);reset();draw();
      `
    };
  }

  function generateStandaloneHTML(project) {
    const accent = safeColor(project.accent);
    let build;
    if (project.target === "game") build = gameBuild(project, accent);
    else if (project.target === "dashboard") build = dashboardBuild(project, accent);
    else build = websiteBuild(project, accent);
    const sourceSummary = JSON.stringify({ schema: project.schema, schemaVersion: project.schemaVersion, projectId: project.id, sourceUpdatedAt: project.meta.updatedAt, target: project.target }).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#061019"><title>${escapeHtml(project.name)}</title><style>${sharedStandaloneStyles(accent)}${build.style}</style></head>
<body>${build.body}<script>"use strict";window.AXM_PROJECT_SOURCE=${sourceSummary};${build.script}<\/script></body></html>`;
  }

  function projectSnapshot(project) {
    const snapshot = clone(project);
    snapshot.meta.updatedAt = now();
    return snapshot;
  }

  window.AXMBuilderModel = {
    APP_VERSION: APP_VERSION,
    SCHEMA: SCHEMA,
    SCHEMA_VERSION: SCHEMA_VERSION,
    LAYERS: LAYERS,
    TARGETS: TARGETS,
    BLOCKS: BLOCKS,
    TEMPLATES: TEMPLATES,
    CONTRACT_ONLY_CAPABILITIES: CONTRACT_ONLY_CAPABILITIES,
    INFLUENCE_SCHEMA_VERSION: INFLUENCE_SCHEMA_VERSION,
    INFLUENCE_MODULES: INFLUENCE_MODULES,
    MAX_INFLUENCE_RULES: MAX_INFLUENCE_RULES,
    MAX_CODE_HOOKS: MAX_CODE_HOOKS,
    icon: icon,
    uid: uid,
    now: now,
    clone: clone,
    createNode: createNode,
    createInfluenceRule: createInfluenceRule,
    createBaseProject: createBaseProject,
    getDefinition: getDefinition,
    getTemplate: getTemplate,
    findNode: findNode,
    nodeLayer: nodeLayer,
    allNodes: allNodes,
    bindingCount: bindingCount,
    getInfluenceModule: getInfluenceModule,
    getInfluenceProfile: getInfluenceProfile,
    defaultInfluence: defaultInfluence,
    normalizeInfluence: normalizeInfluence,
    influenceRuleSentence: influenceRuleSentence,
    simulateInfluence: simulateInfluence,
    generateBlockAssetRequest: generateBlockAssetRequest,
    validateProject: validateProject,
    normalizeProject: normalizeProject,
    validateBlockPack: validateBlockPack,
    registerBlockPack: registerBlockPack,
    unregisterBlockPack: unregisterBlockPack,
    getRegisteredPacks: getRegisteredPacks,
    blockPackTemplate: blockPackTemplate,
    agentActionProtocol: agentActionProtocol,
    generateAgentWorkspace: generateAgentWorkspace,
    agentProposalTemplate: agentProposalTemplate,
    validateAgentProposal: validateAgentProposal,
    applyAgentProposal: applyAgentProposal,
    generateAiIntentPacket: generateAiIntentPacket,
    generateEngineHandoff: generateEngineHandoff,
    generateStandaloneHTML: generateStandaloneHTML,
    projectSnapshot: projectSnapshot,
    slugify: slugify,
    escapeHtml: escapeHtml,
    safeColor: safeColor
  };
})();
