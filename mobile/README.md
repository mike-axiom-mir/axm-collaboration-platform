# AXM phone host

The Android adapter runs the real modular Workshop through Node.js in Termux.
It is not a flattened webpage and it does not replace the PC launcher.

- `start-axm-phone.sh run` starts Hub, Bridge, and Game Hub.
- `start-axm-phone.sh status` shows what survived Android backgrounding.
- `start-axm-phone.sh stop` stops only those three AXM phone processes.
- The Hub stays local at `127.0.0.1:8788`; the multiplayer runtime listens on
  port `8789` so trusted devices on the same Wi-Fi can join game sessions.
- Windows-only actions remain visible but may report that their host capability
  is unavailable. Project files, modules, assets, gates, and local profile state
  are otherwise preserved.

The one-file builder is `tools/workshop-packager/build-mobile-self-extracting.ps1`.
It excludes recursive exports, logs, repository metadata, and live credentials;
those are not Workshop capabilities and copying them into a transferable script
would be unsafe. Existing phone `state` and `saves` survive an updated bundle.
