"""Targeted v0.13 drag-and-drop polish smoke test.

Runs the real local HTML/CSS/JavaScript in Chromium. It verifies the visible
landing preview, grid snap, alignment guides, Shift free placement, continuous
edge auto-scroll, Undo/Redo boundaries, and real touch dragging from the block
palette. No outside requests are allowed.
"""
from pathlib import Path
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


def install_app(page):
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
    page.evaluate("AXMShapeableBuilder.loadTemplate('blank')")
    page.wait_for_timeout(420)
    page.evaluate(
        """
        () => document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close())
        """
    )


def dispatch_native_palette_drag(page, source, target_x, target_y, screenshot_path=None):
    transfer = page.evaluate_handle("new DataTransfer()")
    source.dispatch_event("dragstart", {"dataTransfer": transfer})
    page.locator("#canvasViewport").dispatch_event(
        "dragover",
        {"dataTransfer": transfer, "clientX": target_x, "clientY": target_y, "shiftKey": False},
    )
    page.wait_for_timeout(80)
    assert page.locator("#canvasDropPreview:not(.hidden)").count() == 1
    if screenshot_path:
        page.screenshot(path=str(screenshot_path), full_page=True)
    preview = page.evaluate(
        """
        () => {
          const preview=document.getElementById('canvasDropPreview');
          return {
            x: parseFloat(preview.style.left),
            y: parseFloat(preview.style.top),
            title: document.getElementById('dropPreviewTitle').textContent,
            meta: document.getElementById('dropPreviewMeta').textContent,
            status: document.getElementById('coordinateStatus').textContent
          };
        }
        """
    )
    page.locator("#canvasViewport").dispatch_event(
        "drop",
        {"dataTransfer": transfer, "clientX": target_x, "clientY": target_y, "shiftKey": False},
    )
    source.dispatch_event("dragend", {"dataTransfer": transfer})
    return preview


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

    # Desktop: native palette drag, visual preview, snapping and node movement.
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_messages.append(f"desktop {message.type}: {message.text}"))
    page.on("request", lambda request: requests.append(request.url))
    install_app(page)

    source = page.locator('.palette-block[data-block-type="event"]').first
    viewport = page.locator("#canvasViewport").bounding_box()
    assert viewport
    target_x = viewport["x"] + min(370, viewport["width"] * 0.52)
    target_y = viewport["y"] + min(280, viewport["height"] * 0.43)
    preview = dispatch_native_palette_drag(
        page,
        source,
        target_x,
        target_y,
        ROOT / "tests/drag-drop-polish-desktop.png",
    )
    assert preview["title"] == "Event", preview
    assert "snap 12" in preview["meta"].lower() or "aligned" in preview["meta"].lower(), preview
    assert "Drop x" in preview["status"], preview
    assert round(preview["x"]) % 12 == 0 and round(preview["y"]) % 12 == 0, preview
    page.wait_for_function("AXMShapeableBuilder.getProject().layers.logic.nodes.length === 1")
    placed = page.evaluate("AXMShapeableBuilder.getProject().layers.logic.nodes[0]")
    assert round(placed["x"]) == round(preview["x"]), (placed, preview)
    assert round(placed["y"]) == round(preview["y"]), (placed, preview)
    assert page.locator("#canvasDropPreview.hidden").count() == 1

    # Add a second block, then drag the first near its X alignment line.
    page.locator('[data-add-block="condition"]').click()
    page.wait_for_function("AXMShapeableBuilder.getProject().layers.logic.nodes.length === 2")
    nodes = page.evaluate("AXMShapeableBuilder.getProject().layers.logic.nodes")
    first, second = nodes[0], nodes[1]
    page.evaluate(
        """
        ids => {
          const project=AXMShapeableBuilder.getProject();
          // Work through the exported project only for IDs; the UI drag performs the actual mutation.
          return ids;
        }
        """,
        [first["id"], second["id"]],
    )
    first_element = page.locator(f'[data-node-id="{first["id"]}"]')
    header = first_element.locator(".node-header")
    header_box = header.bounding_box()
    surface_box = page.locator("#canvasSurface").bounding_box()
    assert header_box and surface_box
    desired_x = second["x"] + 4
    desired_y = second["y"] + 220 if second["y"] + 220 <= 800 else max(20, second["y"] - 220)
    zoom = surface_box["width"] / 1600
    start_client_x = header_box["x"] + 80
    start_client_y = header_box["y"] + 22
    target_client_x = start_client_x + (desired_x - first["x"]) * zoom
    target_client_y = start_client_y + (desired_y - first["y"]) * zoom
    page.mouse.move(start_client_x, start_client_y)
    page.mouse.down()
    page.mouse.move(target_client_x, target_client_y, steps=14)
    page.wait_for_timeout(120)
    assert page.locator("#alignmentGuideX:not(.hidden)").count() == 1
    assert first_element.evaluate("element => element.classList.contains('is-dragging')")
    page.mouse.up()
    page.wait_for_timeout(80)
    moved = page.evaluate(
        "id => AXMShapeableBuilder.getProject().layers.logic.nodes.find(node=>node.id===id)",
        first["id"],
    )
    assert round(moved["x"]) == round(second["x"]), (moved, second)
    assert page.locator("#alignmentGuideX.hidden").count() == 1

    # One Undo restores the exact pre-drag position; Redo restores the move.
    page.locator("#undoButton").click()
    page.wait_for_timeout(80)
    undone = page.evaluate(
        "id => AXMShapeableBuilder.getProject().layers.logic.nodes.find(node=>node.id===id)",
        first["id"],
    )
    assert round(undone["x"]) == round(first["x"]) and round(undone["y"]) == round(first["y"]), (undone, first)
    page.locator("#redoButton").click()
    page.wait_for_timeout(80)

    # Shift bypasses snapping and alignment for a precise free move.
    free_before = page.evaluate(
        "id => AXMShapeableBuilder.getProject().layers.logic.nodes.find(node=>node.id===id)",
        first["id"],
    )
    free_header = page.locator(f'[data-node-id="{first["id"]}"] .node-header').bounding_box()
    assert free_header
    free_start_x = free_header["x"] + 75
    free_start_y = free_header["y"] + 22
    page.keyboard.down("Shift")
    page.mouse.move(free_start_x, free_start_y)
    page.mouse.down()
    page.mouse.move(free_start_x + 37, free_start_y + 23, steps=8)
    page.wait_for_timeout(70)
    free_status = page.locator("#coordinateStatus").inner_text().lower()
    assert "free placement" in free_status
    page.mouse.up()
    page.keyboard.up("Shift")
    page.wait_for_timeout(80)
    free_after = page.evaluate(
        "id => AXMShapeableBuilder.getProject().layers.logic.nodes.find(node=>node.id===id)",
        first["id"],
    )
    assert round(free_after["x"] - free_before["x"]) == 37, (free_before, free_after)
    assert round(free_after["y"] - free_before["y"]) == 23, (free_before, free_after)
    assert round(free_after["x"]) % 12 != 0 or round(free_after["y"]) % 12 != 0, free_after

    # Continuous edge auto-scroll works even while the pointer pauses.
    page.locator("#undoButton").click()
    page.wait_for_timeout(420)
    page.evaluate("document.getElementById('canvasViewport').scrollLeft = 0")
    scroll_before = page.evaluate("document.getElementById('canvasViewport').scrollLeft")
    edge_header = page.locator(f'[data-node-id="{first["id"]}"] .node-header').bounding_box()
    viewport = page.locator("#canvasViewport").bounding_box()
    assert edge_header and viewport
    page.mouse.move(edge_header["x"] + 70, edge_header["y"] + 20)
    page.mouse.down()
    page.mouse.move(viewport["x"] + viewport["width"] - 4, viewport["y"] + viewport["height"] * 0.5, steps=10)
    page.wait_for_timeout(520)
    scroll_after = page.evaluate("document.getElementById('canvasViewport').scrollLeft")
    page.mouse.up()
    assert scroll_after > scroll_before + 20, (scroll_before, scroll_after)

    context.close()

    # Mobile: real touch input drags a palette block onto the canvas.
    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    mobile = mobile_context.new_page()
    mobile.on("pageerror", lambda error: errors.append(str(error)))
    mobile.on("console", lambda message: console_messages.append(f"mobile {message.type}: {message.text}"))
    mobile.on("request", lambda request: requests.append(request.url))
    install_app(mobile)
    mobile.locator("#mobileMenuButton").click()
    mobile.wait_for_selector("#palettePanel.open")
    mobile.wait_for_timeout(300)
    touch_source = mobile.locator('.palette-block[data-block-type="event"]').first
    touch_box = touch_source.bounding_box()
    assert touch_box
    cdp = mobile_context.new_cdp_session(mobile)
    start_x = touch_box["x"] + 48
    start_y = touch_box["y"] + touch_box["height"] / 2
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": start_x, "y": start_y, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]})
    cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": start_x + 34, "y": start_y + 2, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]})
    mobile.wait_for_timeout(330)
    mobile_viewport = mobile.locator("#canvasViewport").bounding_box()
    assert mobile_viewport
    touch_target_x = mobile_viewport["x"] + mobile_viewport["width"] * 0.58
    touch_target_y = mobile_viewport["y"] + mobile_viewport["height"] * 0.42
    cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": touch_target_x, "y": touch_target_y, "radiusX": 4, "radiusY": 4, "force": 1, "id": 1}]})
    mobile.wait_for_timeout(180)
    assert mobile.locator(".palette-touch-ghost").count() == 1
    assert mobile.locator("#canvasDropPreview:not(.hidden)").count() == 1
    mobile.screenshot(path=str(ROOT / "tests/drag-drop-polish-mobile.png"), full_page=True)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    mobile.wait_for_function("AXMShapeableBuilder.getProject().layers.logic.nodes.length === 1")
    assert mobile.locator(".palette-touch-ghost").count() == 0
    assert mobile.locator("#palettePanel.open").count() == 0
    mobile_node = mobile.evaluate("AXMShapeableBuilder.getProject().layers.logic.nodes[0]")
    assert round(mobile_node["x"]) % 12 == 0 and round(mobile_node["y"]) % 12 == 0, mobile_node
    mobile_context.close()

    browser.close()

outside_requests = [url for url in requests if not url.startswith(("data:", "blob:", "about:"))]
assert not errors, errors
assert not outside_requests, outside_requests
print("PASS browser drag-and-drop polish smoke")
print("browser errors:", len(errors))
print("outside requests:", len(outside_requests))
print("console messages:", console_messages)
