#!/usr/bin/env python3
"""Playwright evidence runner for AXM Aetherglass v7.
Local assets are inlined before loading; runtime network requests must remain zero.
Requires Python Playwright and Chromium. AXM_CHROMIUM may override discovery.
"""
from __future__ import annotations
import json, os, re, shutil, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("AXM_VALIDATION_OUT", ROOT / "validation")).resolve()
VERSION = "7.1.0"


def chromium_path(playwright) -> str | None:
    override = os.environ.get("AXM_CHROMIUM")
    candidates = [
        override,
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        playwright.chromium.executable_path,
    ]
    return next((value for value in candidates if value and Path(value).is_file()), None)


def inline_html(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    def css(match: re.Match[str]) -> str:
        content = (path.parent / match.group(1)).resolve().read_text(encoding="utf-8")
        return f"<style>\n{content}\n</style>"
    def js(match: re.Match[str]) -> str:
        content = (path.parent / match.group(1)).resolve().read_text(encoding="utf-8").replace("</script", "<\\/script")
        return f"<script>\n{content}\n</script>"
    text = re.sub(r'<link\s+rel=["\']stylesheet["\']\s+href=["\']([^"\']+)["\']\s*/?>', css, text, flags=re.I)
    text = re.sub(r'<script\s+src=["\']([^"\']+)["\']\s*>\s*</script>', js, text, flags=re.I)
    return text


def browser_page(browser, viewport):
    page = browser.new_page(viewport=viewport)
    signals = {"pageErrors": [], "console": [], "runtimeRequests": []}
    page.on("pageerror", lambda error: signals["pageErrors"].append(str(error)))
    page.on("console", lambda message: signals["console"].append({"type": message.type, "text": message.text}) if message.type in ("warning", "error") else None)
    page.on("request", lambda request: signals["runtimeRequests"].append(request.url) if not request.url.startswith(("data:", "blob:")) else None)
    return page, signals


def run_test(browser, relative: str, global_name: str, viewport: dict) -> dict:
    page, signals = browser_page(browser, viewport)
    page.set_content(inline_html(ROOT / relative), wait_until="load")
    page.wait_for_function(f"window.{global_name}?.completed === true", timeout=90000)
    result = page.evaluate(f"window.{global_name}")
    widths = page.evaluate("({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})")
    page.close()
    return {**result, **signals, "widths": widths}


def export_state(page) -> dict:
    page.evaluate("document.querySelector('#exportTop').click()")
    page.wait_for_timeout(60)
    value = page.locator("#configOutput").input_value()
    page.evaluate("document.querySelector('#configDialog').close?.()")
    return json.loads(value)


def click_and_wait_button(page, selector: str, timeout: int = 20000) -> None:
    page.evaluate(f"document.querySelector({selector!r}).click()")
    page.wait_for_function(f"!document.querySelector({selector!r}).disabled", timeout=timeout)


def run_demo(browser, viewport: dict, name: str) -> dict:
    page, signals = browser_page(browser, viewport)
    page.set_content(inline_html(ROOT / "demo/index.html"), wait_until="load")
    page.wait_for_timeout(650)
    initial = export_state(page)

    page.evaluate("document.querySelector('#previewBlueprint').click()")
    preview = {
        "score": page.locator("#contractScore").inner_text(),
        "grade": page.locator("#contractGrade").inner_text(),
        "fingerprint": page.locator("#contractFingerprint").inner_text(),
        "summary": page.locator("#contractSummary").inner_text(),
    }
    page.evaluate("document.querySelector('#captureVisualBaseline').click()")
    click_and_wait_button(page, "#applyBlueprint")
    applied_status = page.locator("#authoringStatus").inner_text()
    page.evaluate("document.querySelector('#compareVisualDrift').click()")
    drift_status = page.locator("#authoringStatus").inner_text()
    page.evaluate("document.querySelector('#restoreBlueprint').click()")
    restored_status = page.locator("#authoringStatus").inner_text()
    page.evaluate("document.querySelector('#recommendComposition').click()")
    recommendation_count = page.locator("#recommendationTrace > div").count()

    journey_preview = page.evaluate("window.axmDemo.journeys.preview('proof-path')")
    journey_start = page.evaluate("""async () => {
      const result = await window.axmDemo.journeys.start('proof-path', {approved:true, autoplay:false});
      return {started:result.started, state:window.axmDemo.journeys.getState(), focus:window.axmDemo.focus.getState()};
    }""")
    journey_stop = page.evaluate("window.axmDemo.journeys.stop('evidence',{restore:true})")
    capture_enter = page.evaluate("window.axmDemo.capture.enter('documentation',{approved:true,replace:true})")
    capture_exit = page.evaluate("window.axmDemo.capture.exit({reason:'evidence'})")

    stress = page.evaluate("""async () => await window.axmDemo.supervisor.stress({
      iterations:24,
      presets:['daily-workspace','deep-focus','creation-flow','review-proof','live-command','low-power'],
      restore:true
    })""")
    stress_status = f"{stress.get('completedIterations',0)}/{stress.get('requestedIterations',0)} switches completed; restored: {stress.get('restored')}"
    final = export_state(page)
    widths = page.evaluate("({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})")

    page.evaluate("document.querySelector('#storycraftLab').scrollIntoView({block:'start',behavior:'instant'})")
    page.wait_for_timeout(280)
    page.screenshot(path=str(OUT / f"AETHERGLASS_V7_1_{name}_STORYCRAFT.png"), full_page=False)
    page.evaluate("document.querySelector('#authoringLab').scrollIntoView({block:'start',behavior:'instant'})")
    page.wait_for_timeout(280)
    page.screenshot(path=str(OUT / f"AETHERGLASS_V7_1_{name}_AUTHORING.png"), full_page=False)
    page.evaluate("window.scrollTo({top:0,left:0,behavior:'instant'})")
    page.wait_for_timeout(280)
    page.screenshot(path=str(OUT / f"AETHERGLASS_V7_1_{name}.png"), full_page=False)

    payload = {
        **signals,
        "version": VERSION,
        "widths": widths,
        "initial": initial,
        "final": final,
        "preview": preview,
        "appliedStatus": applied_status,
        "driftStatus": drift_status,
        "restoredStatus": restored_status,
        "recommendationCount": recommendation_count,
        "journeyPreview": journey_preview,
        "journeyStart": journey_start,
        "journeyStopped": journey_stop,
        "captureEntered": bool(capture_enter.get("entered")),
        "captureExited": capture_exit,
        "stress": stress,
        "stressStatus": stress_status,
        "engineRestored": initial.get("engine") == final.get("engine"),
        "fieldRestored": initial.get("field") == final.get("field"),
        "luminousLayersRestored": initial.get("luminousLayers") == final.get("luminousLayers"),
        "authoringRestored": final.get("authoring", {}).get("compositionWorkbench", {}).get("active") is None,
        "storycraftRestored": final.get("storycraft", {}).get("journeyDirector", {}).get("active") is None and final.get("storycraft", {}).get("captureStudio", {}).get("active") is None and not final.get("storycraft", {}).get("focusDirector", {}).get("active"),
    }
    page.close()
    return payload


def clean_test(result: dict) -> bool:
    return (
        result.get("completed") is True
        and result.get("failed") == 0
        and result.get("passed") == result.get("total")
        and result.get("total", 0) > 0
        and not result.get("pageErrors")
        and not result.get("console")
        and not result.get("runtimeRequests")
        and not result.get("teardownErrors")
        and result.get("widths", {}).get("scroll", 1) <= result.get("widths", {}).get("client", 0)
    )


def demo_side_ok(side: dict) -> bool:
    stress = side.get("stress", {})
    return (
        not side.get("pageErrors") and not side.get("console") and not side.get("runtimeRequests")
        and side["widths"]["scroll"] <= side["widths"]["client"]
        and side.get("engineRestored") and side.get("fieldRestored") and side.get("luminousLayersRestored") and side.get("authoringRestored") and side.get("storycraftRestored")
        and stress.get("completed") is True and stress.get("cancelled") is False
        and stress.get("completedIterations") == 24 and stress.get("restored") is True
        and not stress.get("errors") and not stress.get("leakSignals")
        and side.get("journeyStart", {}).get("started") is True and side.get("journeyStopped") is True
        and side.get("captureEntered") is True and side.get("captureExited") is True
    )


def run_mode(mode: str) -> int:
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        executable = chromium_path(pw)
        launch = {"headless": True, "args": ["--no-sandbox"]}
        if executable:
            launch["executable_path"] = executable
        browser = pw.chromium.launch(**launch)
        try:
            cases = {
                "smoke": ("tests/smoke.html", "__AXM_TEST_RESULT__", "SMOKE_RESULT.json"),
                "authoring": ("tests/authoring.html", "__AXM_AUTHORING_TEST_RESULT__", "AUTHORING_RESULT.json"),
                "storycraft": ("tests/storycraft.html", "__AXM_STORYCRAFT_TEST_RESULT__", "STORYCRAFT_RESULT.json"),
            }
            if mode in cases:
                relative, global_name, filename = cases[mode]
                result = run_test(browser, relative, global_name, {"width": 1440, "height": 1000})
                (OUT / filename).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
                return 0 if clean_test(result) else 1
            if mode in ("desktop", "mobile"):
                viewport = {"width": 1440, "height": 1100} if mode == "desktop" else {"width": 390, "height": 844}
                result = run_demo(browser, viewport, mode.upper())
                (OUT / f"DEMO_{mode.upper()}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
                return 0 if demo_side_ok(result) else 1
            raise ValueError(f"Unknown mode: {mode}")
        finally:
            browser.close()


def main() -> int:
    if len(sys.argv) > 2 and sys.argv[1] == "--mode":
        return run_mode(sys.argv[2])
    modes = ["smoke", "authoring", "storycraft", "desktop", "mobile"]
    failures = []
    for mode in modes:
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--mode", mode], check=False)
        if completed.returncode != 0:
            failures.append(mode)
    if failures:
        print(json.dumps({"failedModes": failures}, indent=2))
        return 1
    smoke = json.loads((OUT / "SMOKE_RESULT.json").read_text(encoding="utf-8"))
    authoring = json.loads((OUT / "AUTHORING_RESULT.json").read_text(encoding="utf-8"))
    storycraft = json.loads((OUT / "STORYCRAFT_RESULT.json").read_text(encoding="utf-8"))
    desktop = json.loads((OUT / "DEMO_DESKTOP.json").read_text(encoding="utf-8"))
    mobile = json.loads((OUT / "DEMO_MOBILE.json").read_text(encoding="utf-8"))
    demo = {"version": VERSION, "desktop": desktop, "mobile": mobile}
    (OUT / "DEMO_RESULT.json").write_text(json.dumps(demo, indent=2) + "\n", encoding="utf-8")
    okay = clean_test(smoke) and clean_test(authoring) and clean_test(storycraft) and demo_side_ok(desktop) and demo_side_ok(mobile)
    print(json.dumps({
        "smoke": f"{smoke['passed']}/{smoke['total']}",
        "authoring": f"{authoring['passed']}/{authoring['total']}",
        "storycraft": f"{storycraft['passed']}/{storycraft['total']}",
        "total": smoke["passed"] + authoring["passed"] + storycraft["passed"],
        "desktop": "pass" if demo_side_ok(desktop) else "fail",
        "mobile": "pass" if demo_side_ok(mobile) else "fail",
    }, indent=2))
    return 0 if okay else 1


if __name__ == "__main__":
    sys.exit(main())
