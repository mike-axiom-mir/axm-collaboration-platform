# Sharing and Future Hosting

## Available now

- Export one portable `.axmskin.json` file.
- Import a shared `.axmskin.json` file.
- Save validated packs to a local browser library.
- Preserve creator, license choice, remix permission, provenance, and integrity metadata.

No network upload or public gallery is implemented in this package.

## Future provider seam

A hosted provider should remain a separate body with its own manifest, permissions, logs, stop switch, and moderation policy. The provider receives a validated package and must return a receipt. It may not rewrite the local source pack silently.

Minimum operations:

- `publish(pack, consent)`
- `fetch(packId, version)`
- `list(query)`
- `report(packId, reason)`
- `withdraw(packId, consent)`

## Suggested hosted limits

The included `hosted-policy.example.json` shows a stricter public-host policy without weakening local creation:

- smaller file and asset limits;
- raster-only assets;
- no remote references or executable content;
- required attribution/license declaration;
- quarantine before listing;
- content and accessibility checks;
- immutable version hash;
- withdrawal and report routes.

Local freedom and public-host responsibility therefore remain separate instead of one silently controlling the other.
