#!/usr/bin/env python3
"""Reproducible end-to-end browser smoke test for the bundled AXM studio.

The test injects the exact single-file distribution into local Chromium. It makes
no network requests and writes JSON evidence plus desktop/mobile screenshots.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist" / "AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html"
DESKTOP_REPORT = ROOT / "reports" / "browser_smoke_python_v1_3_0.json"
MOBILE_REPORT = ROOT / "reports" / "mobile_smoke_python_v1_3_0.json"
DESKTOP_SHOT = ROOT / "reports" / "studio_desktop_python_v1_3_0.png"
MOBILE_SHOT = ROOT / "reports" / "studio_mobile_python_v1_3_0.png"
RAW_RECIPE = ROOT / "examples" / "recipes" / "game-hud.axmrecipe.json"
STARTER_PACKAGE = ROOT / "packages" / "starter" / "light.neon-edge-glow.axmfx.json"

STORAGE_STUB = r"""(() => {
  const s = new Map();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: k => s.has(String(k)) ? s.get(String(k)) : null,
      setItem: (k, v) => s.set(String(k), String(v)),
      removeItem: k => s.delete(String(k)),
      clear: () => s.clear(),
      key: i => [...s.keys()][i] ?? null,
      get length() { return s.size; }
    }
  });
})();"""


def load_page(page, html: str) -> None:
    page.evaluate(STORAGE_STUB)
    page.set_content(html, wait_until="load")
    page.wait_for_selector('html[data-axm-ready="true"]')
    page.wait_for_selector('#previewStage[data-ready="true"]')


def close_dialog(page, selector: str) -> None:
    dialog = page.locator(selector)
    if dialog.get_attribute("open") is not None:
        dialog.locator('[data-close-dialog]').first.click()


def run(chromium: str | None = None) -> tuple[dict, dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit(
            "Playwright is not installed. Run: pip install playwright && playwright install chromium"
        ) from exc

    html = DIST.read_text(encoding="utf-8")
    desktop_errors: list[str] = []
    desktop_console_errors: list[str] = []
    desktop_network: list[str] = []
    mobile_errors: list[str] = []
    mobile_console_errors: list[str] = []
    mobile_network: list[str] = []

    with sync_playwright() as p:
        launch = {"headless": True}
        if chromium:
            launch["executable_path"] = chromium
        browser = p.chromium.launch(**launch)

        page = browser.new_page(viewport={"width": 1600, "height": 1000}, accept_downloads=True)
        page.on("pageerror", lambda error: desktop_errors.append(str(error)))
        page.on(
            "console",
            lambda message: desktop_console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.on(
            "request",
            lambda request: desktop_network.append(request.url)
            if request.url.startswith(("http://", "https://"))
            else None,
        )
        load_page(page, html)

        result: dict = {
            "title": page.title(),
            "ready": page.locator("html").get_attribute("data-axm-ready"),
            "previewReady": page.locator("#previewStage").get_attribute("data-ready"),
            "initialLibraryCards": page.locator("#moduleLibrary [data-module-id]").count(),
            "initialLayers": page.locator("#activeStack [data-instance-id]").count(),
        }

        # Use the beginner-facing guided builder and verify it produces an editable traceable recipe.
        page.locator("#btnGuide").click()
        page.locator("#guideGoal").select_option("hero")
        page.locator("#guideEnergy").select_option("cinematic")
        page.locator("#guidePhotosensitiveSafe").check()
        page.locator("#btnApplyGuide").click()
        page.wait_for_function("document.querySelector('#sceneSelect').value === 'scene.hero'")
        result["guidedScene"] = page.locator("#sceneSelect").input_value()
        result["guidedPhotosensitiveSafe"] = page.locator("#togglePhotosensitiveSafe").is_checked()

        # Add a live visual module and edit a global control.
        page.locator('[data-module-id="light.volumetric-beam"] [data-action="add-module"]').click()
        result["layersAfterAdd"] = page.locator("#activeStack [data-instance-id]").count()
        page.locator("#globalIntensity").evaluate(
            "el => { el.value='0.81'; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }"
        )
        result["globalIntensity"] = page.locator("#globalIntensityOut").inner_text()

        # Inspect the actual dependency graph and transparent performance report.
        page.locator('[data-inspector-action="inspect-graph"]').click()
        result["graphContainsModule"] = "Volumetric Beam" in page.locator("#graphDialogBody").inner_text()
        close_dialog(page, "#graphDialog")
        page.locator("#btnPerformance").click()
        perf_text = page.locator("#performanceDialogBody").inner_text()
        perf_text_lower = perf_text.lower()
        result["performanceReportVisible"] = "estimated load" in perf_text_lower and "largest estimated contributors" in perf_text_lower
        close_dialog(page, "#performanceDialog")
        page.locator("#btnRepair").click()
        result["repairCenterVisible"] = "Proposed recipe actions" in page.locator("#repairDialogBody").inner_text()
        close_dialog(page, "#repairDialog")

        # Create a traceable derived module.
        page.locator('[data-tab="creator"]').click()
        page.locator("#creatorBase").select_option("light.volumetric-beam")
        page.locator("#creatorDerivedName").fill("Browser Smoke Beam")
        page.locator("#creatorDerivedDescription").fill("Reusable derivative created by the browser smoke test.")
        page.locator("#btnCreateDerived").click()
        page.wait_for_function("document.querySelector('#libraryCount').textContent.includes('1 custom')")
        result["customModuleCreated"] = page.locator("#libraryCount").inner_text()

        # Capture the current composition as a recursive mold.
        page.locator('[data-tab="creator"]').click()
        page.locator('[data-creator-mode="composite"]').click()
        page.locator("#creatorCompositeName").fill("Browser Smoke Composite")
        page.locator("#creatorCompositeDescription").fill("Recursive stack capture created by the browser smoke test.")
        page.locator("#btnCreateComposite").click()
        page.wait_for_function("document.querySelector('#libraryCount').textContent.includes('2 custom')")
        result["compositeModuleCreated"] = page.locator("#libraryCount").inner_text()

        # Snapshot and inspect rollback state.
        page.locator("#btnSnapshot").click()
        page.locator("#btnSnapshots").click()
        result["snapshotCards"] = page.locator("#snapshotsDialogBody [data-snapshot-id]").count()
        close_dialog(page, "#snapshotsDialog")

        # Validate the actual active graph.
        page.locator("#btnValidate").click()
        validation_text = page.locator("#validationDialogBody").inner_text()
        result["validationContainsSummary"] = "Blocking errors" in validation_text and "Resolved render modules" in validation_text
        close_dialog(page, "#validationDialog")
        result["renderStatus"] = page.locator("#renderStatus").inner_text()

        # Export a standalone live scene and verify the produced file is substantive.
        page.locator("#btnExport").click()
        with page.expect_download() as download_info:
            page.locator("#exportStandalone").click()
        download = download_info.value
        download_path = Path(download.path())
        result["standaloneExportBytes"] = download_path.stat().st_size
        result["standaloneSuggestedFilename"] = download.suggested_filename

        page.locator("#btnExport").click()
        with page.expect_download() as component_download_info:
            page.locator("#exportWebComponent").click()
        component_download = component_download_info.value
        component_path = Path(component_download.path())
        result["webComponentExportBytes"] = component_path.stat().st_size
        result["webComponentSuggestedFilename"] = component_download.suggested_filename

        # Import a readable recipe through the explicit review gate.
        page.locator("#fileImport").set_input_files(str(RAW_RECIPE))
        page.wait_for_function("document.querySelector('#importReviewDialog').open === true")
        result["rawRecipeReviewVisible"] = "Readable recipe" in page.locator("#importReviewDialogBody").inner_text()
        page.locator("#btnConfirmImport").click()
        page.wait_for_function("document.querySelector('#sceneSelect').value === 'scene.hud'")
        result["rawRecipeImportScene"] = page.locator("#sceneSelect").input_value()

        # Import a sealed starter package. PackageIO verifies SHA-256 before returning.
        prior_toasts = page.locator("#toastRegion > *").count()
        page.locator("#fileImport").set_input_files(str(STARTER_PACKAGE))
        page.wait_for_function("document.querySelector('#importReviewDialog').open === true")
        result["starterPackageReviewVisible"] = "Package passed" in page.locator("#importReviewDialogBody").inner_text()
        page.locator("#btnConfirmImport").click()
        page.wait_for_function(
            "count => document.querySelector('#toastRegion').children.length > count",
            arg=prior_toasts,
        )
        toast = page.locator("#toastRegion > *").last
        result["starterPackageImportVerified"] = "Imported" in toast.inner_text() and "bad" not in (toast.get_attribute("class") or "")
        result["starterPackageToast"] = toast.inner_text()
        result["localAutosaveStatus"] = page.locator("#autosaveStatus").inner_text()

        page.screenshot(path=str(DESKTOP_SHOT), full_page=True)
        result["pageErrors"] = desktop_errors
        result["consoleErrors"] = desktop_console_errors
        result["networkRequests"] = desktop_network
        result["screenshot"] = "reports/studio_desktop_python_v1_3_0.png"

        # Fresh phone-sized session: ensure no hidden horizontal breakage and all compact tools remain reachable.
        mobile = browser.new_page(viewport={"width": 412, "height": 915})
        mobile.on("pageerror", lambda error: mobile_errors.append(str(error)))
        mobile.on(
            "console",
            lambda message: mobile_console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        mobile.on(
            "request",
            lambda request: mobile_network.append(request.url)
            if request.url.startswith(("http://", "https://"))
            else None,
        )
        load_page(mobile, html)
        metrics = mobile.evaluate(
            """() => ({
              vw: innerWidth,
              sw: document.documentElement.scrollWidth,
              bw: document.body.scrollWidth,
              preview: Math.round(document.querySelector('#previewWrap').getBoundingClientRect().width),
              documentHeight: document.documentElement.scrollHeight
            })"""
        )
        mobile.locator("#mobileTools summary").click()
        mobile.locator('[data-mobile-action="validate"]').click()
        mobile.wait_for_function("document.querySelector('#validationDialog').open === true")
        mobile_tools_validated = "Blocking errors" in mobile.locator("#validationDialogBody").inner_text()
        close_dialog(mobile, "#validationDialog")
        mobile.screenshot(path=str(MOBILE_SHOT), full_page=True)
        mobile_result = {
            "metrics": metrics,
            "horizontalOverflowPixels": max(0, metrics["sw"] - metrics["vw"]),
            "mobileToolsValidated": mobile_tools_validated,
            "pageErrors": mobile_errors,
            "consoleErrors": mobile_console_errors,
            "networkRequests": mobile_network,
            "screenshot": "reports/studio_mobile_python_v1_3_0.png",
        }
        browser.close()

    DESKTOP_REPORT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    MOBILE_REPORT.write_text(json.dumps(mobile_result, indent=2) + "\n", encoding="utf-8")
    return result, mobile_result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chromium", help="Optional Chromium/Chrome executable path")
    args = parser.parse_args()
    desktop, mobile = run(args.chromium)
    print(json.dumps({"desktop": desktop, "mobile": mobile}, indent=2))

    failures = []
    if desktop["ready"] != "true" or desktop["previewReady"] != "true":
        failures.append("studio readiness signal missing")
    if desktop["layersAfterAdd"] != desktop["initialLayers"] + 1:
        failures.append("module add did not change the active stack")
    if not desktop["validationContainsSummary"]:
        failures.append("validation dialog did not render")
    if desktop["standaloneExportBytes"] < 10_000:
        failures.append("standalone export was unexpectedly small")
    if desktop["webComponentExportBytes"] < 8_000:
        failures.append("Web Component export was unexpectedly small")
    if not desktop.get("guidedPhotosensitiveSafe") or desktop.get("guidedScene") != "scene.hero":
        failures.append("guided creation did not apply its declared settings")
    if not desktop.get("graphContainsModule") or not desktop.get("performanceReportVisible") or not desktop.get("repairCenterVisible"):
        failures.append("v1.3 inspection or recovery tools did not render")
    if not desktop.get("rawRecipeReviewVisible") or not desktop.get("starterPackageReviewVisible"):
        failures.append("import review gate did not render")
    if not desktop["starterPackageImportVerified"]:
        failures.append("sealed starter package import did not complete")
    if desktop["pageErrors"] or desktop["consoleErrors"] or desktop["networkRequests"]:
        failures.append("desktop session emitted errors or network requests")
    if mobile["horizontalOverflowPixels"] != 0 or not mobile["mobileToolsValidated"]:
        failures.append("mobile layout or compact tools failed")
    if mobile["pageErrors"] or mobile["consoleErrors"] or mobile["networkRequests"]:
        failures.append("mobile session emitted errors or network requests")
    if failures:
        raise SystemExit("Browser smoke failed: " + "; ".join(failures))


if __name__ == "__main__":
    main()
