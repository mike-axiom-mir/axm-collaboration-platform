# AXM Shared Engines

This directory is infrastructure, not a Hub destination. It contains the ten
reusable mechanics that should not be rebuilt inside every creative workspace.

Load `axm-shared-engines.js` in a browser or `require()` it from Node. The
bundle exposes `AXMEngines.Project`, `Asset`, `Scene`, `Timeline`, `NodeGraph`,
`Renderer`, `Physics`, `Collaboration`, `Evidence`, `Exporter`, and `AIAction`.

The registry is version 1.1 and forwards each resolved capability name to its
adapter. The first real Physics implementation lives in
`../physics/axm-physics-core.js`; workspaces register it through
`../physics/axm-physics-adapter.js` instead of copying solver code.

The bundle deliberately does not decide what a game object, film effect,
research claim, audio clip, or Studio layer means. Each workspace keeps its own
versioned document schema and uses the shared engine only for common mechanics.

Adoption is incremental. A workspace may keep its existing document while
placing it inside `Project.data`, then migrate its own timeline or graph when a
real compatibility adapter exists. No automatic rewrite is allowed.
