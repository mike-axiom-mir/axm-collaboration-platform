# Workshop Update Gate

Open `/tools/workshop-updater/index.html` through the local Hub. The module is installed in `TEST` state and remains off by default.

The UI can explicitly enable Heartbeat-gated GitHub checks, choose `CHECK_ONLY` or `AUTO_STAGE`, and inspect receipts. It deliberately exposes the missing whole-Workshop installer as a held fourth gate instead of presenting staged bytes as an installed update.

Implementation and trust details live in `shared/workshop-updater/README.md`.
