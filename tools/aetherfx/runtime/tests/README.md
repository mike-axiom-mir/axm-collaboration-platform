# Tests

`npm test` runs the dependency, composer, package-integrity, import-protection, example, and bundle tests without installing third-party packages.

The v1.3 browser proofs are optional and are intentionally not installed automatically. In Codex Work Mode they use the primary runtime. Elsewhere, install Playwright and its Chromium build plus `pngjs` and `pixelmatch`, then run:

```bash
npm install --no-save playwright pngjs pixelmatch
npx playwright install chromium
npm run browser:smoke
npm run browser:regression
```

The smoke proof checks desktop and phone layouts, local-only networking, computed photosensitive-safe suppression, a real support-report download, and keyboard focus. The visual regression guard freezes motion and dynamic status text before comparing a fixed 1600×1000 capture with the checked-in v1.3 baseline.

Python equivalents remain available for environments that already have Python Playwright, Pillow, and Chromium:

```text
python tests/browser_smoke_full.py --chromium /usr/bin/chromium
python tests/browser_visual_regression.py --chromium /usr/bin/chromium
```

Browser evidence is same-environment proof, not cross-browser or native-engine pixel parity.
