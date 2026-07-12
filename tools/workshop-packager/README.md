# Workshop Packager

Creates timestamped archives under `exports/workshop-packages`.

## Full local backup

Copies the current Workshop except the `exports` folder, adds a SHA-256 package manifest, and creates a ZIP. Treat this archive as private: it may contain local logs, backups, or access tokens.

## Public-safe package

Excludes exports, backups, logs, saves, live runtime state, local Claude/Grok settings, repository metadata, dependency folders, `bridge-token.txt`, environment files, private-key formats, private preview files, and private-labelled reports. Runtime state includes guardian events, collaboration notices, and shared-vision screenshots. It then scans remaining text files for common private-key and API-key patterns. Any finding refuses and removes the ZIP; the refusal report contains paths and rule names, never secret values.

Neither mode uploads, publishes, or modifies the source Workshop. An unpacked copy can optionally be retained beside the ZIP.

## AI-native restore maintenance

Every newly created archive is restored into a temporary folder under
`exports/workshop-packages/.restore-tests`, checked against its SHA-256 manifest,
run through the AXM verifier, and started briefly on a temporary local port. A
`*.RESTORE_TEST.json` evidence file is saved beside the ZIP and the temporary
copy is removed. This maintenance is automatic; it adds no extra user step.
