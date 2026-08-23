# Deterministic Organ Fabric

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
