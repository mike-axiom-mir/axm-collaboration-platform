# Visual Handshake command reference

Run commands through the shared launcher:

```text
python scripts/handshake.py latest-from-mike
python scripts/handshake.py send-to-mike --file "C:\path\visual.png" --title "Preview" --note "Look at the header"
python scripts/handshake.py snapshot-url "http://127.0.0.1:3000" --title "Live app" --note "Current local build"
python scripts/handshake.py note-to-mike --text "The build is waiting for your choice" --title "Decision needed"
python scripts/handshake.py status
python scripts/handshake.py open-dashboard --mode capture
python scripts/handshake.py open-dashboard --mode latest
python scripts/handshake.py stop
```

Supported publish types are PNG, JPEG, WEBP, GIF, safe SVG, static sandboxed HTML, TXT, Markdown, JSON, and LOG.

Remote URL screenshots are blocked by default. `--allow-network` expands authority and may be used only after Mike asks for that exact remote page.

