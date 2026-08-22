# AXM AI Seat Courier

Status: **accept for test**.

AI Seat Courier gives a sandboxed AI a bounded way to playtest local AXM games when it can read and write the D drive but cannot reach Windows localhost.

It is deliberately not a public tunnel. A small local Node process watches a shared-file mailbox, launches only registered Game Hub manifests, opens the game in headless Microsoft Edge, and returns compact JSON receipts and PNG screenshots.

## What it can do

- launch a registered Game Hub game by `game_id` or slot;
- click a CSS selector in the real rendered page;
- hold one allowed keyboard/game key for a bounded duration;
- call `GET` or `POST` on the active game's own localhost origin;
- return an accessibility-tree snapshot;
- capture a real PNG frame;
- stop the browser and any game server it started.

The courier cannot run arbitrary shell commands, navigate to remote sites, call another localhost service, read arbitrary files, expose a public listener, or record growing video.

## Start and stop

Double-click `START_AI_SEAT_COURIER.cmd`. The helper runs hidden and writes status to:

`<AXM_WORKSHOP>\state\ai-seat-courier\status.json`

Double-click `STOP_AI_SEAT_COURIER.cmd` to stop the active browser, owned game server, and courier cleanly.

The outbox retains only the latest 50 receipts; captures retain only the latest 20 PNGs. Inbox requests are removed after processing.

## Two complementary routes

1. **Claude in Chrome** is the best route when Sonnet must inspect the exact visible browser tab Mike opened.
2. **AI Seat Courier** is the deterministic fallback when the Sonnet/Cowork sandbox can edit D but cannot access localhost or the browser extension.

Games with `/api/adapter-observation` and `/api/input` expose both semantic state and input. Other registered browser games can still be tested through screenshots, selectors, and keyboard input.

See `SONNET_START_HERE.md` for the mailbox protocol.
