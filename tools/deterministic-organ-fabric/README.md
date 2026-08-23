# Deterministic Organ Fabric

This workbench remains the specialized three-strategy organ surface. The
broader `tools/capability-fabric` front door reuses its deterministic kernel for
exact recipe builds across code, creation hands, and contract adapters.

`EXPERIMENTAL` additive factory for pure, bounded JSON-in/JSON-out organs. The normal path is deterministic and needs no AI, network, API key, provider, model, randomness, install, promotion, or Foundation mutation.

CLI:

```text
node tools/deterministic-organ-fabric/cli.js validate --intent <file>
node tools/deterministic-organ-fabric/cli.js generate --intent <file> --output-parent <existing-dir> --archive-root <existing-dir>
node tools/deterministic-organ-fabric/cli.js compare --run <generated-run-dir>
node tools/deterministic-organ-fabric/cli.js archive list|verify|revalidate --archive-root <dir>
node tools/deterministic-organ-fabric/cli.js archive export|import --archive-root <dir> --pack <file>
```

Every generated candidate starts detached with `installed`, `registered`, `staged`, `promoted`, and `canonChanged` set to `false`. A score is advisory. Mike's selection receipt applies nothing and promotes nothing.
