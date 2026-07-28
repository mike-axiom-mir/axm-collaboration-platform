# Optional Playwright screenshot integration

The browser workshop has no package dependency. `tools/visual_smoke.py` is an optional evidence harness.

It requires:

```bash
pip install playwright
playwright install chromium
```

Then run:

```bash
python tools/visual_smoke.py
```

The included harness bundles the local HTML, CSS and JavaScript in memory. This avoids network dependence and captures desktop/mobile screenshots plus console and page errors.

In the real AXM repository, stabilize dates, random content, animation and data before approving baselines. Keep intentional baseline changes reviewable and tied to a visual change packet.
