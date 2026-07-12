# AXM ChatGPT Connector

This TEST module gives ChatGPT and Codex two honest, separate seats in AXM.

## Coding seat

The Coding Seat reads `GET /api/chatgpt-connector/status` and shows only facts the local server has proved: Codex installation, CLI accessibility, sign-in verification, and the separate ChatGPT app-open signal. It does not guess the sign-in method, run prompts, or inspect credentials.

An open desktop process is not called a live ChatGPT platform connection. The screen shows **MANUAL HANDOFF** unless the status response explicitly proves a connected MCP/platform tunnel.

## Generator Bay

1. Choose a real installed game reported by Game Hub and describe one asset or skin.
2. Copy the generated prompt.
3. Open ChatGPT and create the image in a normal visible conversation.
4. Save the returned image as PNG.
5. Drop or choose that PNG in Generator Bay.
6. Press **Stage proposal for Game Hub**.

The browser sends an `axm.game-asset/v1` packet to `/game-api/assets/handoff` with:

- `source_module: "chatgpt-connector"`
- `status: "proposal"`
- `automatic_accept: false`

Game files are not changed at this point. The user still has to review and accept the proposal in Game Hub.

## Boundaries

- No OpenAI API key is requested or stored.
- No ChatGPT cookies, tokens, credential files, or conversation history are read.
- No prompt is silently injected into the desktop app.
- No generated image is scraped from ChatGPT.
- Only real PNG files up to 6 MiB are staged. The browser must decode the PNG successfully; requested and actual dimensions are shown before staging.
- The module never claims that selecting a file installs it into a game.

The installed ChatGPT app registers a launch protocol, but there is no documented local prompt/image-generation API. This module therefore opens `https://chatgpt.com` and keeps the transfer human-visible.

## Self-test

```powershell
node selftest.js
```
