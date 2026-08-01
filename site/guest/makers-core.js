(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMGuestMakerCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA = 'axm.guest-makers/v1';
  var VERSION = 1;
  var MAX_COMMANDS = 420;
  var MAX_POINTS = 1600;
  var MAX_ARTIFACTS = 16;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, minimum, maximum) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = minimum;
    return Math.max(minimum, Math.min(maximum, number));
  }
  function cleanText(value, maximum, fallback) {
    var result = String(value == null ? '' : value).trim();
    if (!result && fallback != null) result = String(fallback);
    return maximum ? result.slice(0, maximum) : result;
  }
  function safeColor(value, fallback) {
    var color = String(value || '');
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : (fallback || '#6fe4ef');
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function safeDataImage(value) {
    var source = String(value || '');
    if (source.length > 700000) return '';
    return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source) ? source : '';
  }
  function safeJson(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
  function slug(value) {
    return cleanText(value, 60, 'axm-build').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'axm-build';
  }

  var SFX_PRESETS = {
    coin: { preset: 'coin', waveform: 'sine', frequency: 760, sweep: 520, duration: 0.24, volume: 0.55 },
    jump: { preset: 'jump', waveform: 'square', frequency: 210, sweep: 420, duration: 0.32, volume: 0.36 },
    laser: { preset: 'laser', waveform: 'sawtooth', frequency: 920, sweep: -720, duration: 0.28, volume: 0.34 },
    impact: { preset: 'impact', waveform: 'noise', frequency: 130, sweep: -80, duration: 0.42, volume: 0.48 },
    power: { preset: 'power', waveform: 'triangle', frequency: 180, sweep: 760, duration: 0.7, volume: 0.42 }
  };

  function defaultState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      activeTool: 'studio',
      studio: {
        tool: 'brush',
        color: '#6fe4ef',
        size: 10,
        background: '#07111f',
        commands: []
      },
      sfx: clone(SFX_PRESETS.coin),
      game: {
        title: 'Signal Catch',
        accent: '#6fe4ef',
        background: '#081526',
        speed: 1,
        goal: 7,
        useArtwork: true,
        useSfx: true
      },
      site: {
        brand: 'Small Signal',
        eyebrow: 'BUILT IN THIRTY ACTIVE MINUTES',
        headline: 'A clear idea, made visible.',
        body: 'A focused one-page home for a project, service, event or idea. Edit the words, choose the atmosphere and take the complete HTML file with you.',
        cta: 'See what matters',
        accent: '#6fe4ef',
        background: '#07111f',
        theme: 'orbit',
        useArtwork: true,
        features: [
          { title: 'One clear promise', body: 'Tell people what changes when your work succeeds.' },
          { title: 'Visible proof', body: 'Show the result, artifact or evidence instead of hiding behind claims.' },
          { title: 'A useful next step', body: 'Give the visitor one understandable action to take.' }
        ]
      },
      artifacts: []
    };
  }

  function normalizePoint(point) {
    point = point || {};
    return { x: clamp(point.x, 0, 960), y: clamp(point.y, 0, 540) };
  }
  function normalizeCommand(command) {
    command = command || {};
    var type = ['brush', 'eraser', 'line', 'rectangle', 'circle'].indexOf(command.type) >= 0 ? command.type : 'brush';
    return {
      type: type,
      color: safeColor(command.color, '#6fe4ef'),
      size: clamp(command.size, 1, 80),
      points: (Array.isArray(command.points) ? command.points : []).slice(0, MAX_POINTS).map(normalizePoint)
    };
  }
  function normalizeSfx(input) {
    input = input || {};
    var preset = Object.prototype.hasOwnProperty.call(SFX_PRESETS, input.preset) ? input.preset : 'custom';
    return {
      preset: preset,
      waveform: ['sine', 'square', 'triangle', 'sawtooth', 'noise'].indexOf(input.waveform) >= 0 ? input.waveform : 'sine',
      frequency: clamp(input.frequency, 45, 1800),
      sweep: clamp(input.sweep, -1600, 1600),
      duration: clamp(input.duration, 0.08, 1.6),
      volume: clamp(input.volume, 0.05, 0.9)
    };
  }
  function normalizeGame(input) {
    input = input || {};
    return {
      title: cleanText(input.title, 80, 'Signal Catch'),
      accent: safeColor(input.accent, '#6fe4ef'),
      background: safeColor(input.background, '#081526'),
      speed: clamp(input.speed, 0.6, 2),
      goal: Math.round(clamp(input.goal, 3, 20)),
      useArtwork: input.useArtwork !== false,
      useSfx: input.useSfx !== false
    };
  }
  function normalizeFeature(input, index) {
    input = input || {};
    return {
      title: cleanText(input.title, 70, 'Feature ' + (index + 1)),
      body: cleanText(input.body, 240, 'Explain one useful part of the offer.')
    };
  }
  function normalizeSite(input) {
    input = input || {};
    var features = Array.isArray(input.features) ? input.features : [];
    while (features.length < 3) features.push({});
    return {
      brand: cleanText(input.brand, 60, 'Small Signal'),
      eyebrow: cleanText(input.eyebrow, 100, 'BUILT IN THIRTY ACTIVE MINUTES'),
      headline: cleanText(input.headline, 160, 'A clear idea, made visible.'),
      body: cleanText(input.body, 600, 'A focused one-page home for your project.'),
      cta: cleanText(input.cta, 50, 'See what matters'),
      accent: safeColor(input.accent, '#6fe4ef'),
      background: safeColor(input.background, '#07111f'),
      theme: ['orbit', 'grid', 'warm'].indexOf(input.theme) >= 0 ? input.theme : 'orbit',
      useArtwork: input.useArtwork !== false,
      features: features.slice(0, 3).map(normalizeFeature)
    };
  }
  function normalizeArtifact(input) {
    input = input || {};
    var type = ['visual', 'sfx', 'game', 'website'].indexOf(input.type) >= 0 ? input.type : 'visual';
    var payload = input.payload && typeof input.payload === 'object' ? clone(input.payload) : {};
    if (payload.dataUrl) payload.dataUrl = safeDataImage(payload.dataUrl);
    return {
      id: cleanText(input.id, 100, type + '-' + Date.now().toString(36)),
      type: type,
      title: cleanText(input.title, 100, 'Untitled artifact'),
      summary: cleanText(input.summary, 320, ''),
      createdAt: cleanText(input.createdAt, 40, new Date().toISOString()),
      payload: payload
    };
  }
  function normalizeState(input) {
    var base = defaultState();
    if (!input || input.schema !== SCHEMA) return base;
    base.activeTool = ['studio', 'sfx', 'game', 'site'].indexOf(input.activeTool) >= 0 ? input.activeTool : 'studio';
    var studio = input.studio || {};
    base.studio = {
      tool: ['brush', 'eraser', 'line', 'rectangle', 'circle'].indexOf(studio.tool) >= 0 ? studio.tool : 'brush',
      color: safeColor(studio.color, '#6fe4ef'),
      size: clamp(studio.size, 1, 80),
      background: safeColor(studio.background, '#07111f'),
      commands: (Array.isArray(studio.commands) ? studio.commands : []).slice(-MAX_COMMANDS).map(normalizeCommand).filter(function (command) { return command.points.length; })
    };
    base.sfx = normalizeSfx(input.sfx);
    base.game = normalizeGame(input.game);
    base.site = normalizeSite(input.site);
    base.artifacts = (Array.isArray(input.artifacts) ? input.artifacts : []).slice(-MAX_ARTIFACTS).map(normalizeArtifact);
    return base;
  }

  function preset(name) {
    return clone(SFX_PRESETS[name] || SFX_PRESETS.coin);
  }
  function generateSfxSamples(input, sampleRate) {
    var config = normalizeSfx(input);
    var rate = Math.round(clamp(sampleRate || 44100, 8000, 96000));
    var length = Math.max(1, Math.round(config.duration * rate));
    var samples = new Float32Array(length);
    var seed = 0x4f1bbcdc;
    var phase = 0;
    for (var index = 0; index < length; index += 1) {
      var time = index / rate;
      var progress = index / Math.max(1, length - 1);
      var frequency = Math.max(20, config.frequency + config.sweep * progress);
      phase += Math.PI * 2 * frequency / rate;
      var wave;
      if (config.waveform === 'square') wave = Math.sin(phase) >= 0 ? 1 : -1;
      else if (config.waveform === 'triangle') wave = 2 / Math.PI * Math.asin(Math.sin(phase));
      else if (config.waveform === 'sawtooth') wave = 2 * ((phase / (Math.PI * 2)) - Math.floor(phase / (Math.PI * 2) + 0.5));
      else if (config.waveform === 'noise') {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        wave = seed / 2147483648 - 1;
      } else wave = Math.sin(phase);
      var attack = Math.min(1, time / Math.min(0.025, config.duration * 0.18));
      var releaseStart = Math.max(0.35, 1 - Math.min(0.55, 0.16 / config.duration));
      var release = progress < releaseStart ? 1 : Math.max(0, (1 - progress) / (1 - releaseStart));
      var envelope = attack * release * release;
      if (config.preset === 'impact') envelope *= Math.exp(-progress * 3.2);
      samples[index] = Math.max(-1, Math.min(1, wave * envelope * config.volume));
    }
    return samples;
  }
  function encodeWav(samples, sampleRate) {
    var rate = Math.round(clamp(sampleRate || 44100, 8000, 96000));
    var length = samples && Number.isFinite(samples.length) ? samples.length : 0;
    var buffer = new ArrayBuffer(44 + length * 2);
    var view = new DataView(buffer);
    function writeText(offset, value) {
      for (var index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    }
    writeText(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, length * 2, true);
    for (var sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
      var sample = Math.max(-1, Math.min(1, Number(samples[sampleIndex]) || 0));
      view.setInt16(44 + sampleIndex * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    return new Uint8Array(buffer);
  }

  function standalonePolicy(title, accent, background) {
    return '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:; media-src data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="' + background + '"><title>' + escapeHtml(title) + '</title>' +
      '<style>:root{color-scheme:dark;--accent:' + accent + ';--bg:' + background + ';--text:#f4f8ff;--muted:#9bacbf;--line:rgba(170,210,235,.18);font-family:Inter,ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text)}button{font:inherit}</style>';
  }

  function generateGameHtml(input, options) {
    var config = normalizeGame(input);
    options = options || {};
    var artwork = config.useArtwork ? safeDataImage(options.artworkData) : '';
    var sfx = normalizeSfx(options.sfx);
    var runtime = {
      title: config.title,
      accent: config.accent,
      background: config.background,
      speed: config.speed,
      goal: config.goal,
      artwork: artwork,
      useSfx: config.useSfx,
      sfx: sfx
    };
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' + standalonePolicy(config.title, config.accent, config.background) +
      '<style>body{background:radial-gradient(circle at 70% -10%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 42%),var(--bg)}.shell{width:min(1080px,calc(100% - 24px));margin:0 auto;padding:22px 0 35px}.head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:12px}.head span{color:var(--accent);font:800 9px ui-monospace,monospace;letter-spacing:.16em}.head h1{margin:5px 0 0;font-size:clamp(34px,6vw,66px);line-height:.95;letter-spacing:-.055em}.score{display:flex;gap:8px}.score b{min-width:96px;padding:11px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.035);font:800 13px ui-monospace,monospace;text-align:center}.frame{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 42%,var(--line));border-radius:18px;background:#07101b;box-shadow:0 25px 80px rgba(0,0,0,.42)}canvas{display:block;width:100%;height:auto;touch-action:none}.overlay{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:rgba(3,8,15,.74);backdrop-filter:blur(8px)}.overlay.hidden{display:none}.overlay div{max-width:440px;padding:28px;border:1px solid var(--line);border-radius:17px;background:rgba(9,18,31,.94);text-align:center}.overlay small{color:var(--accent);font:800 9px ui-monospace,monospace;letter-spacing:.12em}.overlay h2{margin:9px 0 7px;font-size:29px}.overlay p{margin:0 0 18px;color:var(--muted);line-height:1.55}.overlay button{min-height:44px;padding:0 20px;border:0;border-radius:10px;background:var(--accent);color:#051119;font-weight:850;cursor:pointer}.touch{position:absolute;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(2,44px);gap:4px}.touch button{border:1px solid rgba(255,255,255,.24);border-radius:10px;background:rgba(2,9,16,.72);color:white;font-size:18px;touch-action:none}.touch [data-key=up]{grid-column:2}.touch [data-key=left]{grid-column:1;grid-row:2}.touch [data-key=down]{grid-column:2;grid-row:2}.touch [data-key=right]{grid-column:3;grid-row:2}.note{color:var(--muted);font-size:11px}.note i{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#7de7b4}@media(max-width:700px){.head{align-items:flex-start;flex-direction:column}.score{width:100%}.score b{flex:1;min-width:0}.touch button{width:44px;height:44px}}</style></head><body>' +
      '<main class="shell"><header class="head"><div><span>SHAPEABLE LIGHT / LOCAL GAME</span><h1>' + escapeHtml(config.title) + '</h1></div><div class="score"><b id="score">0 / ' + config.goal + '</b><b id="status">READY</b></div></header><section class="frame"><canvas id="game" width="960" height="560" aria-label="Playable signal collection game"></canvas><div class="overlay" id="overlay"><div><small>ARROW KEYS / WASD / TOUCH</small><h2>Collect the signals</h2><p>Move through the field, gather every signal and keep the result on this device.</p><button id="start">Start game</button></div></div><div class="touch"><button data-key="up" aria-label="Move up">&uarr;</button><button data-key="left" aria-label="Move left">&larr;</button><button data-key="down" aria-label="Move down">&darr;</button><button data-key="right" aria-label="Move right">&rarr;</button></div></section><p class="note"><i></i>Standalone HTML5 game. No account, network request, score upload or external dependency.</p></main>' +
      '<script>"use strict";const CFG=' + safeJson(runtime) + ';const C=document.getElementById("game"),X=C.getContext("2d"),W=C.width,H=C.height,keys={};let player,items,score,running,last,art=null,audio=null;function reset(){player={x:100,y:H/2,r:16};items=[];score=0;for(let i=0;i<CFG.goal;i++)items.push({x:160+Math.random()*(W-220),y:55+Math.random()*(H-110),r:10});hud()}function hud(){document.getElementById("score").textContent=score+" / "+CFG.goal;document.getElementById("status").textContent=score>=CFG.goal?"COMPLETE":running?"ACTIVE":"READY"}function beep(){if(!CFG.useSfx)return;const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio=audio||new A();const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type=CFG.sfx.waveform==="noise"?"square":CFG.sfx.waveform;o.frequency.setValueAtTime(CFG.sfx.frequency,t);o.frequency.linearRampToValueAtTime(Math.max(30,CFG.sfx.frequency+CFG.sfx.sweep),t+CFG.sfx.duration);g.gain.setValueAtTime(Math.min(.35,CFG.sfx.volume),t);g.gain.exponentialRampToValueAtTime(.001,t+CFG.sfx.duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+CFG.sfx.duration)}function start(){reset();running=true;last=performance.now();document.getElementById("overlay").classList.add("hidden");hud();requestAnimationFrame(loop)}function finish(){running=false;hud();const o=document.getElementById("overlay");o.classList.remove("hidden");o.querySelector("h2").textContent="All signals gathered";o.querySelector("p").textContent="This result stayed local. Play again or keep shaping the downloaded file.";o.querySelector("button").textContent="Play again"}function loop(t){if(!running)return;const dt=Math.min(.04,(t-last)/1000);last=t;const dx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),dy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);if(dx||dy){const n=Math.hypot(dx,dy);player.x=Math.max(player.r,Math.min(W-player.r,player.x+dx/n*235*CFG.speed*dt));player.y=Math.max(player.r,Math.min(H-player.r,player.y+dy/n*235*CFG.speed*dt))}for(let i=items.length-1;i>=0;i--)if(Math.hypot(player.x-items[i].x,player.y-items[i].y)<player.r+items[i].r+4){items.splice(i,1);score++;beep();hud();if(score>=CFG.goal){draw(t);finish();return}}draw(t);requestAnimationFrame(loop)}function draw(t=0){X.fillStyle=CFG.background;X.fillRect(0,0,W,H);if(art){X.save();X.globalAlpha=.22;X.drawImage(art,0,0,W,H);X.restore()}X.strokeStyle="rgba(255,255,255,.07)";for(let x=0;x<W;x+=48){X.beginPath();X.moveTo(x,0);X.lineTo(x,H);X.stroke()}for(let y=0;y<H;y+=48){X.beginPath();X.moveTo(0,y);X.lineTo(W,y);X.stroke()}items.forEach((p,i)=>{const b=Math.sin(t/220+i)*3;X.save();X.translate(p.x,p.y+b);X.rotate(Math.PI/4);X.fillStyle=CFG.accent;X.shadowColor=CFG.accent;X.shadowBlur=18;X.fillRect(-p.r,-p.r,p.r*2,p.r*2);X.restore()});X.fillStyle=CFG.accent;X.shadowColor=CFG.accent;X.shadowBlur=20;X.beginPath();X.arc(player.x,player.y,player.r,0,Math.PI*2);X.fill();X.shadowBlur=0;X.strokeStyle="#fff";X.lineWidth=2;X.stroke()}addEventListener("keydown",e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=true;if(k.indexOf("Arrow")===0)e.preventDefault()});addEventListener("keyup",e=>keys[e.key.length===1?e.key.toLowerCase():e.key]=false);document.querySelectorAll("[data-key]").forEach(b=>{const m={up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight"},k=m[b.dataset.key];b.addEventListener("pointerdown",e=>{e.preventDefault();keys[k]=true;b.setPointerCapture(e.pointerId)});b.addEventListener("pointerup",()=>keys[k]=false);b.addEventListener("pointercancel",()=>keys[k]=false)});document.getElementById("start").addEventListener("click",start);if(CFG.artwork){art=new Image();art.onload=draw;art.src=CFG.artwork}reset();draw();<\/script></body></html>';
  }

  function generateWebsiteHtml(input, options) {
    var config = normalizeSite(input);
    options = options || {};
    var artwork = config.useArtwork ? safeDataImage(options.artworkData) : '';
    var artMarkup = artwork ? '<div class="hero-art"><img src="' + artwork + '" alt="Artwork created in AXM Public Studio"></div>' : '<div class="hero-art ambient" aria-hidden="true"><i></i><i></i><b>AXM</b></div>';
    var bodyClass = 'theme-' + config.theme;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' + standalonePolicy(config.brand, config.accent, config.background) +
      '<style>body{background:radial-gradient(circle at 78% -12%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 38%),linear-gradient(145deg,var(--bg),#091523)}.shell{width:min(1160px,calc(100% - 28px));margin:0 auto}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:72px;border-bottom:1px solid var(--line)}.brand{display:flex;min-width:0;align-items:center;gap:10px;font-weight:850;overflow-wrap:anywhere}.brand i{display:grid;flex:0 0 auto;place-items:center;width:35px;height:35px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:10px;color:var(--accent);font-style:normal}.top a{color:var(--muted);font-size:12px;text-decoration:none}.hero{position:relative;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:60px;align-items:center;min-height:620px;padding:70px 0}.eyebrow{color:var(--accent);font:800 10px ui-monospace,monospace;letter-spacing:.16em}.hero h1{max-width:780px;margin:17px 0 22px;font-size:clamp(54px,8vw,100px);line-height:.9;letter-spacing:-.07em;overflow-wrap:anywhere;text-wrap:balance}.hero p{max-width:690px;margin:0;color:var(--muted);font-size:17px;line-height:1.65;overflow-wrap:anywhere}.hero button{min-height:47px;margin-top:26px;padding:0 21px;border:0;border-radius:11px;background:var(--accent);color:#041119;font-weight:850;cursor:pointer}.hero-art{position:relative;overflow:hidden;aspect-ratio:1;border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));border-radius:28px;background:rgba(255,255,255,.025);box-shadow:0 30px 90px rgba(0,0,0,.35)}.hero-art img{width:100%;height:100%;object-fit:cover}.hero-art.ambient{border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 23%,transparent),transparent 64%)}.ambient:before,.ambient:after,.ambient i{content:"";position:absolute;border:1px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:50%}.ambient:before{inset:14%}.ambient:after{inset:30%}.ambient i:nth-child(1){inset:44%}.ambient i:nth-child(2){left:50%;top:5%;bottom:5%;border-radius:0}.ambient b{position:absolute;inset:0;display:grid;place-items:center;color:var(--accent);font:900 20px ui-monospace,monospace;letter-spacing:.2em}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding-bottom:70px}.features article{min-height:215px;padding:25px;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.025)}.features span{display:grid;place-items:center;width:36px;height:36px;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);border-radius:10px;color:var(--accent);font:800 9px ui-monospace,monospace}.features h2{margin:25px 0 9px;font-size:19px;overflow-wrap:anywhere}.features p{margin:0;color:var(--muted);font-size:13px;line-height:1.6;overflow-wrap:anywhere}.footer{display:flex;justify-content:space-between;gap:20px;padding:24px 0;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.theme-grid .hero-art{border-radius:14px;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:34px 34px}.theme-warm{--text:#fff6ec;--muted:#cdb6a4}.theme-warm .hero-art{border-radius:45% 45% 18px 18px}@media(max-width:850px){.hero{grid-template-columns:1fr;gap:28px;padding:55px 0}.hero-art{max-width:520px}.features{grid-template-columns:1fr}.hero h1{font-size:clamp(42px,11.4vw,72px);line-height:.94;letter-spacing:-.055em}}@media(max-width:560px){.top a{display:none}.footer{flex-direction:column}.hero h1{font-size:clamp(38px,11.4vw,58px)}}</style></head><body class="' + bodyClass + '">' +
      '<header class="shell top"><div class="brand"><i>+</i>' + escapeHtml(config.brand) + '</div><a href="#features">What matters</a></header><main><section class="shell hero"><div><div class="eyebrow">' + escapeHtml(config.eyebrow) + '</div><h1>' + escapeHtml(config.headline) + '</h1><p>' + escapeHtml(config.body) + '</p><button id="cta">' + escapeHtml(config.cta) + '</button></div>' + artMarkup + '</section><section class="shell features" id="features">' + config.features.map(function (feature, index) { return '<article><span>0' + (index + 1) + '</span><h2>' + escapeHtml(feature.title) + '</h2><p>' + escapeHtml(feature.body) + '</p></article>'; }).join('') + '</section></main><footer class="shell footer"><span>One portable HTML file. No framework or external dependency.</span><span>Made with AXM Shapeable Light</span></footer><script>"use strict";document.getElementById("cta").addEventListener("click",()=>document.getElementById("features").scrollIntoView({behavior:"smooth"}));<\/script></body></html>';
  }

  return {
    SCHEMA: SCHEMA,
    VERSION: VERSION,
    SFX_PRESETS: clone(SFX_PRESETS),
    defaultState: defaultState,
    normalizeState: normalizeState,
    normalizeSfx: normalizeSfx,
    normalizeGame: normalizeGame,
    normalizeSite: normalizeSite,
    preset: preset,
    generateSfxSamples: generateSfxSamples,
    encodeWav: encodeWav,
    generateGameHtml: generateGameHtml,
    generateWebsiteHtml: generateWebsiteHtml,
    safeDataImage: safeDataImage,
    safeColor: safeColor,
    cleanText: cleanText,
    escapeHtml: escapeHtml,
    slug: slug,
    clone: clone
  };
}));
