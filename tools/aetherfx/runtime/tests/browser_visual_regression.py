#!/usr/bin/env python3
"""Offline visual regression check for the bundled AXM AetherFX studio.

The page is injected directly into Chromium, all motion and dynamic status text are
frozen, and a deterministic desktop screenshot is compared with a checked-in
baseline. This is a visual guard, not a claim of pixel parity across OS/browser builds.
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist" / "AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html"
BASELINE = ROOT / "reports" / "baselines" / "studio_desktop_v1_3_0.png"
CURRENT = ROOT / "reports" / "studio_visual_regression_v1_3_0_current.png"
REPORT = ROOT / "reports" / "VISUAL_REGRESSION.json"

STORAGE_STUB = """(() => {
  const s = new Map();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: k => s.has(String(k)) ? s.get(String(k)) : null,
    setItem: (k,v) => s.set(String(k), String(v)), removeItem: k => s.delete(String(k)),
    clear: () => s.clear(), key: i => [...s.keys()][i] ?? null,
    get length(){ return s.size; }
  }});
})();"""

FREEZE_CSS = """
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
#fpsStatus,#autosaveStatus,#toastRegion{visibility:hidden!important}
"""


def capture(chromium: str) -> None:
    html = DIST.read_text(encoding="utf-8")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=chromium, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page.evaluate(STORAGE_STUB)
        page.set_content(html, wait_until="load")
        page.wait_for_selector('html[data-axm-ready="true"]')
        page.wait_for_selector('#previewStage[data-ready="true"]')
        page.add_style_tag(content=FREEZE_CSS)
        page.evaluate("""() => {
          const q=document.querySelector('#qualitySelect'); q.value='high'; q.dispatchEvent(new Event('change',{bubbles:true}));
          const r=document.querySelector('#toggleReducedMotion'); r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true}));
          document.querySelectorAll('#toastRegion > *').forEach(n=>n.remove());
        }""")
        page.wait_for_timeout(180)
        page.screenshot(path=str(CURRENT), full_page=False)
        browser.close()


def compare() -> dict:
    baseline = Image.open(BASELINE).convert("RGB")
    current = Image.open(CURRENT).convert("RGB")
    if baseline.size != current.size:
        return {"passed": False, "reason": "dimension mismatch", "baselineSize": baseline.size, "currentSize": current.size}
    diff = ImageChops.difference(baseline, current)
    stat = ImageStat.Stat(diff)
    mean_abs = sum(stat.mean) / len(stat.mean)
    pixels = baseline.width * baseline.height
    changed = sum(1 for px in diff.convert("L").tobytes() if px > 18)
    changed_ratio = changed / pixels
    # Deliberately tolerant of minor Chromium rasterization differences.
    passed = mean_abs <= 2.4 and changed_ratio <= 0.035
    return {
        "passed": passed,
        "meanAbsoluteDifference": round(mean_abs, 4),
        "changedPixelRatioOver18": round(changed_ratio, 6),
        "thresholds": {"meanAbsoluteDifference": 2.4, "changedPixelRatioOver18": 0.035},
        "baseline": str(BASELINE.relative_to(ROOT)),
        "current": str(CURRENT.relative_to(ROOT)),
        "scope": "same-environment regression guard; not cross-platform pixel parity"
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    parser.add_argument("--update-baseline", action="store_true")
    args = parser.parse_args()
    BASELINE.parent.mkdir(parents=True, exist_ok=True)
    capture(args.chromium)
    if args.update_baseline or not BASELINE.exists():
        shutil.copy2(CURRENT, BASELINE)
        result = {"version": "1.3.0", "passed": True, "baselineUpdated": True, "baseline": str(BASELINE.relative_to(ROOT))}
    else:
        result = compare()
        result["version"] = "1.3.0"
        result["baselineUpdated"] = False
    REPORT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result.get("passed"):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
