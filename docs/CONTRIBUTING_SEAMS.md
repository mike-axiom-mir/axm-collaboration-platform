# Adding an AXM tool without breaking its seams

As of 2026-07-23, use `tools/_module-template/` as the source template.

1. Copy the template into a lowercase hyphenated folder and set `manifest.id` to that exact folder name. Legacy `folderAlias` is compatibility evidence, not a pattern for new tools.
2. Declare `kind`, `uses`, and `permissions` explicitly. An empty array is an explicit refusal; a missing field is unknown.
3. Define `module.contract.json`: provides, consumes, permissions, handoffs, writes, refusals, and lifecycle behavior.
4. Build the real owner. Do not add a wrapper whose only purpose is to make a checklist green.
5. Add an executable top-level `selftest.js`, including negative paths proportionate to risk. Add `discovery-seam-review.js` when the tool participates in a parent, registry, provider, or handoff seam.
6. Keep `verifiedAt` null until the current source has passed its declared proof route. Visual or interactive claims require live visual evidence; source inspection alone is insufficient.
7. Run `npm run test:readiness`, `npm run index:tools:verify`, the owner’s focused tests, and finally `npm test` at a stable checkpoint.
8. Review the generated `tools-index.json`. Promotion remains a human decision; CANON always requires Mike’s merge gate.

Shared seams—`package.json`, `server.js`, Hub registries, schemas, contracts, and generated indexes—must be re-read immediately before and after editing. Preserve unrelated local work.
