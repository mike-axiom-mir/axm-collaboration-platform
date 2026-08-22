(() => {
  "use strict";
  const queryParams = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = hashParams.get("token") || queryParams.get("token") || "";
  const requestedMode = hashParams.get("mode") || queryParams.get("mode") || "home";
  const apiHeaders = () => ({"X-AXM-Token": token});
  const $ = (id) => document.getElementById(id);
  const state = {
    sourceImage: null,
    undo: [],
    drawing: false,
    penEnabled: true,
    lastX: 0,
    lastY: 0,
    lastIncomingId: null,
    renderedIncomingId: null,
    latestPacket: null,
    polling: null,
    refreshBusy: false,
    maxUploadBytes: 24 * 1024 * 1024,
  };
  const canvas = $("previewCanvas");
  const ctx = canvas.getContext("2d", {alpha: false});

  function setMode(mode) {
    const safe = ["home", "capture", "latest"].includes(mode) ? mode : "home";
    document.body.classList.remove("mode-home", "mode-capture", "mode-latest");
    document.body.classList.add(`mode-${safe}`);
    document.querySelectorAll(".tab").forEach(btn => {
      const active = btn.dataset.mode === safe;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (safe === "capture") setTimeout(() => $("captureBtn").focus(), 80);
  }
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  setMode(requestedMode);

  async function api(path, options = {}) {
    const headers = {...apiHeaders(), ...(options.headers || {})};
    const response = await fetch(path, {...options, headers, cache: "no-store", credentials: "omit"});
    const payload = await response.json().catch(() => ({ok:false, error:`HTTP ${response.status}`}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }

  function status(message, bad = false) {
    const el = $("captureStatus");
    el.textContent = message;
    el.style.borderColor = bad ? "var(--danger)" : "var(--line)";
    el.style.color = bad ? "#ffd8dd" : "var(--muted)";
  }

  function formatTime(value) {
    if (!value) return "None";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be opened")); };
      img.src = url;
    });
  }

  function fitCanvas(img) {
    const maxDimension = 2560;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    state.sourceImage = ctx.getImageData(0, 0, width, height);
    state.undo = [];
    $("editor").classList.remove("hidden");
    $("undoBtn").disabled = true;
    status(`Visual ready (${width} × ${height}). Draw on it or add a note, then send.`);
  }

  async function prepareBlob(blob) {
    if (!blob || blob.size <= 0) throw new Error("The selected image is empty");
    if (blob.type && !blob.type.startsWith("image/")) throw new Error("Please use an image file");
    const img = await loadImageFromBlob(blob);
    fitCanvas(img);
  }

  $("captureBtn").addEventListener("click", async () => {
    let stream = null;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser does not support screen/window capture. Use Paste or Choose image.");
      status("Choose the screen or window in the browser dialog…");
      stream = await navigator.mediaDevices.getDisplayMedia({video: {cursor: "always"}, audio: false});
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise(resolve => setTimeout(resolve, 220));
      if (!video.videoWidth || !video.videoHeight) throw new Error("The chosen screen did not produce a frame");
      const temp = document.createElement("canvas");
      temp.width = video.videoWidth;
      temp.height = video.videoHeight;
      temp.getContext("2d", {alpha:false}).drawImage(video, 0, 0);
      const blob = await new Promise(resolve => temp.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The screenshot could not be encoded");
      await prepareBlob(blob);
    } catch (error) {
      status(error.message || String(error), true);
    } finally {
      if (stream) stream.getTracks().forEach(track => track.stop());
    }
  });

  $("pasteBtn").addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error("Clipboard image reading is unavailable in this browser. Press Ctrl+V or use Choose image.");
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith("image/"));
        if (type) { await prepareBlob(await item.getType(type)); return; }
      }
      throw new Error("No image is currently on the clipboard");
    } catch (error) {
      status(error.message || String(error), true);
    }
  });

  document.addEventListener("paste", async (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "textarea" || tag === "input") return;
    const item = [...(event.clipboardData?.items || [])].find(candidate => candidate.type.startsWith("image/"));
    if (!item) return;
    event.preventDefault();
    try { await prepareBlob(item.getAsFile()); }
    catch (error) { status(error.message || String(error), true); }
  });

  $("fileInput").addEventListener("change", async (event) => {
    try {
      const file = event.target.files?.[0];
      if (file) await prepareBlob(file);
    } catch (error) { status(error.message || String(error), true); }
    event.target.value = "";
  });

  const dropTarget = $("capturePanel");
  for (const name of ["dragenter", "dragover"]) {
    dropTarget.addEventListener(name, event => { event.preventDefault(); dropTarget.classList.add("drag-active"); });
  }
  for (const name of ["dragleave", "drop"]) {
    dropTarget.addEventListener(name, event => { event.preventDefault(); dropTarget.classList.remove("drag-active"); });
  }
  dropTarget.addEventListener("drop", async event => {
    try {
      const file = [...(event.dataTransfer?.files || [])].find(candidate => !candidate.type || candidate.type.startsWith("image/"));
      if (!file) throw new Error("Drop an image file here");
      await prepareBlob(file);
    } catch (error) { status(error.message || String(error), true); }
  });

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (!state.sourceImage || !state.penEnabled) return;
    event.preventDefault();
    state.undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (state.undo.length > 15) state.undo.shift();
    $("undoBtn").disabled = false;
    state.drawing = true;
    const p = pointerPosition(event); state.lastX = p.x; state.lastY = p.y;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing) return;
    const p = pointerPosition(event);
    ctx.strokeStyle = "#ff4f7b";
    ctx.lineWidth = Math.max(4, canvas.width / 420);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(state.lastX, state.lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
    state.lastX = p.x; state.lastY = p.y;
  });
  const endDraw = () => { state.drawing = false; };
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointercancel", endDraw);
  $("penBtn").addEventListener("click", () => {
    state.penEnabled = !state.penEnabled;
    $("penBtn").classList.toggle("active", state.penEnabled);
    $("penBtn").setAttribute("aria-pressed", state.penEnabled ? "true" : "false");
    canvas.classList.toggle("pen-off", !state.penEnabled);
  });
  $("undoBtn").addEventListener("click", () => {
    const prior = state.undo.pop();
    if (prior) ctx.putImageData(prior, 0, 0);
    $("undoBtn").disabled = state.undo.length === 0;
  });
  $("clearMarksBtn").addEventListener("click", () => {
    if (state.sourceImage) {
      state.undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));
      if (state.undo.length > 15) state.undo.shift();
      ctx.putImageData(state.sourceImage,0,0);
      $("undoBtn").disabled = false;
    }
  });
  $("cancelPreviewBtn").addEventListener("click", () => {
    state.sourceImage = null; state.undo=[]; $("editor").classList.add("hidden"); status("No visual selected yet.");
  });

  function canvasBlob(source, type = "image/png", quality) {
    return new Promise((resolve, reject) => source.toBlob(blob => blob ? resolve(blob) : reject(new Error("The visual could not be encoded")), type, quality));
  }

  async function encodeWithinLimit() {
    let working = canvas;
    let blob = await canvasBlob(working, "image/png");
    for (let pass = 0; blob.size > state.maxUploadBytes && pass < 5; pass += 1) {
      const ratio = Math.max(0.55, Math.min(0.9, Math.sqrt(state.maxUploadBytes / blob.size) * 0.9));
      const smaller = document.createElement("canvas");
      smaller.width = Math.max(1, Math.round(working.width * ratio));
      smaller.height = Math.max(1, Math.round(working.height * ratio));
      smaller.getContext("2d", {alpha:false}).drawImage(working, 0, 0, smaller.width, smaller.height);
      working = smaller;
      blob = await canvasBlob(working, "image/png");
    }
    if (blob.size > state.maxUploadBytes) throw new Error(`The visual is still larger than ${formatBytes(state.maxUploadBytes)} after safe resizing`);
    return blob;
  }

  $("sendBtn").addEventListener("click", async () => {
    if (!state.sourceImage) return;
    const button = $("sendBtn");
    button.disabled = true;
    try {
      status("Saving the visual into the local Codex inbox…");
      const blob = await encodeWithinLimit();
      const note = $("noteInput").value || "";
      const query = new URLSearchParams({lane:"to_codex"});
      const metaBytes = new TextEncoder().encode(JSON.stringify({filename:"mike-screen.png", title:"Mike visual", note, actor:"mike"}));
      let binary = ""; metaBytes.forEach(byte => binary += String.fromCharCode(byte));
      const meta = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const payload = await api(`/api/upload?${query.toString()}`, {method:"POST", body:blob, headers:{"Content-Type":"image/png", "X-AXM-Meta":meta}});
      status(`Sent to Codex · ${formatBytes(payload.packet.size_bytes)} · packet ${payload.packet.packet_id}`);
      state.sourceImage = null; state.undo=[]; $("editor").classList.add("hidden"); $("noteInput").value="";
      await refresh();
    } catch (error) { status(error.message || String(error), true); }
    finally { button.disabled = false; }
  });

  $("nativeCaptureBtn").addEventListener("click", async () => {
    try {
      status("Switch to the screen you want. Capturing in 3 seconds…");
      await api("/api/native-capture", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({delay:3, title:"Mike Windows screen", note:""})});
      status("Windows screen sent to Codex.");
      await refresh();
    } catch (error) { status(error.message || String(error), true); }
  });

  function assetUrl(packet) {
    const query = new URLSearchParams({lane:"to_mike", packet_id:packet.packet_id, token});
    return `/api/asset?${query.toString()}`;
  }

  async function renderIncoming(packet) {
    state.latestPacket = packet;
    if (!packet) {
      state.renderedIncomingId = null;
      $("emptyLatest").classList.remove("hidden"); $("latestCard").classList.add("hidden"); return;
    }
    $("emptyLatest").classList.add("hidden"); $("latestCard").classList.remove("hidden");
    $("incomingTitle").textContent = packet.title || "Codex visual";
    $("incomingTime").textContent = formatTime(packet.created_at);
    $("incomingNote").textContent = packet.note || "";
    $("incomingNote").classList.toggle("hidden", !packet.note);
    $("incomingAck").textContent = packet.acknowledged ? "SEEN" : "NEW";
    $("incomingAck").classList.toggle("good", packet.acknowledged);
    $("incomingSize").textContent = formatBytes(packet.size_bytes);
    $("incomingHash").textContent = `SHA-256 ${String(packet.sha256 || "").slice(0, 12)}…`;
    $("incomingHash").title = packet.sha256 || "";

    if (state.renderedIncomingId !== packet.packet_id) {
      const viewer = $("incomingViewer");
      viewer.replaceChildren();
      const url = assetUrl(packet);
      if (packet.kind === "image" || packet.kind === "svg") {
        const img = document.createElement("img");
        img.alt = packet.title || "Codex visual";
        img.referrerPolicy = "no-referrer";
        img.src = url;
        viewer.appendChild(img);
      } else if (packet.kind === "html") {
        const frame = document.createElement("iframe");
        frame.sandbox = "";
        frame.referrerPolicy = "no-referrer";
        frame.title = packet.title || "Codex static HTML preview";
        frame.src = url;
        viewer.appendChild(frame);
      } else {
        const response = await fetch(url, {cache:"no-store", credentials:"omit"});
        if (!response.ok) throw new Error(`Could not open Codex note (${response.status})`);
        const pre = document.createElement("pre");
        pre.textContent = await response.text();
        viewer.appendChild(pre);
      }
      state.renderedIncomingId = packet.packet_id;
    }

    if (state.lastIncomingId && state.lastIncomingId !== packet.packet_id) {
      $("latestPanel").classList.add("flash"); setTimeout(() => $("latestPanel").classList.remove("flash"), 1400);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New visual from Codex", {body:packet.title || "Open AXM Visual Handshake"});
      }
    }
    state.lastIncomingId = packet.packet_id;
  }

  $("ackBtn").addEventListener("click", async () => {
    if (!state.latestPacket) return;
    try {
      await api("/api/ack", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({lane:"to_mike", packet_id:state.latestPacket.packet_id, actor:"mike"})});
      await refresh();
    } catch (error) { alert(error.message || String(error)); }
  });
  $("openFolderBtn").addEventListener("click", async () => {
    try { await api("/api/open-folder", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({lane:"to_mike"})}); }
    catch (error) { alert(error.message || String(error)); }
  });
  $("fullscreenBtn").addEventListener("click", () => {
    const viewer = $("incomingViewer"); if (viewer.requestFullscreen) viewer.requestFullscreen();
  });
  $("notifyBtn").addEventListener("click", async () => {
    if (!("Notification" in window)) { alert("Notifications are not supported by this browser."); return; }
    const result = await Notification.requestPermission();
    $("notifyBtn").textContent = result === "granted" ? "Notifications enabled" : "Notifications blocked";
  });
  $("refreshBtn").addEventListener("click", refresh);

  async function refresh() {
    if (!token || state.refreshBusy || document.hidden) return;
    state.refreshBusy = true;
    try {
      const data = await api("/api/status");
      state.maxUploadBytes = Number(data.max_upload_bytes || state.maxUploadBytes);
      $("serverBadge").textContent = `● READY v${data.version}`;
      $("serverBadge").classList.add("good");
      $("toCodexCount").textContent = data.counts.to_codex || 0;
      $("toMikeCount").textContent = data.counts.to_mike || 0;
      $("latestToCodex").textContent = data.latest_to_codex ? `${data.latest_to_codex.title} · ${formatTime(data.latest_to_codex.created_at)}` : "None";
      $("latestToMike").textContent = data.latest_to_mike ? `${data.latest_to_mike.title} · ${formatTime(data.latest_to_mike.created_at)}` : "None";
      $("nativeCaptureBtn").classList.toggle("hidden", !data.native_capture_available);
      await renderIncoming(data.latest_to_mike);
    } catch (error) {
      $("serverBadge").textContent = "● DISCONNECTED";
      $("serverBadge").classList.remove("good");
    } finally {
      state.refreshBusy = false;
    }
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  document.addEventListener("keydown", event => {
    if (!event.altKey || !event.shiftKey) return;
    if (event.key.toLowerCase() === "s") { event.preventDefault(); setMode("capture"); }
    if (event.key.toLowerCase() === "m") { event.preventDefault(); setMode("latest"); }
  });

  if (!token) {
    $("tokenWarning").classList.remove("hidden");
    document.querySelectorAll("button, input, textarea").forEach(el => el.disabled = true);
  } else {
    refresh(); state.polling = setInterval(refresh, 2500);
  }
})();
