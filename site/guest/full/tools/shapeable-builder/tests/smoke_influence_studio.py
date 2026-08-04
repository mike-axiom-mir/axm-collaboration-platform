"""Targeted v0.13 Per-Block Influence Studio smoke test.

Runs the real HTML, CSS and JavaScript in Chromium without a network server.
It verifies the beginner flow, source integrity, local asset request, transparent
code boundary, undo/redo and responsive inspector layout.
"""
from pathlib import Path
import json
import os
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text()
html = re.sub(r'<link[^>]+(?:stylesheet|manifest|icon)[^>]*>', '', html, flags=re.I)
html = re.sub(r'<script[^>]+src="(?:model|app)\.js"[^>]*></script>', '', html, flags=re.I)
html = html.replace(
    'src="assets/axm-builder-mark.svg"',
    'src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 40 40%27%3E%3Crect x=%274%27 y=%274%27 width=%2732%27 height=%2732%27 rx=%279%27 fill=%27%230d1a27%27 stroke=%27%2344d7ca%27/%3E%3Cpath d=%27M12 20l8-9 8 9-8 9z%27 fill=%27none%27 stroke=%27%2344d7ca%27/%3E%3C/svg%3E"'
)

errors = []
console_messages = []
requests = []

with sync_playwright() as p:
    launch = {"headless": True}
    chromium_path = os.environ.get("AXM_CHROMIUM_PATH")
    if chromium_path:
        launch.update(executable_path=chromium_path, args=["--no-sandbox", "--disable-dev-shm-usage"])
    elif Path("/usr/bin/chromium").exists():
        launch.update(executable_path="/usr/bin/chromium", args=["--no-sandbox", "--disable-dev-shm-usage"])

    browser = p.chromium.launch(**launch)
    context = browser.new_context(accept_downloads=True, viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_messages.append(f"{message.type}: {message.text}"))
    page.on("request", lambda request: requests.append(request.url))

    page.set_content(html, wait_until="domcontentloaded")
    page.evaluate(
        """
        () => {
          const data = new Map();
          const storage = {
            getItem(key){ return data.has(String(key)) ? data.get(String(key)) : null; },
            setItem(key,value){ data.set(String(key), String(value)); },
            removeItem(key){ data.delete(String(key)); },
            clear(){ data.clear(); },
            key(index){ return Array.from(data.keys())[index] || null; }
          };
          Object.defineProperty(storage, 'length', { get(){ return data.size; } });
          Object.defineProperty(window, 'localStorage', { configurable:true, value:storage });
        }
        """
    )
    page.add_style_tag(path=str(ROOT / "styles.css"))
    page.add_script_tag(path=str(ROOT / "model.js"))
    page.add_script_tag(path=str(ROOT / "app.js"))
    page.wait_for_function("window.AXMShapeableBuilder && window.AXMBuilderModel")

    assert page.evaluate("AXMShapeableBuilder.version") == "0.13.0-beta"
    page.evaluate("AXMShapeableBuilder.loadTemplate('cartoon-world')")
    page.wait_for_function("AXMShapeableBuilder.getProject().meta.templateId === 'cartoon-world'")
    page.wait_for_timeout(420)
    page.evaluate("document.getElementById('templateDialog').open && document.getElementById('templateDialog').close()")

    validation = page.evaluate("AXMShapeableBuilder.validate()")
    assert validation["errors"] == 0 and validation["warnings"] == 0, validation

    npc_id = page.evaluate(
        "AXMShapeableBuilder.getProject().layers.visual.nodes.find(node => node.type === 'npc').id"
    )
    assert page.evaluate("id => AXMShapeableBuilder.focusNode(id)", npc_id)
    page.wait_for_selector("[data-influence-studio]")
    studio_text = page.locator("[data-influence-studio]").inner_text()
    assert "How this person behaves" in studio_text
    assert "Choose a moment" in studio_text and "Preview before testing" in studio_text
    assert page.locator("[data-influence-rule-card]").count() == 4
    assert "THIS COPY" in studio_text

    profile = page.evaluate("id => AXMShapeableBuilder.getInfluenceProfile(id)", npc_id)
    assert profile["id"] == "character"
    assert len(profile["visualStates"]) == 5

    greeting_rule_id = page.evaluate(
        """
        id => {
          const node=AXMShapeableBuilder.getProject().layers.visual.nodes.find(item=>item.id===id);
          return node.influence.rules.find(rule=>rule.trigger==='player_nearby' && rule.action==='say_message').id;
        }
        """,
        npc_id,
    )
    source_before_preview = page.evaluate("JSON.stringify(AXMShapeableBuilder.getProject())")
    page.click(f'[data-preview-influence-rule="{greeting_rule_id}"]')
    page.wait_for_selector(".influence-preview")
    assert "NOT APPLIED" in page.locator(".influence-preview").inner_text()
    assert "Welcome, Milo" in page.locator(".influence-preview").inner_text()
    assert page.evaluate("JSON.stringify(AXMShapeableBuilder.getProject())") == source_before_preview

    # Add one reaction through the beginner When -> Do -> Detail controls.
    page.select_option("[data-new-influence-trigger]", "human_activates")
    page.select_option("[data-new-influence-action]", "say_message")
    page.fill("[data-new-influence-value]", "I can explain the grove one step at a time.")
    page.fill("[data-new-influence-note]", "Never complete the task for the player.")
    page.click("[data-add-influence-rule]")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.rules.length === 5",
        arg=npc_id,
    )
    assert "Reaction added" in page.locator(".toast-stack").inner_text()

    # This instance edit is one normal undo/redo history step.
    page.click("#undoButton")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.rules.length === 4",
        arg=npc_id,
    )
    page.click("#redoButton")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.rules.length === 5",
        arg=npc_id,
    )
    assert page.evaluate("id => AXMShapeableBuilder.focusNode(id)", npc_id)
    page.wait_for_selector("[data-influence-studio]")

    # Configure one later asset-generator slot without changing identity, logic or permissions.
    listening_card = page.locator(".visual-state-card:has-text('Listening')")
    listening_card.locator("summary").click()
    page.evaluate(
        """
        () => {
          const input=document.querySelector('[data-visual-state="listening"][data-visual-field="assetRef"]');
          input.value='assets/luma-listening.png';
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
        """
    )
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.visualStates.listening.assetRef === 'assets/luma-listening.png'",
        arg=npc_id,
    )
    page.evaluate(
        """
        () => {
          const input=document.querySelector('[data-visual-state="listening"][data-visual-field="notes"]');
          input.value='Keep Luma warm, recognizable and visually consistent.';
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
        """
    )

    with page.expect_download() as download_info:
        page.click("[data-download-asset-request]")
    download = download_info.value
    assert download.suggested_filename.endswith(".axm-asset-request.json"), download.suggested_filename
    asset_request = json.loads(Path(download.path()).read_text())
    assert asset_request["schema"] == "axm.asset.block-request"
    assert asset_request["authority"] == "PROPOSE_ASSETS_ONLY"
    assert asset_request["source"]["blockId"] == npc_id
    listening_request = next(state for state in asset_request["states"] if state["id"] == "listening")
    assert listening_request["currentAssetRef"] == "assets/luma-listening.png"

    # Add an advanced draft. The UI exposes the code and never exposes an enable switch.
    page.locator(".code-hook-details > summary").click()
    page.click("[data-add-code-hook]")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.codeHooks.length === 1",
        arg=npc_id,
    )
    page.locator(".code-hook-details > summary").click()
    page.evaluate(
        """
        () => {
          const input=document.querySelector('[data-code-field="code"]');
          input.value='// BROWSER_SENTINEL_MUST_NOT_EXECUTE\\nreturn { proposal: "offer-visible-hint" };';
          input.dispatchEvent(new Event('change',{bubbles:true}));
        }
        """
    )
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.codeHooks[0].code.includes('BROWSER_SENTINEL')",
        arg=npc_id,
    )
    hook_contract = page.evaluate(
        """
        id => {
          const hook=AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.codeHooks[0];
          return { execution:hook.execution, enabled:hook.enabled };
        }
        """,
        npc_id,
    )
    assert hook_contract == {"execution": "CONTRACT_ONLY", "enabled": False}
    assert page.locator('[data-code-field="enabled"]').count() == 0

    # Two undos remove the code edit and then the draft; two redos restore both.
    page.click("#undoButton")
    page.click("#undoButton")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.codeHooks.length === 0",
        arg=npc_id,
    )
    page.click("#redoButton")
    page.click("#redoButton")
    page.wait_for_function(
        "id => AXMShapeableBuilder.getProject().layers.visual.nodes.find(node=>node.id===id).influence.codeHooks.length === 1",
        arg=npc_id,
    )

    build = page.evaluate("AXMShapeableBuilder.generateBuild()")
    assert "Welcome, Milo. Five star seeds will relight the grove." in build
    assert "moveSpeed=184.8" in build
    assert "BROWSER_SENTINEL_MUST_NOT_EXECUTE" not in build
    assert "code drafts never run" in build.lower()

    # Desktop evidence focuses the inspector on the new beginner workflow.
    assert page.evaluate("id => AXMShapeableBuilder.focusNode(id)", npc_id)
    page.wait_for_selector("[data-influence-studio]")
    page.evaluate(
        """
        () => {
          const inspector=document.getElementById('inspectorContent');
          const studio=document.querySelector('[data-influence-studio]');
          inspector.scrollTop=Math.max(0, studio.offsetTop-8);
        }
        """
    )
    page.evaluate("document.getElementById('toastStack').innerHTML = ''")
    desktop_fit = page.evaluate(
        """
        () => {
          const inspector=document.getElementById('inspectorContent');
          const studio=document.querySelector('[data-influence-studio]');
          return {
            inspectorScrollWidth: inspector.scrollWidth,
            inspectorClientWidth: inspector.clientWidth,
            studioScrollWidth: studio.scrollWidth,
            studioClientWidth: studio.clientWidth
          };
        }
        """
    )
    assert desktop_fit["inspectorScrollWidth"] <= desktop_fit["inspectorClientWidth"] + 2, desktop_fit
    assert desktop_fit["studioScrollWidth"] <= desktop_fit["studioClientWidth"] + 2, desktop_fit
    page.screenshot(path=str(ROOT / "tests/per-block-influence-desktop.png"), full_page=True)

    # Phone-sized inspector remains readable with one-column beginner controls.
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("id => AXMShapeableBuilder.focusNode(id)", npc_id)
    page.wait_for_selector("#inspectorPanel.open [data-influence-studio]")
    page.evaluate(
        """
        () => {
          const inspector=document.getElementById('inspectorContent');
          const studio=document.querySelector('[data-influence-studio]');
          inspector.scrollTop=Math.max(0, studio.offsetTop-8);
        }
        """
    )
    page.evaluate("document.getElementById('toastStack').innerHTML = ''")
    mobile_fit = page.evaluate(
        """
        () => {
          const panel=document.getElementById('inspectorPanel');
          const inspector=document.getElementById('inspectorContent');
          const studio=document.querySelector('[data-influence-studio]');
          const grid=document.querySelector('.influence-rule-grid');
          return {
            panelRight: Math.round(panel.getBoundingClientRect().right),
            viewportWidth: window.innerWidth,
            inspectorScrollWidth: inspector.scrollWidth,
            inspectorClientWidth: inspector.clientWidth,
            studioScrollWidth: studio.scrollWidth,
            studioClientWidth: studio.clientWidth,
            gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
            guideColumns: getComputedStyle(document.querySelector('.influence-guide')).gridTemplateColumns.split(' ').filter(Boolean).length
          };
        }
        """
    )
    assert mobile_fit["panelRight"] <= mobile_fit["viewportWidth"] + 1, mobile_fit
    assert mobile_fit["inspectorScrollWidth"] <= mobile_fit["inspectorClientWidth"] + 2, mobile_fit
    assert mobile_fit["studioScrollWidth"] <= mobile_fit["studioClientWidth"] + 2, mobile_fit
    assert mobile_fit["gridColumns"] == 1 and mobile_fit["guideColumns"] == 1, mobile_fit
    page.screenshot(path=str(ROOT / "tests/per-block-influence-mobile.png"), full_page=True)

    external = [url for url in requests if url.startswith(("http://", "https://"))]
    assert not external, external
    if errors:
        raise AssertionError("Page errors: " + repr(errors))

    print("PASS browser per-block influence smoke")
    print("console messages:", console_messages[-8:])
    print("requests:", requests)
    browser.close()
